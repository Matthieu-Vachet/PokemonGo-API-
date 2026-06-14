const { collectAllDocuments } = require("../../src/sync/source-reader");

const data = collectAllDocuments();
const weatherIds = new Set(data.weather.map((weather) => weather.id));
const weatherByType = new Map(
  data.weather.flatMap((weather) =>
    weather.boostedTypes.map((type) => [type, weather.id]),
  ),
);

const invalidReferences = [];
const mismatches = [];
for (const pokemon of data.pokemon) {
  const expected = [
    ...new Set(pokemon.types.map((type) => weatherByType.get(type)).filter(Boolean)),
  ];
  const actual = pokemon.weatherBoost || [];
  for (const weather of actual)
    if (!weatherIds.has(weather))
      invalidReferences.push({ pokemon: pokemon.key, weather });
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    mismatches.push({
      pokemon: pokemon.key,
      kind: pokemon.kind,
      types: pokemon.types,
      expected,
      actual,
      sourceFiles: pokemon.sourceFiles,
    });
}

const typeCoverage = data.types
  .filter((type) => !weatherByType.has(type.id))
  .map((type) => type.id);
const result = {
  weather: data.weather.length,
  pokemon: data.pokemon.length,
  invalidReferences,
  typeCoverage,
  mismatches,
  valid:
    data.weather.length === 7 &&
    invalidReferences.length === 0 &&
    typeCoverage.length === 0 &&
    mismatches.length === 0,
};

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
