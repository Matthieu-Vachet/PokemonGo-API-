const {
  Generation,
  GlobalStat,
  Move,
  Pokemon,
  Region,
  SyncRun,
  Type,
  Weather,
} = require("../models");
const { env } = require("../config/env");
const { clearCache } = require("../lib/cache");
const { collectAllDocuments } = require("./source-reader");

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
        .select(`${uniqueField} sourceHash`)
        .lean()
    : [];
  const hashes = new Map(
    existing.map((document) => [document[uniqueField], document.sourceHash]),
  );
  const changed = documents.filter(
    (document) => hashes.get(document[uniqueField]) !== document.sourceHash,
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
    created: changed.filter((document) => !hashes.has(document[uniqueField])).length,
    updated: changed.filter((document) => hashes.has(document[uniqueField])).length,
    unchanged: documents.length - changed.length,
    deleted,
  };
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
    pokemonByWeather: countBy(data.pokemon, (item) => item.weatherBoost),
  };
}

async function rebuildIndexes() {
  await Promise.all([
    Pokemon.syncIndexes(),
    Move.syncIndexes(),
    Type.syncIndexes(),
    Weather.syncIndexes(),
    Region.syncIndexes(),
    Generation.syncIndexes(),
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
    const [pokemon, moves, types, weather, regions, generations] = await Promise.all([
      writeCollection(Pokemon, data.pokemon, "key"),
      writeCollection(Move, data.moves, "id"),
      writeCollection(Type, data.types, "id"),
      writeCollection(Weather, data.weather, "id"),
      writeCollection(Region, data.regions, "id"),
      writeCollection(Generation, data.generations, "id"),
    ]);
    const changes = { pokemon, moves, types, weather, regions, generations };
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

module.exports = { buildGlobalStats, rebuildIndexes, syncAll };
