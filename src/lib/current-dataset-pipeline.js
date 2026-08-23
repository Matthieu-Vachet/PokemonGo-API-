const { ApiError } = require("./api-error");
const zlib = require("node:zlib");
const mongoose = require("mongoose");
const { invalidateDatasetCache } = require("./cache");
const { generateCurrentData } = require("./current-data-pipeline");
const { computeDatasetHash, diffDatasets } = require("./current-dataset-hash");
const { compressedBuffer, hydrateCurrentDatasetDocument, serializeCurrentDatasetDocument } = require("./current-dataset-reader");
const { DatasetRun } = require("../models");
const { createUnmatchedEntriesReport, normalizeUnmatchedEntry } = require("./unmatched-entries-report");

// The generation stage runs in api/rest.js (60 s max). Keep the orphan window
// slightly above that ceiling so polling never fails a Function still running.
const ACTIVE_REGENERATION_WINDOW_MS = 75 * 1000;
const REGENERATION_TIMEOUT_CODE = "DATASET_REGENERATION_TIMEOUT";
const SOURCE_AVAILABILITY_CODES = new Set([
  "SOURCE_PROTECTED",
  "SOURCE_TEMPORARILY_UNAVAILABLE",
  "SOURCE_UNAVAILABLE",
  "SOURCE_SCHEMA_CHANGED",
  "VALIDATION_FAILED",
]);

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

function unmatchedEntriesFromReport(report = {}, options = {}) {
  const entries = [...asArray(report.unmatchedEntries), ...asArray(report.unmatched)];
  for (const entry of asArray(report.resolutionReport?.details)) {
    if (entry?.status && entry.status !== "matched") entries.push(entry);
  }
  for (const name of asArray(report.unmatchedPokemon)) {
    entries.push(typeof name === "object" ? name : { sourceName: name, reason: "missing-local-pokemon" });
  }
  for (const name of asArray(report.unmatchedItems)) {
    entries.push(typeof name === "object" ? name : { sourceName: name, reason: "missing-local-item" });
  }
  for (const entry of asArray(report.unmatchedPokemonRewards)) {
    entries.push(typeof entry === "object" ? entry : { sourceName: entry, reason: "missing-local-pokemon" });
  }
  for (const entry of asArray(report.unmatchedItemRewards)) {
    entries.push(typeof entry === "object" ? entry : { sourceName: entry, reason: "missing-local-item" });
  }
  return createUnmatchedEntriesReport(entries, options).entries;
}

function buildDiagnostics({ report = {}, stats, diff, provider = null }) {
  const warnings = reportWarnings(report);
  const unmatchedReport = createUnmatchedEntriesReport(
    unmatchedEntriesFromReport(report, { provider }),
    { provider, expectedCount: Number(stats.itemsUnmatched || 0) },
  );
  const unmatchedEntries = unmatchedReport.entries;
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
    unmatchedReport,
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
    provider: value.provider || null,
    sourceUrl: value.sourceUrl || null,
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
    unmatchedEntries: asArray(value.unmatchedEntries).map((entry) => normalizeUnmatchedEntry(entry, { provider: value.provider })),
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

function sourceAvailabilityDiagnostic(error, detectedAt = new Date()) {
  const code = String(error?.code || "").trim().toUpperCase();
  if (!SOURCE_AVAILABILITY_CODES.has(code)) return null;
  return {
    code,
    message: error?.message || "La source externe est indisponible.",
    detectedAt,
    retryable: Boolean(error?.details?.retryable),
    provider: error?.details?.provider || null,
    sourceUrl: error?.details?.sourceUrl || null,
    httpStatus: error?.details?.httpStatus ?? null,
    challenge: Boolean(error?.details?.challenge),
    preservation: error?.details?.preservation || "Le dernier snapshot MongoDB valide reste actif.",
  };
}

async function preserveCurrentDatasetSourceAvailability(adapter, error) {
  const diagnostic = sourceAvailabilityDiagnostic(error);
  if (!diagnostic || !adapter?.Model?.updateOne) return null;
  try {
    await adapter.Model.updateOne(
      { key: "current" },
      { $set: { "diagnostics.sourceAvailability": diagnostic } },
    );
    return diagnostic;
  } catch (persistenceError) {
    console.warn(`[current-dataset:${adapter.domain}] Source availability diagnostic not persisted`, {
      code: persistenceError?.code || persistenceError?.name || "UNKNOWN_ERROR",
      message: persistenceError?.message || String(persistenceError),
    });
    return null;
  }
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

async function finishPreservedDatasetRun(run, adapter, error, diagnostic) {
  if (!run || !diagnostic) return null;
  const document = await readStoredDocument(adapter).catch(() => null);
  if (!document?.data || document.key !== "current") return null;
  const completedAt = new Date();
  const warning = {
    code: diagnostic.code,
    message: diagnostic.message,
    details: error?.details || null,
    preserved: true,
  };
  const update = {
    status: "partial",
    phase: "completed",
    phaseStartedAt: completedAt,
    completedAt,
    durationMs: completedAt.getTime() - new Date(run.startedAt).getTime(),
    retrievedAt: document.source?.fetchedAt || null,
    savedAt: document.savedAt || null,
    hashAfter: document.sourceHash || null,
    changed: false,
    totalAfter: Number(document.count || 0),
    warningsCount: 1,
    errorsCount: 0,
    warnings: [warning],
    errors: [],
    sourceAvailability: diagnostic,
    diffUnavailableReason: "Source temporairement indisponible; dernier snapshot valide conservé sans écriture de données.",
  };
  await DatasetRun.updateOne(
    { _id: run._id },
    { $set: update, $unset: { stagedPayload: "" } },
  );
  const summary = adapter.summarize(document.data);
  const stats = adapter.stats(document.data, {}, summary);
  const source = typeof run.toObject === "function" ? run.toObject() : run;
  return {
    current: serializeCurrentDatasetDocument(document),
    summary,
    stats,
    report: {
      provider: adapter.provider,
      source: adapter.sourceUrl,
      preserved: true,
      sourceAvailability: diagnostic,
      warnings: [warning],
    },
    run: serializeDatasetRun({ ...source, ...update }),
  };
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
    const diagnostic = await preserveCurrentDatasetSourceAvailability(adapter, error);
    if (adapter.preserveTemporarySourceAsPartial && diagnostic) {
      const preserved = await finishPreservedDatasetRun(run, adapter, error, diagnostic);
      if (preserved) {
        console.warn(`[current-dataset:${adapter.domain}] Source temporarily unavailable; current snapshot preserved`, {
          code: diagnostic.code,
          count: preserved.current.count,
          elapsedMs: Date.now() - regenerationStartedAt,
        });
        return preserved;
      }
    }
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
    await preserveCurrentDatasetSourceAvailability(adapter, error);
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

function verifyCompressedReadback(adapter, document, expected) {
  if (!document) {
    throw new ApiError(
      500,
      `La relecture MongoDB a echoue pour ${adapter.domain}.`,
      domainCode(adapter.domain, "READBACK_FAILED"),
    );
  }
  if (document.sourceHash !== expected.sourceHash) {
    throw new ApiError(
      500,
      `Le hash relu dans MongoDB ne correspond pas au dataset ecrit pour ${adapter.domain}.`,
      domainCode(adapter.domain, "READBACK_HASH_MISMATCH"),
      { expected: expected.sourceHash, stored: document.sourceHash || null },
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
  let diff;
  if (adapter.compressData) {
    // Compressed datasets can be much larger once hydrated. Compare the new
    // hash with the stored metadata first so an idempotent regeneration never
    // holds both complete datasets plus two canonical diff copies in memory.
    const previousMetadata = await readStoredMetadata(adapter);
    const newHash = computeDatasetHash(data, { extractEntries: adapter.extractEntries });
    if (previousMetadata?.sourceHash === newHash) {
      diff = {
        previousHash: newHash,
        newHash,
        changed: false,
        added: 0,
        removed: 0,
        modified: 0,
      };
    } else {
      const previous = previousMetadata ? await readStoredDocument(adapter) : null;
      diff = diffDatasets(previous?.data || null, data, {
        extractEntries: adapter.extractEntries,
      });
      if (!previous) diff.previousHash = null;
    }
  } else {
    const previous = await readStoredDocument(adapter);
    diff = diffDatasets(previous?.data || null, data, {
      extractEntries: adapter.extractEntries,
    });
    if (!previous) diff.previousHash = null;
  }

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
    diagnostics: buildDiagnostics({ report, stats, diff, provider: adapter.provider }),
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
  const readback = adapter.compressData
    ? await readStoredMetadata(adapter)
    : await readStoredDocument(adapter);
  if (adapter.compressData) verifyCompressedReadback(adapter, readback, { count, sourceHash: diff.newHash });
  else verifyReadback(adapter, readback, { count, sourceHash: diff.newHash });

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
    current: serializeCurrentDatasetDocument(adapter.compressData ? document : readback),
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
    const diagnostic = await preserveCurrentDatasetSourceAvailability(adapter, error);
    if (adapter.preserveTemporarySourceAsPartial && diagnostic) {
      const preserved = await finishPreservedDatasetRun(run, adapter, error, diagnostic);
      if (preserved) {
        console.warn(`[current-dataset:${adapter.domain}] Source temporarily unavailable; current snapshot preserved`, {
          code: diagnostic.code,
          count: preserved.current.count,
          elapsedMs: Date.now() - regenerationStartedAt,
        });
        return preserved;
      }
    }
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
  finishPreservedDatasetRun,
  getCurrentDatasetRegeneration,
  importCurrentDataset,
  persistCurrentDataset,
  preserveCurrentDatasetSourceAvailability,
  regenerateCurrentDataset,
  serializeDatasetRun,
  sourceAvailabilityDiagnostic,
  sourceMetadata,
  staleDatasetRunUpdate,
  unmatchedEntriesFromReport,
  verifyReadback,
  verifyCompressedReadback,
};
