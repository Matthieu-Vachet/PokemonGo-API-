const { ApiError } = require("./api-error");
const zlib = require("node:zlib");
const mongoose = require("mongoose");
const { invalidateDatasetCache } = require("./cache");
const { generateCurrentData } = require("./current-data-pipeline");
const { computeDatasetHash, diffDatasets } = require("./current-dataset-hash");
const { hydrateCurrentDatasetDocument, serializeCurrentDatasetDocument } = require("./current-dataset-reader");
const { DatasetRun } = require("../models");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function domainCode(domain, suffix) {
  return `${String(domain).toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_${suffix}`;
}

function normalizedUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function assertReportedSource(adapter, report = {}) {
  if (!adapter.strictSourceUrl) return;
  const reportedUrl = report.sourceUrl || report.source;
  if (!reportedUrl || normalizedUrl(reportedUrl) !== normalizedUrl(adapter.sourceUrl)) {
    throw new ApiError(
      502,
      `La source retournee pour ${adapter.domain} ne correspond pas a la source autorisee.`,
      domainCode(adapter.domain, "SOURCE_URL_MISMATCH"),
      { expected: adapter.sourceUrl, received: reportedUrl || null },
    );
  }
}

function sourceMetadata(adapter, report = {}, now = new Date()) {
  assertReportedSource(adapter, report);
  const event = report.event && typeof report.event === "object" ? report.event : null;
  return {
    provider: adapter.provider,
    url: report.sourceUrl || report.source || adapter.sourceUrl,
    mode: report.sourceMode || report.mode || (event ? "event" : "regular"),
    fetchedAt: new Date(report.fetchedAt || report.updatedAt || now),
    event,
    timezone: report.timezone || event?.timezone || null,
    selection: report.selectedRaids || report.selection || null,
    dynamicShellDetected: Boolean(report.dynamicShellDetected),
  };
}

function manualSourceMetadata(now = new Date()) {
  return {
    provider: "manual",
    url: null,
    mode: "maintenance",
    fetchedAt: now,
    event: null,
    timezone: null,
    selection: null,
    dynamicShellDetected: false,
  };
}

function reportWarnings(report = {}) {
  const warnings = [...asArray(report.warnings)];
  if (asArray(report.excluded).length) {
    warnings.push(`${report.excluded.length} entree(s) exclue(s) par les regles du domaine.`);
  }
  return [...new Set(warnings.map((warning) => String(warning).trim()).filter(Boolean))];
}

function normalizeUnmatchedEntry(entry = {}, fallbackReason = "unknown") {
  return {
    sourceId: entry.sourceId ?? entry.rawId ?? entry.id ?? null,
    sourceName: entry.sourceName ?? entry.rawName ?? entry.name ?? null,
    sourceForm: entry.sourceForm ?? entry.rawForm ?? entry.form ?? entry.requestedVariant ?? null,
    sourceCostume: entry.sourceCostume ?? entry.rawCostume ?? entry.costume ?? null,
    sourceImage: entry.sourceImage ?? entry.rawImage ?? entry.image ?? null,
    reason: entry.reason ?? entry.status ?? fallbackReason,
    candidates: asArray(entry.candidates ?? entry.ambiguousCandidates),
    localFile: entry.localFile ?? null,
    sourcePayload: entry.sourcePayload ?? entry.raw ?? entry,
  };
}

function unmatchedEntriesFromReport(report = {}) {
  const entries = asArray(report.unmatchedEntries).map((entry) => normalizeUnmatchedEntry(entry));
  for (const entry of asArray(report.resolutionReport?.details)) {
    if (entry?.status && entry.status !== "matched") entries.push(normalizeUnmatchedEntry(entry, entry.status));
  }
  for (const name of asArray(report.unmatchedPokemon)) {
    entries.push(normalizeUnmatchedEntry({ sourceName: name, reason: "missing-local-pokemon" }));
  }
  for (const name of asArray(report.unmatchedItems)) {
    entries.push(normalizeUnmatchedEntry({ sourceName: name, reason: "missing-local-item" }));
  }
  const seen = new Set();
  return entries.filter((entry) => {
    const key = JSON.stringify([entry.sourceId, entry.sourceName, entry.sourceForm, entry.sourceCostume, entry.reason]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDiagnostics({ report = {}, stats, diff }) {
  const warnings = reportWarnings(report);
  const unmatchedEntries = unmatchedEntriesFromReport(report);
  if (Number(stats.itemsUnmatched || 0) > 0) {
    warnings.push(`${Number(stats.itemsUnmatched)} entree(s) non matchee(s) conservee(s).`);
  }
  return {
    rawCount: Number(report.rawCount ?? report.rawParsed ?? report.fetched ?? stats.itemsParsed ?? 0),
    parsedCount: Number(stats.itemsParsed || 0),
    matchedCount: Number(stats.itemsMatched || 0),
    unmatchedCount: Number(stats.itemsUnmatched || 0),
    warnings: [...new Set(warnings)],
    warningsCount: [...new Set(warnings)].length,
    unmatchedEntries,
    details: {
      timezone: report.timezone || report.event?.timezone || null,
      dynamicShellDetected: Boolean(report.dynamicShellDetected),
      selectedRaids: report.selectedRaids || null,
      buckets: report.buckets || report.sections || report.groups || null,
      categories: report.categoriesFound || report.categoryTitles || null,
      rotations: report.rotations || null,
      internalResources: report.internalResources || null,
      eventTasks: report.eventTasks ?? null,
      pokemonRewards: report.pokemonRewards ?? null,
      itemRewards: report.itemRewards ?? null,
      sourceAssets: report.sourceAssets ?? null,
      resolutionReport: report.resolutionReport ?? null,
      dataUsage: report.dataUsage ?? null,
      sourceDetails: report.sourceDetails ?? null,
    },
    diff,
  };
}

function datasetRunModel() {
  return mongoose.connection.readyState === 1 ? DatasetRun : null;
}

async function startDatasetRun(adapter, mode = "regenerate") {
  const Model = datasetRunModel();
  if (!Model) return null;
  const previous = await readStoredDocument(adapter).catch(() => null);
  return Model.create({
    datasetKey: adapter.domain,
    provider: mode === "import" ? "manual" : adapter.provider,
    sourceUrl: mode === "import" ? null : adapter.sourceUrl,
    status: "running",
    startedAt: new Date(),
    hashBefore: previous?.sourceHash || null,
    totalBefore: Number(previous?.count || 0),
    diffUnavailableReason: previous ? null : "Aucun dataset précédent : premier snapshot.",
  });
}

async function finishDatasetRun(run, result) {
  if (!run) return null;
  const diagnostics = result.current?.diagnostics || {};
  const diff = diagnostics.diff || {};
  const warnings = asArray(diagnostics.warnings);
  const unmatchedEntries = asArray(diagnostics.unmatchedEntries);
  const status = diff.changed === false
    ? "unchanged"
    : Number(diagnostics.unmatchedCount || 0) || warnings.length
      ? "partial"
      : "success";
  const completedAt = new Date();
  const update = {
    status,
    completedAt,
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
    retrievedAt: result.current?.source?.fetchedAt || null,
    savedAt: result.current?.savedAt || completedAt,
    hashAfter: result.current?.sourceHash || null,
    changed: Boolean(diff.changed),
    totalAfter: Number(result.current?.count || 0),
    added: Number(diff.added || 0),
    removed: Number(diff.removed || 0),
    modified: Number(diff.modified || 0),
    matchedCount: Number(diagnostics.matchedCount || 0),
    unmatchedCount: Number(diagnostics.unmatchedCount || 0),
    warningsCount: warnings.length,
    errorsCount: 0,
    unmatchedEntries,
    warnings,
    errors: [],
    diffUnavailableReason: typeof diff.changed === "boolean" ? null : (run.diffUnavailableReason || "Diff non calculé par le générateur."),
  };
  await DatasetRun.updateOne({ _id: run._id }, { $set: update });
  return { ...run.toObject(), ...update };
}

async function failDatasetRun(run, error) {
  if (!run) return;
  const completedAt = new Date();
  await DatasetRun.updateOne({ _id: run._id }, { $set: {
    status: "failed",
    completedAt,
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
    errorsCount: 1,
    errors: [{ message: error.message, code: error.code || null, details: error.details || null }],
  } }).catch(() => undefined);
}

async function leanQuery(query) {
  return query && typeof query.lean === "function" ? query.lean() : query;
}

async function readStoredDocument(adapter) {
  return hydrateCurrentDatasetDocument(await leanQuery(adapter.Model.findOne({ key: "current" })));
}

function verifyReadback(adapter, document, expected) {
  if (!document || document.key !== "current") {
    throw new ApiError(
      500,
      `La relecture MongoDB a echoue pour ${adapter.domain}.`,
      domainCode(adapter.domain, "READBACK_FAILED"),
    );
  }

  const readbackHash = computeDatasetHash(document.data, {
    extractEntries: adapter.extractEntries,
  });
  if (document.sourceHash !== expected.sourceHash || readbackHash !== expected.sourceHash) {
    throw new ApiError(
      500,
      `Le hash relu dans MongoDB ne correspond pas au dataset ecrit pour ${adapter.domain}.`,
      domainCode(adapter.domain, "READBACK_HASH_MISMATCH"),
      { expected: expected.sourceHash, stored: document.sourceHash || null, computed: readbackHash },
    );
  }
  if (Number(document.count) !== Number(expected.count)) {
    throw new ApiError(
      500,
      `Le nombre relu dans MongoDB ne correspond pas au dataset ecrit pour ${adapter.domain}.`,
      domainCode(adapter.domain, "READBACK_COUNT_MISMATCH"),
      { expected: expected.count, stored: document.count },
    );
  }
}

async function persistCurrentDataset({ adapter, data, report = {}, summary, stats, source }) {
  const persistenceStartedAt = Date.now();
  adapter.validate(data, report, summary);
  const count = Number(adapter.count(data, summary));
  const previous = await readStoredDocument(adapter);
  const diff = diffDatasets(previous?.data || null, data, {
    extractEntries: adapter.extractEntries,
  });
  if (!previous) diff.previousHash = null;

  const generatedAt = new Date();
  const savedAt = new Date();
  const document = {
    key: "current",
    domain: adapter.domain,
    visibility: adapter.visibility,
    source: source || sourceMetadata(adapter, report, generatedAt),
    generatedAt,
    savedAt,
    count,
    sourceHash: diff.newHash,
    status: "success",
    data,
    diagnostics: buildDiagnostics({ report, stats, diff }),
  };
  if (adapter.compressData) {
    document.compressedData = zlib.gzipSync(Buffer.from(JSON.stringify(data)));
    document.data = { compressed: true, encoding: "gzip+json", schemaVersion: data.meta?.schemaVersion || 1 };
  }

  await leanQuery(adapter.Model.findOneAndUpdate(
    { key: "current" },
    adapter.compressData
      ? { $set: document, $unset: { sourceFile: "" } }
      : { $set: document, $unset: { sourceFile: "", compressedData: "" } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ));

  console.info(`[current-dataset:${adapter.domain}] Current document persisted`, {
    count,
    elapsedMs: Date.now() - persistenceStartedAt,
  });

  if (adapter.SnapshotModel && diff.changed) {
    const snapshotStartedAt = Date.now();
    const snapshotData = typeof adapter.snapshotData === "function"
      ? adapter.snapshotData(data)
      : data;
    await adapter.SnapshotModel.create({
      domain: adapter.domain,
      visibility: adapter.visibility,
      snapshotAt: generatedAt,
      sourceHash: diff.newHash,
      count,
      source: document.source,
      diagnostics: document.diagnostics,
      data: snapshotData,
    });
    console.info(`[current-dataset:${adapter.domain}] History snapshot persisted`, {
      count,
      elapsedMs: Date.now() - snapshotStartedAt,
    });
  }

  invalidateDatasetCache(adapter.domain);
  const readback = await readStoredDocument(adapter);
  verifyReadback(adapter, readback, { count, sourceHash: diff.newHash });

  console.info(`[current-dataset:${adapter.domain}] MongoDB upsert verified`, {
    count,
    sourceHash: diff.newHash,
    changed: diff.changed,
    added: diff.added,
    removed: diff.removed,
    modified: diff.modified,
    elapsedMs: Date.now() - persistenceStartedAt,
  });

  return {
    current: serializeCurrentDatasetDocument(readback),
    summary,
    stats,
    report,
  };
}

async function regenerateCurrentDataset(adapter) {
  const regenerationStartedAt = Date.now();
  const run = await startDatasetRun(adapter, "regenerate");
  console.info(`[current-dataset:${adapter.domain}] Regeneration started`);
  let generated;
  try {
    generated = await generateCurrentData({
      ...adapter,
      source: adapter.domain,
    });
  } catch (error) {
    await failDatasetRun(run, error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      `La recuperation externe a echoue pour ${adapter.domain}: ${error.message}`,
      domainCode(adapter.domain, "SOURCE_FETCH_FAILED"),
    );
  }

  console.info(`[current-dataset:${adapter.domain}] Source generation completed`, {
    itemsParsed: Number(generated.stats?.itemsParsed || 0),
    elapsedMs: Date.now() - regenerationStartedAt,
  });

  let result;
  try {
    result = await persistCurrentDataset({
      adapter,
      data: generated.data,
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
    });
    result.run = await finishDatasetRun(run, result);
  } catch (error) {
    await failDatasetRun(run, error);
    throw error;
  }
  console.info(`[current-dataset:${adapter.domain}] Regeneration completed`, {
    elapsedMs: Date.now() - regenerationStartedAt,
  });
  return result;
}

async function importCurrentDataset(adapter, data) {
  const summary = adapter.summarize(data);
  const stats = adapter.stats(data, {}, summary);
  if (Number(stats.itemsParsed || 0) <= 0) {
    throw new ApiError(
      422,
      `Le payload manuel ${adapter.domain} est vide.`,
      domainCode(adapter.domain, "IMPORT_EMPTY"),
    );
  }
  const run = await startDatasetRun(adapter, "import");
  try {
    const result = await persistCurrentDataset({
      adapter,
      data,
      summary,
      stats,
      source: manualSourceMetadata(),
    });
    result.run = await finishDatasetRun(run, result);
    return result;
  } catch (error) {
    await failDatasetRun(run, error);
    throw error;
  }
}

module.exports = {
  buildDiagnostics,
  finishDatasetRun,
  importCurrentDataset,
  persistCurrentDataset,
  regenerateCurrentDataset,
  sourceMetadata,
  unmatchedEntriesFromReport,
  verifyReadback,
};
