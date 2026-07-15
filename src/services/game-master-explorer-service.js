const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const {
  GameMasterDiff,
  GameMasterLocalComparison,
  GameMasterSnapshot,
  GameMasterState,
  GameMasterTemplate,
} = require("../models");

const MAX_PAGE_SIZE = 100;
const MAX_EXPORT_SIZE = 10_000;
const MAX_QUERY_LENGTH = 120;
const generationRanges = {
  1: [1, 151], 2: [152, 251], 3: [252, 386], 4: [387, 493], 5: [494, 649],
  6: [650, 721], 7: [722, 809], 8: [810, 905], 9: [906, 1_100],
};

function snapshotRetentionLimit() {
  return Math.max(0, Number.parseInt(process.env.GAME_MASTER_SNAPSHOT_RETENTION, 10) || 0);
}

function loadDataTools() {
  const explorer = require(dataPath("scripts", "lib", "game-master-explorer.js"));
  const generator = require(dataPath("scripts", "generateGameMasterExplorerIndex.js"));
  const mappings = require(dataPath("scripts", "generateGameMasterPokemonMappings.js"));
  const events = require(dataPath("scripts", "lib", "current-event-utils.js"));
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
  return [mapping.templateId, mapping.pokemonId, mapping.form, mapping.assetBundleValue, mapping.assetBundleSuffix, index]
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
    gameAvailability: mapping.gameAvailability,
    assetAvailability: mapping.assetAvailability,
    mappingStatus: mapping.mappingStatus,
    ambiguityCount: mapping.ambiguityCount || 0,
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
  const { explorer, generator } = loadDataTools();
  const generated = await generator.generateGameMasterExplorerIndex();
  const payload = generated.data;
  const existingState = await currentState();
  if (existingState?.sourceHash === payload.metadata.sourceHash) {
    const now = new Date();
    const state = await GameMasterState.findOneAndUpdate(
      { key: "current" },
      { $set: { lastCheckedAt: now, sourceUpdatedAt: payload.metadata.sourceUpdatedAt || null }, $inc: { checkCount: 1 } },
      { new: true },
    ).lean();
    return {
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
    };
  }

  const indexedAt = new Date();
  const snapshotId = snapshotIdFor(payload.metadata.sourceHash, indexedAt);
  try {
    const previousTemplates = existingState
      ? await GameMasterTemplate.find({ snapshotId: existingState.snapshotId }).lean()
      : [];
    const diffs = changeRows(previousTemplates, payload.templates, explorer.structuredDiff);
    const changesByType = {
      added: diffs.filter((diff) => diff.changeType === "added"),
      removed: diffs.filter((diff) => diff.changeType === "removed"),
      modified: diffs.filter((diff) => diff.changeType === "modified"),
    };
    const categoryStats = explorer.categorySummary(payload.templates, changesByType);
    const comparisons = payload.localComparison.map((mapping, index) => comparisonDocument(mapping, snapshotId, index));
    const localSummary = localStatusCounts(comparisons);

    if (payload.templates.length) await GameMasterTemplate.insertMany(payload.templates.map((template) => ({ ...template, snapshotId })), { ordered: false });
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
      }, $inc: { checkCount: 1 }, $setOnInsert: { checkCount: 0 } },
      { upsert: true, new: true, runValidators: true },
    );
    const retention = await enforceSnapshotRetention(snapshotId).catch((error) => {
      console.warn("[game-master-explorer] retention cleanup failed", { snapshotId, message: error.message });
      return { maximumSnapshots: snapshotRetentionLimit(), removed: 0, warning: error.message };
    });
    console.info("[game-master-explorer] snapshot activated", { snapshotId, totalTemplates: payload.metadata.totalTemplates, changes: { added: changesByType.added.length, removed: changesByType.removed.length, modified: changesByType.modified.length } });
    return {
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
    };
  } catch (error) {
    await cleanupStaging(snapshotId).catch(() => undefined);
    throw error;
  }
}

async function reindex() {
  const state = await requireCurrentState();
  const { explorer, mappings, events } = loadDataTools();
  const stored = await GameMasterTemplate.find({ snapshotId: state.snapshotId }).select("raw").lean();
  const gameMaster = stored.map((template) => template.raw);
  const indexed = explorer.buildGameMasterExplorerIndex(gameMaster, { sourceUpdatedAt: state.sourceUpdatedAt, retrievedAt: state.retrievedAt });
  const local = mappings.buildGameMasterPokemonMappings(gameMaster, events.loadPokemonEntries(dataPath()), { sourceUpdatedAt: state.sourceUpdatedAt, retrievedAt: state.retrievedAt });
  const operations = indexed.templates.map((template) => ({
    updateOne: { filter: { snapshotId: state.snapshotId, templateId: template.templateId }, update: { $set: template } },
  }));
  if (operations.length) await GameMasterTemplate.bulkWrite(operations, { ordered: false });
  await GameMasterLocalComparison.deleteMany({ snapshotId: state.snapshotId });
  const comparisons = local.mappings.map((mapping, index) => comparisonDocument(mapping, state.snapshotId, index));
  if (comparisons.length) await GameMasterLocalComparison.insertMany(comparisons, { ordered: false });
  const localSummary = localStatusCounts(comparisons);
  await Promise.all([
    GameMasterState.updateOne({ key: "current" }, { $set: { indexSchemaVersion: indexed.metadata.indexSchemaVersion, lastCheckedAt: new Date() } }),
    GameMasterSnapshot.updateOne({ snapshotId: state.snapshotId }, { $set: { indexSchemaVersion: indexed.metadata.indexSchemaVersion, categories: indexed.categories, localSummary } }),
  ]);
  return { success: true, snapshotId: state.snapshotId, totalTemplates: indexed.templates.length, totalCategories: indexed.categories.length, localSummary };
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
  categories,
  changeRows,
  comparisonDocument,
  escapedRegex,
  enforceSnapshotRetention,
  exportData,
  getSnapshot,
  getTemplate,
  listDiff,
  listLocalComparison,
  listSnapshots,
  listTemplates,
  localStatusCounts,
  pageOptions,
  regenerate,
  reindex,
  snapshotIdFor,
  summary,
  templateFilter,
};
