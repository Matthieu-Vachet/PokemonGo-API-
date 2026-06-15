const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const sourceDir = path.join(rootDir, "asset", "pokemonShuffle");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const reportFile = path.join(rootDir, "data", "pokemon-shuffle-import-report.json");
const write = process.argv.includes("--write");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/pokemonShuffle";

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  );
}

function same(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function parse(filename) {
  const match = filename.match(/^(\d+)(.*)\.png$/i);
  if (!match) return null;
  const suffix = match[2].replace(/^[_\s]+/, "").replace(/\s+/g, "_");
  const codes = suffix.split("_").filter(Boolean);
  return {
    dexNr: Number(match[1]),
    variant: {
      id: filename.replace(/\.png$/i, ""),
      filename,
      codes,
      shiny: codes.at(-1) === "s",
      image: `${remoteBase}/${encodeURIComponent(filename)}`,
    },
  };
}

const byDex = new Map();
const invalidFiles = [];
for (const filename of fs.readdirSync(sourceDir).sort()) {
  if (filename === "index.json") continue;
  const parsed = parse(filename);
  if (!parsed) {
    invalidFiles.push(filename);
    continue;
  }
  const variants = byDex.get(parsed.dexNr) || [];
  variants.push(parsed.variant);
  byDex.set(parsed.dexNr, variants);
}

const changedFiles = [];
const matchedDex = new Set();
for (const filename of fs.readdirSync(pokemonDir).filter((name) => name.endsWith(".json"))) {
  const file = path.join(pokemonDir, filename);
  const pokemon = read(file);
  const variants = byDex.get(pokemon.dexNr);
  if (!variants) continue;
  matchedDex.add(pokemon.dexNr);
  const next = {
    ...pokemon,
    assets: {
      ...(pokemon.assets || {}),
      shuffle: { source: "pokemon-shuffle", variants },
    },
  };
  if (same(next, pokemon)) continue;
  changedFiles.push(path.relative(rootDir, file));
  if (write) writeJson(file, next);
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: write ? "write" : "dry-run",
  sourceImages: [...byDex.values()].reduce((sum, variants) => sum + variants.length, 0),
  sourceDex: byDex.size,
  matchedDex: matchedDex.size,
  changedFiles: changedFiles.length,
  unmatchedDex: [...byDex.keys()].filter((dexNr) => !matchedDex.has(dexNr)).sort(),
  invalidFiles,
  note: "Les codes sont conservés bruts; seul le suffixe final s est identifié comme shiny.",
};
if (write) writeJson(reportFile, report);
console.log(JSON.stringify(report, null, 2));
