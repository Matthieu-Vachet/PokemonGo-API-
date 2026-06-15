const fs = require("fs");
const path = require("path");
const { collectAllDocuments } = require("../../src/sync/source-reader");

const data = collectAllDocuments();
const rootDir = path.resolve(__dirname, "../..");

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
for (const file of [
  ...jsonFiles(path.join(rootDir, "data", "pokemon")),
  ...jsonFiles(path.join(rootDir, "data", "pokemon-forms")),
]) {
  const source = JSON.parse(fs.readFileSync(file, "utf8"));
  const key = source.formId || source.id;
  if (!rawPokemonKeys.has(key)) rawPokemonKeys.set(key, []);
  rawPokemonKeys.get(key).push(path.relative(rootDir, file));
}
const duplicateSourcePokemonKeys = [...rawPokemonKeys]
  .filter(([, files]) => files.length > 1)
  .map(([value, files]) => ({ value, files }));
const typeIds = new Set(data.types.map((type) => type.id));
const futureEvolutionTargets = [];
const invalidPokemonIdentity = [];
const invalidMoveIdentity = [];
const invalidTypeReferences = [];

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

const result = {
  pokemon: data.pokemon.length,
  moves: data.moves.length,
  types: data.types.length,
  duplicatePokemonKeys: duplicates(data.pokemon, "key"),
  duplicateSourcePokemonKeys,
  duplicatePokemonSlugs: duplicates(data.pokemon, "slug"),
  duplicateMoveIds: duplicates(data.moves, "id"),
  duplicateMoveSlugs: duplicates(data.moves, "slug"),
  duplicateTypeIds: duplicates(data.types, "id"),
  invalidPokemonIdentity,
  invalidMoveIdentity,
  invalidTypeReferences,
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
  result.invalidPokemonIdentity.length === 0 &&
  result.invalidMoveIdentity.length === 0 &&
  result.invalidTypeReferences.length === 0 &&
  result.invalidEvolutionTargets.length === 0;

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
