const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");
const { collectAllDocuments, listJsonFiles } = require("../../src/sync/source-reader");

const weatherDir = dataPath("weather");
const weather = listJsonFiles(weatherDir)
  .filter((file) => path.basename(file) !== "weather.json")
  .map((file) => JSON.parse(fs.readFileSync(file, "utf8")));
const weatherIds = new Set(weather.map((entry) => entry.id));
const data = collectAllDocuments();

const invalidPokemonReferences = data.pokemon.flatMap((pokemon) =>
  pokemon.weatherBoost
    .filter((id) => !weatherIds.has(id))
    .map((id) => ({ pokemon: pokemon.key, weather: id })),
);
const invalidTypeReferences = data.types
  .filter((type) => !weatherIds.has(type.data.weatherBoost))
  .map((type) => ({ type: type.id, weather: type.data.weatherBoost }));
const invalidBoostedTypes = weather.flatMap((entry) =>
  entry.boostedTypes
    .filter((typeId) => !data.types.some((type) => type.id === typeId))
    .map((typeId) => ({ weather: entry.id, type: typeId })),
);
const missingAssets = weather
  .filter((entry) => !entry.assets?.icon)
  .map((entry) => entry.id);

const report = {
  weather: weather.length,
  invalidPokemonReferences,
  invalidTypeReferences,
  invalidBoostedTypes,
  missingAssets,
  valid:
    weather.length === 7 &&
    invalidPokemonReferences.length === 0 &&
    invalidTypeReferences.length === 0 &&
    invalidBoostedTypes.length === 0 &&
    missingAssets.length === 0,
};

console.log(JSON.stringify(report, null, 2));
if (!report.valid) process.exitCode = 1;
