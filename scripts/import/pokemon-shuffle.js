const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const sourceDir = path.join(rootDir, "asset", "pokemonShuffle");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const reportFile = path.join(rootDir, "data", "pokemon-shuffle-import-report.json");
const write = process.argv.includes("--write");

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(file)
      : entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

function parse(filename) {
  const match = filename.match(/^(\d+)(.*)\.png$/i);
  if (!match) return null;
  const suffix = match[2].replace(/^[_\s]+/, "").replace(/\s+/g, "_");
  const codes = suffix.split("_").filter(Boolean);
  return {
    dexNr: Number(match[1]),
    variant: { filename, codes, shiny: codes.at(-1) === "s" },
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
for (const file of [...files(pokemonDir), ...files(formsDir)]) {
  const pokemon = read(file);
  if (byDex.has(pokemon.dexNr)) matchedDex.add(pokemon.dexNr);
  if (!pokemon.assets?.shuffle) continue;
  const next = { ...pokemon, assets: { ...pokemon.assets } };
  delete next.assets.shuffle;
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
  note: "Les assets Shuffle restent dans la galerie et ne sont pas intégrés aux fiches Pokémon.",
};
if (write) writeJson(reportFile, report);
console.log(JSON.stringify(report, null, 2));
