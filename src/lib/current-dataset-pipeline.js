const { ApiError } = require("./api-error");
const zlib = require("node:zlib");
const mongoose = require("mongoose");
const { invalidateDatasetCache } = require("./cache");
const { generateCurrentData } = require("./current-data-pipeline");
const { computeDatasetHash, diffDatasets } = require("./current-dataset-hash");
const { compressedBuffer, hydrateCurrentDatasetDocument, serializeCurrentDatasetDocument } = require("./current-dataset-reader");
const { DatasetRun } = require("../models");

// The generation stage runs in api/rest.js (120 s max). Keep the orphan window
// slightly above that ceiling so polling never fails a Function still running.
const ACTIVE_REGENERATION_WINDOW_MS = 135 * 1000;
const REGENERATION_TIMEOUT_CODE = "DATASET_REGENERATION_TIMEOUT";

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
    mappingMissingCount: Number(report.mappingMissingCount ?? stats.itemsUnmatched ?? 0),
    ignoredCount: Number(report.ignoredCount ?? report.skippedCount ?? report.skipped ?? 0),
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

function serializeDatasetRun(run) {
  if (!run) return null;
  const value = typeof run.toObject === "function" ? run.toObject() : run;
  return {
    id: String(value._id),
    datasetKey: value.datasetKey,
    status: value.status,
    phase: value.phase || null,
    startedAt: value.startedAt,
    completedAt: value.completedAt || null,
    durationMs: Number(value.durationMs || 0),
    changed: Boolean(value.changed),
    diff: {
      changed: Boolean(value.changed),
      added: Number(value.added || 0),
      removed: Number(value.removed || 0),
      modified: Number(value.modified || 0),
    },
    totalAfter: Number(value.totalAfter || 0),
    matchedCount: Number(value.matchedCount || 0),
    unmatchedCount: Number(value.unmatchedCount || 0),
    mappingMissingCount: Number(value.mappingMissingCount ?? value.unmatchedCount ?? 0),
    ignoredCount: Number(value.ignoredCount || 0),
    warningsCount: Number(value.warningsCount || 0),
    errorsCount: Number(value.errorsCount || 0),
    warnings: asArray(value.warnings),
    errors: asArray(value.errors),
  };
}

function staleDatasetRunUpdate(run, now = Date.now()) {
  if (!run || run.status !== "running") return null;
  if (["generated", "persisting"].includes(run.phase)) return null;
  const startedAt = new Date(run.startedAt).getTime();
  if (!Number.isFinite(startedAt) || now - startedAt <= ACTIVE_REGENERATION_WINDOW_MS) return null;
  const completedAt = new Date(now);
  return {
    status: "failed",
    phase: "completed",
    phaseStartedAt: completedAt,
    completedAt,
    durationMs: Math.max(0, now - startedAt),
    errorsCount: 1,
    errors: [{
      code: REGENERATION_TIMEOUT_CODE,
      message: "La régénération a dépassé la durée maximale de la Function Vercel.",
    }],
  };
}

function logRegenerationFailure(adapter, phase, error, startedAt) {
  console.error(`[current-dataset:${adapter.domain}] Regeneration failed`, {
    phase,
    code: error?.code || error?.name || "UNKNOWN_ERROR",
    message: error?.message || String(error),
    elapsedMs: Date.now() - startedAt,
  });
}

async function startDatasetRun(adapter, mode = "regenerate") {
  const Model = datasetRunModel();
  if (!Model) return null;
  const previous = await readStoredMetadata(adapter).catch(() => null);
  return Model.create({
    datasetKey: adapter.domain,
    provider: mode === "import" ? "manual" : adapter.provider,
    sourceUrl: mode === "import" ? null : adapter.sourceUrl,
    status: "running",
    phase: "generating",
    phaseStartedAt: new Date(),
    startedAt: new Date(),
    hashBefore: previous?.sourceHash || null,
    totalBefore: Number(previous?.count || 0),
    diffUnavailableReason: previous ? null : "Aucun dataset précédent : premier snapshot.",
  });
}

function datasetRunStatus(diagnostics = {}, diff = {}) {
  const warnings = asArray(diagnostics.warnings);
  if (
    Number(diagnostics.mappingMissingCount || diagnostics.unmatchedCount || 0)
    || Number(diagnostics.warningsCount || 0)
    || warnings.length
  ) return "partial";
  return diff.changed === false ? "unchanged" : "success";
}

async function finishDatasetRun(run, result) {
  if (!run) return null;
  const diagnostics = result.current?.diagnostics || {};
  const diff = diagnostics.diff || {};
  const warnings = asArray(diagnostics.warnings);
  const unmatchedEntries = asArray(diagnostics.unmatchedEntries);
  const status = datasetRunStatus(diagnostics, diff);
  const completedAt = new Date();
  const update = {
    status,
    phase: "completed",
    phaseStartedAt: completedAt,
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
    mappingMissingCount: Number(diagnostics.mappingMissingCount ?? diagnostics.unmatchedCount ?? 0),
    ignoredCount: Number(diagnostics.ignoredCount || 0),
    warningsCount: warnings.length,
    errorsCount: 0,
    unmatchedEntries,
    warnings,
    errors: [],
    diffUnavailableReason: typeof diff.changed === "boolean" ? null : (run.diffUnavailableReason || "Diff non calculé par le générateur."),
  };
  await DatasetRun.updateOne({ _id: run._id }, { $set: update, $unset: { stagedPayload: "" } });
  const source = typeof run.toObject === "function" ? run.toObject() : run;
  return { ...source, ...update };
}

async function failDatasetRun(run, error) {
  if (!run) return;
  const completedAt = new Date();
  await DatasetRun.updateOne({ _id: run._id }, { $set: {
    status: "failed",
    phase: "completed",
    phaseStartedAt: completedAt,
    completedAt,
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
    errorsCount: 1,
    errors: [{ message: error.message, code: error.code || null, details: error.details || null }],
  }, $unset: { stagedPayload: "" } }).catch(() => undefined);
}

async function getCurrentDatasetRegeneration(adapter, runId) {
  const Model = datasetRunModel();
  if (!Model) {
    throw new ApiError(503, "Le suivi des régénérations nécessite MongoDB.", "DATASET_RUN_STORE_UNAVAILABLE");
  }
  if (!mongoose.isValidObjectId(runId)) {
    throw new ApiError(400, "Identifiant de régénération invalide.", "DATASET_RUN_ID_INVALID");
  }
  let run = await Model.findOne({ _id: runId, datasetKey: adapter.domain }).lean();
  if (!run) {
    throw new ApiError(404, "Régénération introuvable.", "DATASET_RUN_NOT_FOUND");
  }
  const staleUpdate = staleDatasetRunUpdate(run);
  if (staleUpdate) {
    await Model.updateOne(
      { _id: run._id, datasetKey: adapter.domain, status: "running" },
      { $set: staleUpdate },
    );
    run = { ...run, ...staleUpdate };
  }
  return serializeDatasetRun(run);
}

async function enqueueCurrentDatasetRegeneration(adapter) {
  const Model = datasetRunModel();
  if (!Model) {
    throw new ApiError(503, "La régénération asynchrone nécessite MongoDB.", "DATASET_RUN_STORE_UNAVAILABLE");
  }

  const activeSince = new Date(Date.now() - ACTIVE_REGENERATION_WINDOW_MS);
  const existing = await Model.findOne({
    datasetKey: adapter.domain,
    status: "running",
    $or: [
      { phase: { $in: ["generated", "persisting"] } },
      { startedAt: { $gte: activeSince } },
    ],
  }).sort({ startedAt: -1 }).lean();
  if (existing) {
    return { alreadyRunning: true, run: serializeDatasetRun(existing), task: null };
  }

  const run = await startDatasetRun(adapter, "regenerate");
  if (!run) {
    throw new ApiError(503, "Impossible d'initialiser la régénération asynchrone.", "DATASET_RUN_START_FAILED");
  }
  const task = stageCurrentDatasetRegeneration(adapter, run).catch((error) => {
    logRegenerationFailure(adapter, "background", error, new Date(run.startedAt).getTime());
  });
  return { alreadyRunning: false, run: serializeDatasetRun(run), task };
}

async function stageCurrentDatasetRegeneration(adapter, run) {
  const regenerationStartedAt = Date.now();
  console.info(`[current-dataset:${adapter.domain}] Regeneration generation stage started`);
  let generated;
  try {
    generated = await generateCurrentData({
      ...adapter,
      source: adapter.domain,
    });
    console.info(`[current-dataset:${adapter.domain}] Source generation completed`, {
      itemsParsed: Number(generated.stats?.itemsParsed || 0),
      elapsedMs: Date.now() - regenerationStartedAt,
    });
    const stagedPayload = zlib.gzipSync(Buffer.from(JSON.stringify({
      data: generated.data,
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
    })));
    const phaseStartedAt = new Date();
    await DatasetRun.updateOne(
      { _id: run._id, status: "running", phase: "generating" },
      { $set: { phase: "generated", phaseStartedAt, stagedPayload } },
    );
    console.info(`[current-dataset:${adapter.domain}] Regeneration payload staged`, {
      compressedBytes: stagedPayload.length,
      elapsedMs: Date.now() - regenerationStartedAt,
    });
  } catch (error) {
    await failDatasetRun(run, error);
    logRegenerationFailure(adapter, "generation-or-staging", error, regenerationStartedAt);
    throw error;
  }
}

async function persistStagedCurrentDatasetRegeneration(adapter, run) {
  const persistenceStartedAt = Date.now();
  try {
    if (!run.stagedPayload) {
      throw new ApiError(500, "Le payload de staging est absent.", "DATASET_REGENERATION_STAGE_MISSING");
    }
    const generated = JSON.parse(zlib.gunzipSync(compressedBuffer(run.stagedPayload)).toString("utf8"));
    const result = await persistCurrentDataset({
      adapter,
      data: generated.data,
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
    });
    result.run = await finishDatasetRun(run, result);
    console.info(`[current-dataset:${adapter.domain}] Regeneration persistence stage completed`, {
      elapsedMs: Date.now() - persistenceStartedAt,
    });
  } catch (error) {
    await failDatasetRun(run, error);
    logRegenerationFailure(adapter, "staged-persistence", error, persistenceStartedAt);
    throw error;
  }
}

async function continueCurrentDatasetRegeneration(adapter, runId) {
  const Model = datasetRunModel();
  if (!Model) {
    throw new ApiError(503, "Le suivi des régénérations nécessite MongoDB.", "DATASET_RUN_STORE_UNAVAILABLE");
  }
  if (!mongoose.isValidObjectId(runId)) {
    throw new ApiError(400, "Identifiant de régénération invalide.", "DATASET_RUN_ID_INVALID");
  }

  const stalePersistenceBefore = new Date(Date.now() - ACTIVE_REGENERATION_WINDOW_MS);
  await Model.updateOne(
    {
      _id: runId,
      datasetKey: adapter.domain,
      status: "running",
      phase: "persisting",
      phaseStartedAt: { $lt: stalePersistenceBefore },
    },
    { $set: { phase: "generated", phaseStartedAt: new Date() } },
  );

  let run = await Model.findOne({ _id: runId, datasetKey: adapter.domain }).lean();
  if (!run) {
    throw new ApiError(404, "Régénération introuvable.", "DATASET_RUN_NOT_FOUND");
  }
  const staleUpdate = staleDatasetRunUpdate(run);
  if (staleUpdate) {
    await Model.updateOne(
      { _id: run._id, datasetKey: adapter.domain, status: "running" },
      { $set: staleUpdate, $unset: { stagedPayload: "" } },
    );
    run = { ...run, ...staleUpdate };
    return { run: serializeDatasetRun(run), task: null };
  }

  if (run.status === "running" && run.phase === "generated") {
    const phaseStartedAt = new Date();
    const claimed = await Model.findOneAndUpdate(
      { _id: run._id, datasetKey: adapter.domain, status: "running", phase: "generated" },
      { $set: { phase: "persisting", phaseStartedAt } },
      { returnDocument: "after" },
    ).lean();
    if (claimed) {
      const task = persistStagedCurrentDatasetRegeneration(adapter, claimed).catch((error) => {
        logRegenerationFailure(adapter, "persistence-background", error, phaseStartedAt.getTime());
      });
      return { run: serializeDatasetRun(claimed), task };
    }
    run = await Model.findOne({ _id: runId, datasetKey: adapter.domain }).lean();
  }

  return { run: serializeDatasetRun(run), task: null };
}

async function leanQuery(query) {
  return query && typeof query.lean === "function" ? query.lean() : query;
}

async function readStoredMetadata(adapter) {
  let query = adapter.Model.findOne({ key: "current" });
  if (query && typeof query.select === "function") {
    query = query.select({ sourceHash: 1, count: 1 });
  }
  return leanQuery(query);
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

async function regenerateCurrentDataset(adapter, options = {}) {
  const regenerationStartedAt = Date.now();
  const run = options.run || await startDatasetRun(adapter, "regenerate");
  console.info(`[current-dataset:${adapter.domain}] Regeneration started`);
  let generated;
  try {
    generated = await generateCurrentData({
      ...adapter,
      source: adapter.domain,
    });
  } catch (error) {
    await failDatasetRun(run, error);
    logRegenerationFailure(adapter, "source-generation", error, regenerationStartedAt);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      502,
      `La recuperation externe a echoue pour ${adapter.domain}: ${error.message}`,
      domainCode(adapter.domain, "SOURCE_FETCH_FAILED"),
      error && typeof error === "object" && error.details ? error.details : {
        provider: adapter.provider,
        sourceUrl: adapter.sourceUrl,
        preservation: "Le dernier snapshot MongoDB valide reste actif.",
      },
    );
  }

  console.info(`[current-dataset:${adapter.domain}] Source generation completed`, {
    itemsParsed: Number(generated.stats?.itemsParsed || 0),
    elapsedMs: Date.now() - regenerationStartedAt,
  });

  let result;
  try {
    {
      const details = generated.report?.resolutionReport?.details || [];
      if (details.length) {
      const diagnosticBatch = await require("../services/pokemon-identity-service").recordDiagnosticsBatch(details);
      generated.report.identityDiagnostics = diagnosticBatch;
      console.info(`[current-dataset:${adapter.domain}] Identity diagnostics synchronized`, diagnosticBatch);
      }
    }

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
    logRegenerationFailure(adapter, "diagnostics-or-persistence", error, regenerationStartedAt);
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
  continueCurrentDatasetRegeneration,
  datasetRunStatus,
  enqueueCurrentDatasetRegeneration,
  finishDatasetRun,
  getCurrentDatasetRegeneration,
  importCurrentDataset,
  persistCurrentDataset,
  regenerateCurrentDataset,
  serializeDatasetRun,
  sourceMetadata,
  staleDatasetRunUpdate,
  unmatchedEntriesFromReport,
  verifyReadback,
};
