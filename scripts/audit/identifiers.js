const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");
const { collectAllDocuments } = require("../../src/sync/source-reader");

const data = collectAllDocuments();

function jsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(file)
      : entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

function duplicates(items, field) {
  const values = new Map();
  for (const item of items) {
    const value = item[field];
    if (!value) continue;
    if (!values.has(value)) values.set(value, []);
    values.get(value).push(item.sourceFiles);
  }
  return [...values]
    .filter(([, sources]) => sources.length > 1)
    .map(([value, sources]) => ({ value, sources }));
}

const pokemonKeys = new Set(data.pokemon.map((pokemon) => pokemon.key));
const rawPokemonKeys = new Map();
for (const file of jsonFiles(dataPath("data", "pokemon"))) {
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  const key = source.formId || source.id;
  if (!rawPokemonKeys.has(key)) rawPokemonKeys.set(key, []);
  rawPokemonKeys.get(key).push(relativeToApp(file));
}
const duplicateSourcePokemonKeys = [...rawPokemonKeys]
  .filter(([, files]) => files.length > 1)
  .map(([value, files]) => ({ value, files }));
const typeIds = new Set(data.types.map((type) => type.id));
const regionIds = new Set(data.regions.map((region) => region.id));
const weatherIds = new Set(data.weather.map((weather) => weather.id));
const futureEvolutionTargets = [];
const invalidPokemonIdentity = [];
const invalidMoveIdentity = [];
const invalidTypeReferences = [];
const invalidRegionReferences = [];
const invalidWeatherReferences = [];

for (const pokemon of data.pokemon) {
  for (const required of ["key", "id", "formId", "slug", "dexId"]) {
    if (!pokemon[required])
      invalidPokemonIdentity.push({
        source: pokemon.key || pokemon.sourceFiles,
        field: required,
      });
  }
  for (const typeId of pokemon.types || []) {
    if (!typeIds.has(typeId))
      invalidTypeReferences.push({
        source: pokemon.key,
        field: "types",
        typeId,
      });
  }
  if (!pokemon.regionId || !regionIds.has(pokemon.regionId))
    invalidRegionReferences.push({
      source: pokemon.key,
      regionId: pokemon.regionId,
    });
  for (const weatherId of pokemon.weatherBoost || []) {
    if (!weatherIds.has(weatherId))
      invalidWeatherReferences.push({
        source: pokemon.key,
        field: "weatherBoost",
        weatherId,
      });
  }
  for (const evolution of pokemon.data.evolutions || []) {
    if (!pokemonKeys.has(evolution.targetFormId))
      futureEvolutionTargets.push({
        source: pokemon.key,
        targetFormId: evolution.targetFormId,
      });
  }
}

for (const move of data.moves) {
  for (const required of ["id", "slug", "type"]) {
    if (!move[required])
      invalidMoveIdentity.push({
        source: move.id || move.sourceFiles,
        field: required,
      });
  }
  if (move.type && !typeIds.has(move.type))
    invalidTypeReferences.push({
      source: move.id,
      field: "move.type",
      typeId: move.type,
    });
}

for (const type of data.types) {
  const weatherId = type.data.weatherBoost;
  if (!weatherId || !weatherIds.has(weatherId))
    invalidWeatherReferences.push({
      source: type.id,
      field: "type.weatherBoost",
      weatherId,
    });
}

const result = {
  pokemon: data.pokemon.length,
  moves: data.moves.length,
  types: data.types.length,
  regions: data.regions.length,
  weather: data.weather.length,
  duplicatePokemonKeys: duplicates(data.pokemon, "key"),
  duplicateSourcePokemonKeys,
  duplicatePokemonSlugs: duplicates(data.pokemon, "slug"),
  duplicateMoveIds: duplicates(data.moves, "id"),
  duplicateMoveSlugs: duplicates(data.moves, "slug"),
  duplicateTypeIds: duplicates(data.types, "id"),
  duplicateRegionIds: duplicates(data.regions, "id"),
  duplicateWeatherIds: duplicates(data.weather, "id"),
  invalidPokemonIdentity,
  invalidMoveIdentity,
  invalidTypeReferences,
  invalidRegionReferences,
  invalidWeatherReferences,
  futureEvolutionTargets,
  invalidEvolutionTargets: futureEvolutionTargets.filter(
    ({ targetFormId }) => !/^[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(targetFormId),
  ),
};

result.valid =
  result.duplicatePokemonKeys.length === 0 &&
  result.duplicateSourcePokemonKeys.length === 0 &&
  result.duplicatePokemonSlugs.length === 0 &&
  result.duplicateMoveIds.length === 0 &&
  result.duplicateMoveSlugs.length === 0 &&
  result.duplicateTypeIds.length === 0 &&
  result.duplicateRegionIds.length === 0 &&
  result.duplicateWeatherIds.length === 0 &&
  result.invalidPokemonIdentity.length === 0 &&
  result.invalidMoveIdentity.length === 0 &&
  result.invalidTypeReferences.length === 0 &&
  result.invalidRegionReferences.length === 0 &&
  result.invalidWeatherReferences.length === 0 &&
  result.invalidEvolutionTargets.length === 0;

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
