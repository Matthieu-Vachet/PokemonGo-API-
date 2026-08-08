const {
  Generation,
  GlobalStat,
  Item,
  Move,
  Pokemon,
  PokemonAsset,
  PokemonAssetFamily,
  Region,
  RocketText,
  SyncRun,
  Type,
  Weather,
} = require("../models");
const { env } = require("../config/env");
const { clearCache } = require("../lib/cache");
const { collectAllDocuments } = require("./source-reader");

// Ces collections contiennent des datasets "current" générés depuis les sources
// externes. Elles sont volontairement exclues du sync JSON global afin qu'un ancien
// snapshot de PokemonGo-Data ne puisse jamais écraser une régénération MongoDB.
const EXCLUDED_CURRENT_DATASET_COLLECTIONS = Object.freeze([
  "raids",
  "eggs",
  "maxbattles",
  "researches",
  "rockets",
]);

const STATIC_SYNC_TARGETS = Object.freeze([
  { key: "pokemon", Model: Pokemon, uniqueField: "key" },
  { key: "pokemonAssets", Model: PokemonAsset, uniqueField: "formId" },
  { key: "pokemonAssetFamilies", Model: PokemonAssetFamily, uniqueField: "key" },
  { key: "items", Model: Item, uniqueField: "id" },
  { key: "rocketTexts", Model: RocketText, uniqueField: "id" },
  { key: "moves", Model: Move, uniqueField: "id" },
  { key: "types", Model: Type, uniqueField: "id" },
  { key: "weather", Model: Weather, uniqueField: "id" },
  { key: "regions", Model: Region, uniqueField: "id" },
  { key: "generations", Model: Generation, uniqueField: "id" },
]);

const STATIC_SYNC_COLLECTIONS = Object.freeze(
  STATIC_SYNC_TARGETS.map(({ Model }) => Model.collection.name),
);

const pokemonHeavyAssetPaths = {
  "data.assetForms": "",
  "data.assets.home": "",
  "data.assets.portrait": "",
  "data.assets.portraitShiny": "",
  "data.assets.locationCards": "",
  "data.assets.shuffle": "",
  assetForms: "",
  "assets.home": "",
  "assets.portrait": "",
  "assets.portraitShiny": "",
  "assets.locationCards": "",
  "assets.shuffle": "",
};

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      if (
        key !== "_id" &&
        key !== "createdAt" &&
        key !== "updatedAt" &&
        key !== "__v" &&
        value[key] !== undefined
      ) {
        result[key] = sortObject(value[key]);
      }
      return result;
    }, {});
}

function documentFingerprint(document) {
  return JSON.stringify(sortObject(document));
}

function operations(documents, uniqueField) {
  return documents.map((document) => ({
    updateOne: {
      filter: { [uniqueField]: document[uniqueField] },
      update: { $set: document },
      upsert: true,
    },
  }));
}

async function writeCollection(Model, documents, uniqueField) {
  const identifiers = documents.map((document) => document[uniqueField]);
  const existing = documents.length
    ? await Model.find({ [uniqueField]: { $in: identifiers } })
        .lean()
    : [];
  const existingById = new Map(
    existing.map((document) => [document[uniqueField], document]),
  );
  const changed = documents.filter(
    (document) => {
      const existingDocument = existingById.get(document[uniqueField]);
      if (!existingDocument) return true;
      if (existingDocument.sourceHash !== document.sourceHash) return true;
      return documentFingerprint(existingDocument) !== documentFingerprint(document);
    },
  );

  if (changed.length) {
    await Model.bulkWrite(operations(changed, uniqueField), { ordered: false });
  }
  let deleted = 0;
  if (env.syncDeleteStale && documents.length) {
    const result = await Model.deleteMany({
      [uniqueField]: { $nin: identifiers },
    });
    deleted = result.deletedCount;
  }
  return {
    created: changed.filter((document) => !existingById.has(document[uniqueField])).length,
    updated: changed.filter((document) => existingById.has(document[uniqueField])).length,
    unchanged: documents.length - changed.length,
    deleted,
  };
}

async function cleanupPokemonHeavyAssets() {
  await Pokemon.updateMany(
    {},
    {
      $unset: pokemonHeavyAssetPaths,
    },
  );
}

function buildGlobalStats(data) {
  const countBy = (documents, getter) => {
    const counts = {};
    for (const document of documents) {
      for (const value of [].concat(getter(document) || []).filter(Boolean)) {
        counts[value] = (counts[value] || 0) + 1;
      }
    }
    return counts;
  };
  return {
    totals: {
      pokemon: data.pokemon.length,
      pokemonAssets: data.pokemonAssets.length,
      pokemonAssetFamilies: data.pokemonAssetFamilies.length,
      items: data.items.length,
      rocketTexts: data.rocketTexts.length,
      moves: data.moves.length,
      types: data.types.length,
      weather: data.weather.length,
      regions: data.regions.length,
      generations: data.generations.length,
    },
    pokemonByKind: countBy(data.pokemon, (item) => item.kind),
    pokemonByGeneration: countBy(data.pokemon, (item) => item.generation),
    pokemonByRegion: countBy(data.pokemon, (item) => item.regionId),
    pokemonByType: countBy(data.pokemon, (item) => item.types),
    movesByKind: countBy(data.moves, (item) => item.kind),
    movesByType: countBy(data.moves, (item) => item.type),
    syncPolicy: {
      scope: "static-references-only",
      excludedCurrentDatasetCollections: EXCLUDED_CURRENT_DATASET_COLLECTIONS,
    },
  };
}

async function rebuildIndexes() {
  await Promise.all([
    ...STATIC_SYNC_TARGETS.map(({ Model }) => Model.syncIndexes()),
    GlobalStat.syncIndexes(),
    SyncRun.syncIndexes(),
  ]);
}

async function syncAll({ dryRun = false } = {}) {
  const startedAt = new Date();
  const data = collectAllDocuments();
  const stats = buildGlobalStats(data);
  if (dryRun) return { dryRun: true, counts: stats.totals, stats };

  const run = await SyncRun.create({ status: "running", startedAt });
  try {
    // Remove obsolete constraints before writing, for example when the data model evolves.
    await rebuildIndexes();
    const staticResults = await Promise.all(
      STATIC_SYNC_TARGETS.map(async ({ key, Model, uniqueField }) => [
        key,
        await writeCollection(Model, data[key], uniqueField),
      ]),
    );
    await cleanupPokemonHeavyAssets();
    const changes = Object.fromEntries(staticResults);
    await GlobalStat.findOneAndUpdate(
      { key: "global" },
      { $set: { data: stats, generatedAt: new Date() } },
      { upsert: true },
    );
    clearCache();
    const finishedAt = new Date();
    await SyncRun.findByIdAndUpdate(run._id, {
      $set: {
        status: "success",
        finishedAt,
        durationMs: finishedAt - startedAt,
        counts: stats.totals,
        changes,
      },
    });
    return { dryRun: false, counts: stats.totals, changes, stats };
  } catch (error) {
    const finishedAt = new Date();
    await SyncRun.findByIdAndUpdate(run._id, {
      $set: {
        status: "failed",
        finishedAt,
        durationMs: finishedAt - startedAt,
        error: { name: error.name, message: error.message },
      },
    });
    throw error;
  }
}

module.exports = {
  EXCLUDED_CURRENT_DATASET_COLLECTIONS,
  STATIC_SYNC_COLLECTIONS,
  buildGlobalStats,
  rebuildIndexes,
  syncAll,
};
