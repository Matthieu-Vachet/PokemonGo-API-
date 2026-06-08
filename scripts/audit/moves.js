const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const moveDirectories = [
  "data/moves/fast",
  "data/moves/charged",
  "data/moves/fast_elite",
  "data/moves/charged_elite",
];
const moveFields = [
  "quickMoves",
  "cinematicMoves",
  "eliteQuickMoves",
  "eliteCinematicMoves",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function jsonFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name));
}

function entries(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return [];
  return Object.entries(value);
}

const catalog = new Map();
let catalogFiles = 0;
for (const directory of moveDirectories) {
  for (const file of jsonFiles(path.join(rootDir, directory))) {
    const move = readJson(file);
    catalog.set(move.id, move);
    catalogFiles += 1;
  }
}

const embedded = new Map();
let embeddedOccurrences = 0;
for (const file of jsonFiles(pokemonDir)) {
  const pokemon = readJson(file);
  for (const field of moveFields) {
    for (const [id, move] of entries(pokemon[field])) {
      embedded.set(id, move);
      embeddedOccurrences += 1;
    }
  }
}

const catalogOnly = [...catalog.keys()].filter((id) => !embedded.has(id));
const embeddedOnly = [...embedded.keys()].filter((id) => !catalog.has(id));
const different = [...embedded.entries()]
  .filter(([id, move]) => catalog.has(id) && JSON.stringify(move) !== JSON.stringify(catalog.get(id)))
  .map(([id]) => id);

const result = {
  catalogFiles,
  catalogUnique: catalog.size,
  embeddedUnique: embedded.size,
  embeddedOccurrences,
  duplicateEmbeddedOccurrences: embeddedOccurrences - embedded.size,
  catalogOnly,
  embeddedOnly,
  different,
  readyForReferenceMigration:
    catalogOnly.length === 0 && embeddedOnly.length === 0 && different.length === 0,
};

console.log(JSON.stringify(result, null, 2));
if (!result.readyForReferenceMigration) process.exitCode = 1;
