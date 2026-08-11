const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const {
  currentEventUtils: events,
  gameMasterExplorer: explorer,
  gameMasterGenerator: generator,
  gameMasterMappings: mappings,
} = require("../lib/data-tooling");
const {
  GameMasterDiff,
  GameMasterLocalComparison,
  GameMasterSnapshot,
  GameMasterState,
  GameMasterTemplate,
  DatasetRun,
} = require("../models");

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_SIZE = 10_000;
const MAX_QUERY_LENGTH = 120;
const MAX_SEARCH_TEXT_LENGTH = 16_000;
const REINDEX_BATCH_SIZE = 2_000;
const ORPHAN_STAGING_MINIMUM_AGE_MS = 15 * 60 * 1_000;
const generationRanges = {
  1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649],
  6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1_100],
};

function snapshotRetentionLimit() {
  const configured = Number.parseInt(process.env.GAME_MASTER_SNAPSHOT_RETENTION, 10);
  return Math.max(1, Number.isFinite(configured) ? configured : 2);
}

function scalarIdentifier(value) {
  if (value === null || value === undefined || value === "") return null;
  if (!["string", "number", "boolean"].includes(typeof value)) return null;
  return String(value).slice(0, 500);
}

function compactTemplateDocument(template) {
  const searchText = [
    template.templateId,
    template.category,
    template.categoryLabel,
    template.categoryGroup,
    template.settingType,
    scalarIdentifier(template.pokemonId),
    scalarIdentifier(template.form),
    scalarIdentifier(template.costume),
    scalarIdentifier(template.itemId),
    scalarIdentifier(template.moveId),
    scalarIdentifier(template.assetBundleValue),
    scalarIdentifier(template.assetBundleSuffix),
    ...(Array.isArray(template.searchTokens) ? template.searchTokens.slice(0, 256) : []),
  ].filter(Boolean).join(" ").toLowerCase().slice(0, MAX_SEARCH_TEXT_LENGTH);
  return {
    templateId: template.templateId,
    category: template.category,
    categorySlug: template.categorySlug,
    categoryLabel: template.categoryLabel,
    categoryGroup: template.categoryGroup,
    categoryGroupLabel: template.categoryGroupLabel,
    settingType: template.settingType,
    pokemonId: scalarIdentifier(template.pokemonId),
    numericPokemonId: Number.isFinite(template.numericPokemonId) ? template.numericPokemonId : null,
    form: scalarIdentifier(template.form),
    costume: scalarIdentifier(template.costume),
    itemId: scalarIdentifier(template.itemId),
    moveId: scalarIdentifier(template.moveId),
    assetBundleValue: scalarIdentifier(template.assetBundleValue),
    assetBundleSuffix: scalarIdentifier(template.assetBundleSuffix),
    assetBundleSource: scalarIdentifier(template.assetBundleSource),
    assetBundleResolved: Boolean(template.assetBundleResolved),
    assetBundlePaths: template.assetBundlePaths || null,
    searchText,
    propertyCount: template.propertyCount,
    sizeBytes: template.sizeBytes,
    sourceHash: template.sourceHash,
    sourceUpdatedAt: template.sourceUpdatedAt || null,
    indexSchemaVersion: template.indexSchemaVersion,
    raw: template.raw,
  };
}

function snapshotCreatedAt(snapshotId) {
  const match = String(snapshotId || "").match(/^gm-(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})-/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const value = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function isExpiredOrphan(snapshotId, now = new Date(), minimumAgeMs = ORPHAN_STAGING_MINIMUM_AGE_MS) {
  const createdAt = snapshotCreatedAt(snapshotId);
  return createdAt ? now.getTime() - createdAt.getTime() >= minimumAgeMs : false;
}

function storageError(error) {
  const message = String(error?.message || "");
  if (Number(error?.code) === 8000 && /space quota|writes are blocked/i.test(message)) {
    return new ApiError(
      507,
      "Le quota de stockage MongoDB est atteint. Les snapshots incomplets ont été nettoyés ; relancez la régénération.",
      "GAME_MASTER_STORAGE_QUOTA_EXCEEDED",
      { stage: "persist", retryable: true },
    );
  }
  return error;
}

function loadDataTools() {
  return { explorer, generator, mappings, events };
}

function escapedRegex(value) {
  const input = String(value || "").trim();
  if (input.length > MAX_QUERY_LENGTH) {
    throw new ApiError(400, `La recherche est limitée à ${MAX_QUERY_LENGTH} caractères.`, "GAME_MASTER_QUERY_TOO_LONG");
  }
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pageOptions(query = {}, maximum = MAX_PAGE_SIZE) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(maximum, Math.max(1, Number.parseInt(query.limit, 10) || 50));
  return { page, limit, skip: (page - 1) * limit };
}

function snapshotIdFor(hash, date = new Date()) {
  return `gm-${date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${String(hash).slice(0, 12)}`;
}

function comparisonKey(mapping, index = 0) {
  return [mapping.templateId, mapping.pokemonId, mapping.form, mapping.assetBundleValue, mapping.assetBundleSuffix, mapping.isFemale, index]
    .map((value) => String(value ?? ""))
    .join("|");
}

function comparisonDocument(mapping, snapshotId, index) {
  return {
    snapshotId,
    comparisonKey: comparisonKey(mapping, index),
    templateId: mapping.templateId,
    pokemonId: mapping.pokemonId,
    pokemon: mapping.pokemon,
    form: mapping.form,
    costume: mapping.costume || mapping.localCostume || null,
    assetBundleValue: mapping.assetBundleValue,
    assetBundleSuffix: mapping.assetBundleSuffix,
    assetBundleSource: mapping.assetBundleSource,
    assetBundleResolved: Boolean(mapping.assetBundleResolved),
    assetBundlePaths: mapping.assetBundlePaths || null,
    isFemale: typeof mapping.isFemale === "boolean" ? mapping.isFemale : null,
    localForm: mapping.localForm,
    localCostume: mapping.localCostume,
    localPokemonFormId: mapping.localPokemonFormId,
    localIdentity: mapping.localIdentity,
    localFile: mapping.localFile,
    localAssetsRef: mapping.localAssetsRef,
    localAssetFormCount: mapping.localAssetFormCount || 0,
    localFormSource: mapping.localFormSource,
    resolutionSource: mapping.resolutionSource,
    category: mapping.sourceType === "formSettings" ? "pokemon/form-settings" : "pokemon/pokemon-settings",
    dataType: mapping.sourceType || null,
    localAsset: mapping.localAsset,
    genderVariants: mapping.genderVariants || [],
    gameAvailability: mapping.gameAvailability,
    assetAvailability: mapping.assetAvailability,
    mappingStatus: mapping.mappingStatus,
    ambiguityCount: mapping.ambiguityCount || 0,
    candidateCount: mapping.candidateCount || 0,
    ambiguousCandidates: mapping.ambiguousCandidates || [],
    ambiguityReason: mapping.ambiguityReason || null,
    ambiguityExplanation: mapping.ambiguityExplanation || null,
    localIdentityKey: mapping.localIdentityKey || null,
    variantCategory: mapping.variantCategory || null,
    searchText: [
      mapping.templateId,
      mapping.pokemonId,
      mapping.pokemon,
      mapping.form,
      mapping.costume,
      mapping.localForm,
      mapping.localCostume,
      mapping.assetBundleValue,
      mapping.assetBundleSuffix,
      mapping.localFile,
      mapping.localAssetsRef,
      mapping.mappingStatus,
      mapping.variantCategory,
      mapping.ambiguityReason,
      mapping.ambiguityExplanation,
    ].filter(Boolean).join(" ").toLowerCase(),
    raw: mapping,
  };
}

function localStatusCounts(comparisons = []) {
  return comparisons.reduce((counts, comparison) => {
    counts[comparison.mappingStatus] = (counts[comparison.mappingStatus] || 0) + 1;
    return counts;
  }, {});
}

async function currentState() {
  return GameMasterState.findOne({ key: "current" }).lean();
}

async function requireCurrentState() {
  const state = await currentState();
  if (!state) {
    throw new ApiError(404, "Aucun snapshot Game Master n'a encore été indexé.", "GAME_MASTER_NOT_INDEXED");
  }
  return state;
}

async function summary() {
  const state = await currentState();
  if (!state) {
    return {
      initialized: false,
      source: "mongodb",
      visibility: "private",
      totalTemplates: 0,
      totalCategories: 0,
      changes: { added: 0, removed: 0, modified: 0 },
      localSummary: {},
      retentionPolicy: { maximumSnapshots: snapshotRetentionLimit(), mode: snapshotRetentionLimit() ? "bounded" : "unlimited" },
    };
  }
  const snapshot = await GameMasterSnapshot.findOne({ snapshotId: state.snapshotId }).lean();
  return {
    initialized: true,
    source: "mongodb",
    visibility: "private",
    state,
    snapshot,
    totalTemplates: state.totalTemplates,
    totalCategories: state.totalCategories,
    changes: snapshot?.changes || { added: 0, removed: 0, modified: 0 },
    localSummary: snapshot?.localSummary || {},
    retentionPolicy: { maximumSnapshots: snapshotRetentionLimit(), mode: snapshotRetentionLimit() ? "bounded" : "unlimited" },
  };
}

async function categories() {
  const state = await currentState();
  if (!state) return [];
  const snapshot = await GameMasterSnapshot.findOne({ snapshotId: state.snapshotId }, { categories: 1 }).lean();
  return snapshot?.categories || [];
}

function templateFilter(snapshotId, query = {}) {
  const filter = { snapshotId };
  if (query.category) filter.category = String(query.category);
  if (query.group) filter.categoryGroup = String(query.group);
  if (query.settingType) filter.settingType = String(query.settingType);
  if (query.pokemonId) filter.numericPokemonId = Number(query.pokemonId) || -1;
  const search = String(query.q || query.search || "").trim();
  if (search) {
    if (query.match === "exact") {
      filter.templateId = new RegExp(`^${escapedRegex(search)}$`, "i");
    } else {
      const terms = search.split(/\s+/).filter(Boolean).slice(0, 6);
      filter.$and = terms.map((term) => ({ searchText: new RegExp(escapedRegex(term), "i") }));
    }
  }
  return filter;
}

function templateSort(query = {}) {
  const field = ["templateId", "category", "settingType", "sizeBytes", "propertyCount", "numericPokemonId"].includes(query.sort)
    ? query.sort
    : "templateId";
  const direction = query.order === "desc" ? -1 : 1;
  return { [field]: direction, templateId: 1 };
}

async function listTemplates(query = {}) {
  const state = await requireCurrentState();
  const pagination = pageOptions(query);
  const filter = templateFilter(state.snapshotId, query);
  if (query.localStatus) {
    const templateIds = await GameMasterLocalComparison.distinct("templateId", {
      snapshotId: state.snapshotId,
      mappingStatus: String(query.localStatus),
    });
    if (filter.templateId) {
      filter.$and = [...(filter.$and || []), { templateId: filter.templateId }, { templateId: { $in: templateIds } }];
      delete filter.templateId;
    } else {
      filter.templateId = { $in: templateIds };
    }
  }
  const [items, total] = await Promise.all([
    GameMasterTemplate.find(filter)
      .select("-raw -flattenedPaths -flattenedText -searchText -searchTokens")
      .sort(templateSort(query))
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    GameMasterTemplate.countDocuments(filter),
  ]);
  return {
    items,
    pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) },
    filters: { q: query.q || query.search || null, category: query.category || null, group: query.group || null, settingType: query.settingType || null },
  };
}

async function getTemplate(templateId) {
  const state = await requireCurrentState();
  const template = await GameMasterTemplate.findOne({ snapshotId: state.snapshotId, templateId: String(templateId) }).lean();
  if (!template) throw new ApiError(404, "Template Game Master introuvable.", "GAME_MASTER_TEMPLATE_NOT_FOUND");
  const [localComparison, history, diffs] = await Promise.all([
    GameMasterLocalComparison.find({ snapshotId: state.snapshotId, templateId: template.templateId }).sort({ pokemonId: 1, form: 1 }).lean(),
    GameMasterTemplate.find({ templateId: template.templateId })
      .select("snapshotId sourceHash sourceUpdatedAt sizeBytes propertyCount createdAt")
      .sort({ createdAt: 1 })
      .lean(),
    GameMasterDiff.find({ templateId: template.templateId }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  if (!Array.isArray(template.flattenedPaths) || !template.flattenedPaths.length) {
    template.flattenedPaths = loadDataTools().explorer.flattenObject(template.raw);
  }
  return { template, localComparison, history, diffs };
}

async function listLocalComparison(query = {}, maximum = MAX_PAGE_SIZE) {
  const state = await requireCurrentState();
  const pagination = pageOptions(query, maximum);
  const filter = { snapshotId: state.snapshotId };
  if (query.status) filter.mappingStatus = String(query.status);
  if (query.pokemonId) filter.pokemonId = Number(query.pokemonId) || -1;
  if (query.form) filter.form = new RegExp(escapedRegex(query.form), "i");
  if (query.costume === "yes") filter.$or = [{ costume: { $ne: null } }, { localCostume: { $ne: null } }];
  if (query.costume === "no") filter.costume = null;
  if (query.generation && generationRanges[query.generation]) {
    const [minimum, maximum] = generationRanges[query.generation];
    filter.pokemonId = { $gte: minimum, $lte: maximum };
  }
  if (query.shiny === "yes") filter["localAsset.shinyImage"] = { $nin: [null, ""] };
  if (query.shiny === "no") filter.$and = [...(filter.$and || []), { $or: [{ "localAsset.shinyImage": null }, { "localAsset.shinyImage": "" }] }];
  if (query.sex === "female") filter["localAsset.isFemale"] = true;
  if (query.sex === "neutral") filter["localAsset.isFemale"] = { $ne: true };
  if (query.dataType) filter.dataType = String(query.dataType);
  if (query.category) filter.category = String(query.category);
  if (query.variantCategory) filter.variantCategory = String(query.variantCategory);
  const search = String(query.q || query.search || "").trim();
  if (search) filter.searchText = new RegExp(escapedRegex(search), "i");
  const [items, total] = await Promise.all([
    GameMasterLocalComparison.find(filter).select("-searchText").sort({ pokemonId: 1, form: 1, templateId: 1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    GameMasterLocalComparison.countDocuments(filter),
  ]);
  return { items, pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) } };
}

async function listSnapshots(query = {}) {
  const pagination = pageOptions(query, 50);
  const [items, total, state] = await Promise.all([
    GameMasterSnapshot.find({}).sort({ indexedAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    GameMasterSnapshot.countDocuments({}),
    currentState(),
  ]);
  return { items: items.map((item) => ({ ...item, current: item.snapshotId === state?.snapshotId })), pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) } };
}

async function listRuns(query = {}) {
  const pagination = pageOptions(query, 100);
  const filter = { datasetKey: "game-master" };
  if (query.status) filter.status = String(query.status);
  const [items, total] = await Promise.all([
    DatasetRun.find(filter).sort({ startedAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    DatasetRun.countDocuments(filter),
  ]);
  return { items, pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) } };
}

async function getSnapshot(snapshotId) {
  const snapshot = await GameMasterSnapshot.findOne({ snapshotId: String(snapshotId) }).lean();
  if (!snapshot) throw new ApiError(404, "Snapshot Game Master introuvable.", "GAME_MASTER_SNAPSHOT_NOT_FOUND");
  return snapshot;
}

async function listDiff(query = {}, maximum = MAX_PAGE_SIZE) {
  const state = await requireCurrentState();
  const targetSnapshotId = String(query.to || query.snapshotId || state.snapshotId);
  const target = await getSnapshot(targetSnapshotId);
  const pagination = pageOptions(query, maximum);
  const filter = { snapshotId: targetSnapshotId };
  if (query.templateId) filter.templateId = String(query.templateId);
  if (query.type) filter.changeType = String(query.type);
  if (query.category) filter.category = String(query.category);
  const [items, total] = await Promise.all([
    GameMasterDiff.find(filter).sort({ templateId: 1 }).skip(pagination.skip).limit(pagination.limit).lean(),
    GameMasterDiff.countDocuments(filter),
  ]);
  return {
    from: target.previousSnapshotId,
    to: targetSnapshotId,
    items,
    pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) },
  };
}

function changeRows(previousTemplates, nextTemplates, structuredDiff) {
  const previous = new Map(previousTemplates.map((template) => [template.templateId, template]));
  const next = new Map(nextTemplates.map((template) => [template.templateId, template]));
  const rows = [];
  for (const templateId of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
    const before = previous.get(templateId);
    const after = next.get(templateId);
    if (!before) {
      rows.push({ templateId, category: after.category, settingType: after.settingType, changeType: "added", changes: [{ path: "$", type: "added", before: null, after: after.raw }], truncated: false, beforeHash: null, afterHash: after.sourceHash });
    } else if (!after) {
      rows.push({ templateId, category: before.category, settingType: before.settingType, changeType: "removed", changes: [{ path: "$", type: "removed", before: before.raw, after: null }], truncated: false, beforeHash: before.sourceHash, afterHash: null });
    } else if (before.sourceHash !== after.sourceHash) {
      const diff = structuredDiff(before.raw, after.raw);
      rows.push({ templateId, category: after.category, settingType: after.settingType, changeType: "modified", changes: diff.changes, truncated: diff.truncated, beforeHash: before.sourceHash, afterHash: after.sourceHash });
    }
  }
  return rows;
}

async function cleanupStaging(snapshotId) {
  await Promise.all([
    GameMasterTemplate.deleteMany({ snapshotId }),
    GameMasterLocalComparison.deleteMany({ snapshotId }),
    GameMasterDiff.deleteMany({ snapshotId }),
    GameMasterSnapshot.deleteOne({ snapshotId }),
  ]);
}

async function cleanupOrphanedSnapshots({ now = new Date(), minimumAgeMs = ORPHAN_STAGING_MINIMUM_AGE_MS } = {}) {
  const [state, snapshots, templateIds, comparisonIds, diffIds] = await Promise.all([
    currentState(),
    GameMasterSnapshot.find({}).select("snapshotId").lean(),
    GameMasterTemplate.distinct("snapshotId"),
    GameMasterLocalComparison.distinct("snapshotId"),
    GameMasterDiff.distinct("snapshotId"),
  ]);
  const validIds = new Set([
    state?.snapshotId,
    ...snapshots.map((snapshot) => snapshot.snapshotId),
  ].filter(Boolean));
  const storedIds = new Set([...templateIds, ...comparisonIds, ...diffIds].filter(Boolean));
  const orphanIds = [...storedIds].filter((snapshotId) => (
    !validIds.has(snapshotId) && isExpiredOrphan(snapshotId, now, minimumAgeMs)
  ));
  if (!orphanIds.length) return { snapshots: 0, templates: 0, comparisons: 0, diffs: 0 };
  const [templates, comparisons, diffs] = await Promise.all([
    GameMasterTemplate.deleteMany({ snapshotId: { $in: orphanIds } }),
    GameMasterLocalComparison.deleteMany({ snapshotId: { $in: orphanIds } }),
    GameMasterDiff.deleteMany({ snapshotId: { $in: orphanIds } }),
  ]);
  const diagnostics = {
    snapshots: orphanIds.length,
    templates: templates.deletedCount || 0,
    comparisons: comparisons.deletedCount || 0,
    diffs: diffs.deletedCount || 0,
  };
  console.info("[game-master-explorer] orphan staging cleaned", diagnostics);
  return diagnostics;
}

async function enforceSnapshotRetention(activeSnapshotId) {
  const limit = snapshotRetentionLimit();
  if (!limit) return { maximumSnapshots: 0, removed: 0 };
  const keep = await GameMasterSnapshot.find({}).sort({ indexedAt: -1 }).limit(limit).select("snapshotId").lean();
  const keepIds = new Set([activeSnapshotId, ...keep.map((snapshot) => snapshot.snapshotId)]);
  const expired = await GameMasterSnapshot.find({ snapshotId: { $nin: [...keepIds] } }).select("snapshotId").lean();
  const expiredIds = expired.map((snapshot) => snapshot.snapshotId);
  if (!expiredIds.length) return { maximumSnapshots: limit, removed: 0 };
  await Promise.all([
    GameMasterTemplate.deleteMany({ snapshotId: { $in: expiredIds } }),
    GameMasterLocalComparison.deleteMany({ snapshotId: { $in: expiredIds } }),
    GameMasterDiff.deleteMany({ snapshotId: { $in: expiredIds } }),
    GameMasterSnapshot.deleteMany({ snapshotId: { $in: expiredIds } }),
  ]);
  return { maximumSnapshots: limit, removed: expiredIds.length };
}

async function regenerate() {
  const startedAt = Date.now();
  const run = await DatasetRun.create({
    datasetKey: "game-master",
    provider: "PokeMiners-game_masters",
    sourceUrl: "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json",
    status: "running",
    startedAt: new Date(startedAt),
  });
  let cleanup;
  let generated;
  try {
    cleanup = await cleanupOrphanedSnapshots().catch((error) => {
    console.warn("[game-master-explorer] orphan cleanup failed", { message: error.message });
    return { snapshots: 0, templates: 0, comparisons: 0, diffs: 0, warning: error.message };
    });
    const { generator } = loadDataTools();
    generated = await generator.generateGameMasterExplorerIndex();
  } catch (error) {
    await DatasetRun.updateOne({ _id: run._id }, { $set: { status: "failed", completedAt: new Date(), durationMs: Date.now() - startedAt, errorsCount: 1, errors: [{ message: error.message }] } }).catch(() => undefined);
    throw error;
  }
  const { explorer } = loadDataTools();
  const payload = generated.data;
  const existingState = await currentState();
  if (existingState?.sourceHash === payload.metadata.sourceHash) {
    const now = new Date();
    const state = await GameMasterState.findOneAndUpdate(
      { key: "current" },
      { $set: { lastCheckedAt: now, sourceUpdatedAt: payload.metadata.sourceUpdatedAt || null }, $inc: { checkCount: 1 } },
      { new: true },
    ).lean();
    const result = {
      success: true,
      changed: false,
      snapshotId: state.snapshotId,
      previousHash: state.sourceHash,
      currentHash: state.sourceHash,
      totalTemplates: state.totalTemplates,
      categories: await categories(),
      added: 0,
      removed: 0,
      modified: 0,
      matchedLocal: generated.report.localStatusCounts?.matched || 0,
      unmatchedLocal: Number(generated.report.localComparisons || 0) - Number(generated.report.localStatusCounts?.matched || 0),
      warnings: [],
      errors: [],
      durationMs: Date.now() - startedAt,
      cleanup,
    };
    await DatasetRun.updateOne({ _id: run._id }, { $set: { status: "unchanged", completedAt: new Date(), durationMs: result.durationMs, retrievedAt: payload.metadata.retrievedAt, hashBefore: state.sourceHash, hashAfter: state.sourceHash, changed: false, totalBefore: state.totalTemplates, totalAfter: state.totalTemplates, matchedCount: result.matchedLocal, unmatchedCount: result.unmatchedLocal, warningsCount: 0, errorsCount: 0, warnings: [], errors: [] } });
    return result;
  }

  const indexedAt = new Date();
  const snapshotId = snapshotIdFor(payload.metadata.sourceHash, indexedAt);
  try {
    const previousTemplates = existingState
      ? await GameMasterTemplate.find({ snapshotId: existingState.snapshotId }).lean()
      : [];
    const diffs = existingState
      ? changeRows(previousTemplates, payload.templates, explorer.structuredDiff)
      : [];
    const changesByType = {
      added: diffs.filter((diff) => diff.changeType === "added"),
      removed: diffs.filter((diff) => diff.changeType === "removed"),
      modified: diffs.filter((diff) => diff.changeType === "modified"),
    };
    const categoryStats = explorer.categorySummary(payload.templates, changesByType);
    const comparisons = payload.localComparison.map((mapping, index) => comparisonDocument(mapping, snapshotId, index));
    const localSummary = localStatusCounts(comparisons);

    if (payload.templates.length) {
      await GameMasterTemplate.insertMany(
        payload.templates.map((template) => ({ ...compactTemplateDocument(template), snapshotId })),
        { ordered: false },
      );
    }
    if (comparisons.length) await GameMasterLocalComparison.insertMany(comparisons, { ordered: false });
    if (diffs.length) await GameMasterDiff.insertMany(diffs.map((diff) => ({ ...diff, snapshotId, previousSnapshotId: existingState?.snapshotId || null })), { ordered: false });
    await GameMasterSnapshot.create({
      snapshotId,
      previousSnapshotId: existingState?.snapshotId || null,
      sourceHash: payload.metadata.sourceHash,
      provider: payload.metadata.provider,
      sourceUrl: payload.metadata.source,
      sourceUpdatedAt: payload.metadata.sourceUpdatedAt || null,
      retrievedAt: payload.metadata.retrievedAt,
      indexedAt,
      totalTemplates: payload.metadata.totalTemplates,
      totalCategories: payload.metadata.totalCategories,
      categories: categoryStats,
      changes: { added: changesByType.added.length, removed: changesByType.removed.length, modified: changesByType.modified.length },
      localSummary,
      warnings: [],
      durationMs: Date.now() - startedAt,
      schemaVersion: payload.metadata.schemaVersion,
      indexSchemaVersion: payload.metadata.indexSchemaVersion,
    });
    await GameMasterState.findOneAndUpdate(
      { key: "current" },
      { $set: {
        snapshotId,
        sourceHash: payload.metadata.sourceHash,
        sourceUpdatedAt: payload.metadata.sourceUpdatedAt || null,
        retrievedAt: payload.metadata.retrievedAt,
        lastCheckedAt: indexedAt,
        totalTemplates: payload.metadata.totalTemplates,
        totalCategories: payload.metadata.totalCategories,
        indexSchemaVersion: payload.metadata.indexSchemaVersion,
      }, $inc: { checkCount: 1 } },
      { upsert: true, new: true, runValidators: true },
    );
    const retention = await enforceSnapshotRetention(snapshotId).catch((error) => {
      console.warn("[game-master-explorer] retention cleanup failed", { snapshotId, message: error.message });
      return { maximumSnapshots: snapshotRetentionLimit(), removed: 0, warning: error.message };
    });
    console.info("[game-master-explorer] snapshot activated", { snapshotId, totalTemplates: payload.metadata.totalTemplates, changes: { added: changesByType.added.length, removed: changesByType.removed.length, modified: changesByType.modified.length } });
    const result = {
      success: true,
      source: payload.metadata.source,
      sourceUpdatedAt: payload.metadata.sourceUpdatedAt,
      retrievedAt: payload.metadata.retrievedAt,
      snapshotId,
      previousHash: existingState?.sourceHash || null,
      currentHash: payload.metadata.sourceHash,
      changed: true,
      totalTemplates: payload.metadata.totalTemplates,
      categories: categoryStats,
      added: changesByType.added.length,
      removed: changesByType.removed.length,
      modified: changesByType.modified.length,
      matchedLocal: localSummary.matched || 0,
      unmatchedLocal: comparisons.length - Number(localSummary.matched || 0),
      warnings: [],
      errors: [],
      durationMs: Date.now() - startedAt,
      retention,
      cleanup,
    };
    const unmatchedEntries = comparisons.filter((comparison) => comparison.mappingStatus !== "matched").map((comparison) => ({
      sourceId: comparison.templateId,
      sourceName: comparison.pokemon,
      sourceForm: comparison.form,
      sourceCostume: comparison.costume,
      sourceImage: comparison.localAsset?.image || null,
      reason: comparison.mappingStatus,
      candidates: comparison.ambiguousCandidates || [],
      localFile: comparison.localFile || null,
      sourcePayload: comparison.raw || {},
    }));
    await DatasetRun.updateOne({ _id: run._id }, { $set: { status: result.unmatchedLocal ? "partial" : "success", completedAt: new Date(), durationMs: result.durationMs, retrievedAt: payload.metadata.retrievedAt, savedAt: indexedAt, hashBefore: existingState?.sourceHash || null, hashAfter: payload.metadata.sourceHash, changed: true, totalBefore: Number(existingState?.totalTemplates || 0), totalAfter: payload.metadata.totalTemplates, added: result.added, removed: result.removed, modified: result.modified, matchedCount: result.matchedLocal, unmatchedCount: result.unmatchedLocal, warningsCount: 0, errorsCount: 0, unmatchedEntries, warnings: [], errors: [] } });
    return result;
  } catch (error) {
    await cleanupStaging(snapshotId).catch(() => undefined);
    await DatasetRun.updateOne({ _id: run._id }, { $set: { status: "failed", completedAt: new Date(), durationMs: Date.now() - startedAt, errorsCount: 1, errors: [{ message: error.message, code: error.code || null }] } }).catch(() => undefined);
    throw storageError(error);
  }
}

function reindexContinuation(state, phase, offset) {
  return {
    phase,
    offset,
    snapshotId: state.snapshotId,
  };
}

function reindexProgress(state, phase, offset, total) {
  return {
    success: true,
    status: "running",
    snapshotId: state.snapshotId,
    phase,
    processed: Math.min(offset, total),
    total,
    continuation: reindexContinuation(state, phase, offset),
  };
}

async function reindex(options = {}) {
  const state = await requireCurrentState();
  const phase = String(options.phase || "templates");
  const offset = Math.max(0, Number.parseInt(options.offset, 10) || 0);
  if (options.snapshotId && String(options.snapshotId) !== state.snapshotId) {
    throw new ApiError(409, "Le snapshot Game Master a changé pendant la réindexation.", "GAME_MASTER_REINDEX_SNAPSHOT_CHANGED");
  }
  if (!["templates", "comparisons"].includes(phase)) {
    throw new ApiError(400, "Phase de réindexation Game Master invalide.", "GAME_MASTER_REINDEX_PHASE_INVALID");
  }
  const { explorer, mappings, events } = loadDataTools();
  const stored = await GameMasterTemplate.find({ snapshotId: state.snapshotId }).select("raw").lean();
  const gameMaster = stored.map((template) => template.raw);
  const indexed = explorer.buildGameMasterExplorerIndex(gameMaster, { sourceUpdatedAt: state.sourceUpdatedAt, retrievedAt: state.retrievedAt });
  const local = mappings.buildGameMasterPokemonMappings(gameMaster, events.loadPokemonEntries(dataPath()), { sourceUpdatedAt: state.sourceUpdatedAt, retrievedAt: state.retrievedAt });
  if (phase === "templates") {
    const batch = indexed.templates.slice(offset, offset + REINDEX_BATCH_SIZE);
    const operations = batch.map((template) => ({
      updateOne: {
        filter: { snapshotId: state.snapshotId, templateId: template.templateId },
        update: {
          $set: compactTemplateDocument(template),
          $unset: { searchTokens: "", flattenedPaths: "", flattenedText: "" },
        },
      },
    }));
    if (operations.length) await GameMasterTemplate.bulkWrite(operations, { ordered: false });
    const nextOffset = offset + batch.length;
    if (nextOffset < indexed.templates.length) {
      return reindexProgress(state, "templates", nextOffset, indexed.templates.length);
    }
    await GameMasterLocalComparison.deleteMany({ snapshotId: state.snapshotId });
    return reindexProgress(state, "comparisons", 0, local.mappings.length);
  }

  const comparisons = local.mappings.map((mapping, index) => comparisonDocument(mapping, state.snapshotId, index));
  const comparisonBatch = comparisons.slice(offset, offset + REINDEX_BATCH_SIZE);
  if (comparisonBatch.length) {
    await GameMasterLocalComparison.bulkWrite(comparisonBatch.map((comparison) => ({
      updateOne: {
        filter: { snapshotId: state.snapshotId, comparisonKey: comparison.comparisonKey },
        update: { $set: comparison },
        upsert: true,
      },
    })), { ordered: false });
  }
  const nextOffset = offset + comparisonBatch.length;
  if (nextOffset < comparisons.length) {
    return reindexProgress(state, "comparisons", nextOffset, comparisons.length);
  }
  const localSummary = localStatusCounts(comparisons);
  await Promise.all([
    GameMasterState.updateOne({ key: "current" }, { $set: { indexSchemaVersion: indexed.metadata.indexSchemaVersion, lastCheckedAt: new Date() } }),
    GameMasterSnapshot.updateOne({ snapshotId: state.snapshotId }, { $set: { indexSchemaVersion: indexed.metadata.indexSchemaVersion, categories: indexed.categories, localSummary } }),
  ]);
  return { success: true, status: "completed", snapshotId: state.snapshotId, totalTemplates: indexed.templates.length, totalCategories: indexed.categories.length, localSummary };
}

async function exportData(query = {}) {
  const scope = String(query.scope || "templates");
  if (scope === "comparison") {
    const result = await listLocalComparison({ ...query, page: 1, limit: MAX_EXPORT_SIZE }, MAX_EXPORT_SIZE);
    return result.items;
  }
  if (scope === "diff") {
    const result = await listDiff({ ...query, page: 1, limit: MAX_EXPORT_SIZE }, MAX_EXPORT_SIZE);
    return result.items;
  }
  const state = await requireCurrentState();
  const filter = templateFilter(state.snapshotId, query);
  if (query.localStatus) {
    const templateIds = await GameMasterLocalComparison.distinct("templateId", { snapshotId: state.snapshotId, mappingStatus: String(query.localStatus) });
    if (filter.templateId) {
      filter.$and = [...(filter.$and || []), { templateId: filter.templateId }, { templateId: { $in: templateIds } }];
      delete filter.templateId;
    } else {
      filter.templateId = { $in: templateIds };
    }
  }
  return GameMasterTemplate.find(filter)
    .select(query.includeRaw === "true" ? "-flattenedText -searchText -searchTokens" : "-raw -flattenedPaths -flattenedText -searchText -searchTokens")
    .sort(templateSort(query))
    .limit(MAX_EXPORT_SIZE)
    .lean();
}

module.exports = {
  MAX_EXPORT_SIZE,
  REINDEX_BATCH_SIZE,
  categories,
  changeRows,
  cleanupOrphanedSnapshots,
  compactTemplateDocument,
  comparisonDocument,
  escapedRegex,
  enforceSnapshotRetention,
  exportData,
  getSnapshot,
  getTemplate,
  listDiff,
  listLocalComparison,
  listRuns,
  listSnapshots,
  listTemplates,
  localStatusCounts,
  isExpiredOrphan,
  pageOptions,
  regenerate,
  reindex,
  snapshotIdFor,
  storageError,
  summary,
  templateFilter,
};
