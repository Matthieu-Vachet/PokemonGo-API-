const { ApiError } = require("./api-error");
const zlib = require("node:zlib");
const { invalidateDatasetCache } = require("./cache");
const { generateCurrentData } = require("./current-data-pipeline");
const { computeDatasetHash, diffDatasets } = require("./current-dataset-hash");
const { hydrateCurrentDatasetDocument, serializeCurrentDatasetDocument } = require("./current-dataset-reader");

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

function buildDiagnostics({ report = {}, stats, diff }) {
  const warnings = reportWarnings(report);
  if (Number(stats.itemsUnmatched || 0) > 0) {
    warnings.push(`${Number(stats.itemsUnmatched)} entree(s) non matchee(s) conservee(s).`);
  }
  return {
    rawCount: Number(report.rawCount ?? report.rawParsed ?? report.fetched ?? stats.itemsParsed ?? 0),
    parsedCount: Number(stats.itemsParsed || 0),
    matchedCount: Number(stats.itemsMatched || 0),
    unmatchedCount: Number(stats.itemsUnmatched || 0),
    warnings: [...new Set(warnings)],
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

  if (adapter.SnapshotModel) {
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
  console.info(`[current-dataset:${adapter.domain}] Regeneration started`);
  let generated;
  try {
    generated = await generateCurrentData({
      ...adapter,
      source: adapter.domain,
    });
  } catch (error) {
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

  const result = await persistCurrentDataset({
    adapter,
    data: generated.data,
    report: generated.report,
    summary: generated.summary,
    stats: generated.stats,
  });
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
  return persistCurrentDataset({
    adapter,
    data,
    summary,
    stats,
    source: manualSourceMetadata(),
  });
}

module.exports = {
  buildDiagnostics,
  importCurrentDataset,
  persistCurrentDataset,
  regenerateCurrentDataset,
  sourceMetadata,
  verifyReadback,
};
