const fs = require("fs");
const path = require("path");
const { normalizeWeatherId } = require("../../src/lib/weather");

const rootDir = path.resolve(__dirname, "../..");
const write = process.argv.includes("--write");

function jsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(file);
    return entry.isFile() && entry.name.endsWith(".json") ? [file] : [];
  });
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function typeId(value) {
  const reference = value && typeof value === "object" ? value.type : value;
  return String(reference || "")
    .replace(/^POKEMON_TYPE_/, "")
    .toUpperCase();
}

function weatherId(value) {
  const reference = value && typeof value === "object" ? value.id : value;
  return normalizeWeatherId(reference);
}

const typeDirectory = path.join(rootDir, "data", "types");
const individualTypeFiles = jsonFiles(typeDirectory).filter(
  (file) => path.basename(file) !== "types.json",
);
const typeWeather = new Map(
  individualTypeFiles.map((file) => {
    const type = read(file);
    return [typeId(type.id || type.type), weatherId(type.weatherBoost)];
  }),
);

function expectedWeather(value) {
  return [
    ...new Set(
      [typeId(value.primaryType), typeId(value.secondaryType)]
        .filter(Boolean)
        .map((id) => typeWeather.get(id))
        .filter(Boolean),
    ),
  ];
}

function normalizePokemonData(value, report) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => normalizePokemonData(item, report));
    return;
  }

  for (const child of Object.values(value)) normalizePokemonData(child, report);

  if (value.primaryType !== undefined) {
    const expected = expectedWeather(value);
    if (expected.length) {
      if (JSON.stringify(value.weatherBoost) !== JSON.stringify(expected))
        report.correctedPokemonBlocks += 1;
      value.weatherBoost = expected;
    }
  } else if (Array.isArray(value.weatherBoost)) {
    const normalized = [...new Set(value.weatherBoost.map(weatherId).filter(Boolean))];
    if (JSON.stringify(value.weatherBoost) !== JSON.stringify(normalized))
      report.correctedAliases += 1;
    value.weatherBoost = normalized;
  }
}

function normalizeTypeData(value, report) {
  const normalized = weatherId(value.weatherBoost);
  if (value.weatherBoost !== normalized) report.normalizedTypeReferences += 1;
  return { ...value, weatherBoost: normalized };
}

const report = {
  mode: write ? "write" : "dry-run",
  sourceFiles: 0,
  changedFiles: 0,
  correctedPokemonBlocks: 0,
  correctedAliases: 0,
  normalizedTypeReferences: 0,
};
const changed = [];

for (const file of [
  ...jsonFiles(path.join(rootDir, "data", "pokemon")),
  ...jsonFiles(path.join(rootDir, "data", "pokemon-forms")),
]) {
  const data = read(file);
  const before = JSON.stringify(data);
  normalizePokemonData(data, report);
  report.sourceFiles += 1;
  if (before !== JSON.stringify(data)) changed.push({ file, data });
}

for (const file of jsonFiles(typeDirectory)) {
  const data = read(file);
  const before = JSON.stringify(data);
  const normalized = Array.isArray(data)
    ? data.map((type) => normalizeTypeData(type, report))
    : normalizeTypeData(data, report);
  report.sourceFiles += 1;
  if (before !== JSON.stringify(normalized)) changed.push({ file, data: normalized });
}

report.changedFiles = changed.length;
if (write)
  for (const { file, data } of changed)
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
