const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const sourceDirectories = ["data/pokemon", "data/pokemon-forms"];
const moveFields = {
  quickMoves: "fast",
  cinematicMoves: "charged",
  eliteQuickMoves: "fast_elite",
  eliteCinematicMoves: "charged_elite",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function jsonFiles(directory) {
  const absolute = path.join(rootDir, directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(relative)
      : entry.name.endsWith(".json")
        ? [path.join(rootDir, relative)]
        : [];
  });
}

function catalogByCategory() {
  return Object.fromEntries(
    [...new Set([...Object.values(moveFields), "max", "gmax"])].map((category) => [
      category,
      new Map(
        jsonFiles(`data/moves/${category}`).map((file) => {
          const move = readJson(file);
          return [move.id, move];
        }),
      ),
    ]),
  );
}

const catalog = catalogByCategory();
const references = new Set();
const embedded = new Set();
const missing = [];
const different = [];
const invalid = [];
let referenceOccurrences = 0;
let embeddedOccurrences = 0;

function inspectMoves(value, field, location) {
  const category = moveFields[field];
  const moves = catalog[category];

  if (Array.isArray(value)) {
    for (const [index, id] of value.entries()) {
      referenceOccurrences += 1;
      if (typeof id !== "string") {
        invalid.push(`${location}[${index}]`);
        continue;
      }
      references.add(id);
      if (!moves.has(id)) missing.push(`${location}[${index}]: ${id}`);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    invalid.push(location);
    return;
  }

  for (const [id, move] of Object.entries(value)) {
    embeddedOccurrences += 1;
    embedded.add(id);
    if (!moves.has(id)) missing.push(`${location}.${id}`);
    else if (JSON.stringify(move) !== JSON.stringify(moves.get(id)))
      different.push(`${location}.${id}`);
  }
}

function inspectMaxMoves(value, location) {
  const moves = new Map([...catalog.max, ...catalog.gmax]);
  if (!Array.isArray(value)) {
    invalid.push(location);
    return;
  }
  for (const [index, id] of value.entries()) {
    referenceOccurrences += 1;
    if (typeof id !== "string") {
      invalid.push(`${location}[${index}]`);
      continue;
    }
    references.add(id);
    if (!moves.has(id)) missing.push(`${location}[${index}]: ${id}`);
  }
}

function inspect(value, location) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = location ? `${location}.${key}` : key;
    if (moveFields[key]) inspectMoves(child, key, childLocation);
    if (key === "maxBattle" && child && typeof child === "object")
      inspectMaxMoves(child.moves, `${childLocation}.moves`);
    inspect(child, childLocation);
  }
}

const sourceFiles = sourceDirectories.flatMap(jsonFiles);
for (const file of sourceFiles)
  inspect(readJson(file), path.relative(rootDir, file));

const result = {
  sourceFiles: sourceFiles.length,
  catalogFiles: Object.values(catalog).reduce((total, moves) => total + moves.size, 0),
  catalogUnique: new Set(
    Object.values(catalog).flatMap((moves) => [...moves.keys()]),
  ).size,
  referenceOccurrences,
  referenceUnique: references.size,
  embeddedOccurrences,
  embeddedUnique: embedded.size,
  missing,
  different,
  invalid,
  normalized: embeddedOccurrences === 0,
  valid: missing.length === 0 && different.length === 0 && invalid.length === 0,
};

console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
