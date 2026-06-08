const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const write = process.argv.includes("--write");
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

const catalog = Object.fromEntries(
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

function normalizeMoves(value, field, location, report) {
  const moves = catalog[moveFields[field]];

  if (Array.isArray(value)) {
    for (const [index, id] of value.entries()) {
      if (typeof id !== "string" || !moves.has(id))
        report.errors.push(`${location}[${index}]: référence invalide ${String(id)}`);
    }
    return value;
  }

  if (!value || typeof value !== "object") {
    report.errors.push(`${location}: tableau ou objet attendu`);
    return value;
  }

  const ids = [];
  for (const [id, move] of Object.entries(value)) {
    const canonical = moves.get(id);
    if (!canonical) report.errors.push(`${location}.${id}: absent du catalogue`);
    else if (JSON.stringify(move) !== JSON.stringify(canonical))
      report.errors.push(`${location}.${id}: différent du catalogue`);
    ids.push(id);
  }
  report.convertedBlocks += 1;
  report.removedEmbeddedMoves += ids.length;
  return ids;
}

function normalize(value, location, report) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = location ? `${location}.${key}` : key;
    if (moveFields[key])
      value[key] = normalizeMoves(child, key, childLocation, report);
    else if (key === "maxBattle" && child && typeof child === "object") {
      const moves = new Map([...catalog.max, ...catalog.gmax]);
      if (!Array.isArray(child.moves))
        report.errors.push(`${childLocation}.moves: tableau attendu`);
      else
        for (const [index, id] of child.moves.entries())
          if (typeof id !== "string" || !moves.has(id))
            report.errors.push(
              `${childLocation}.moves[${index}]: référence invalide ${String(id)}`,
            );
    }
    else normalize(child, childLocation, report);
  }
}

const transformed = [];
const report = {
  mode: write ? "write" : "dry-run",
  sourceFiles: 0,
  changedFiles: 0,
  convertedBlocks: 0,
  removedEmbeddedMoves: 0,
  errors: [],
};

for (const file of sourceDirectories.flatMap(jsonFiles)) {
  const data = readJson(file);
  const before = JSON.stringify(data);
  normalize(data, path.relative(rootDir, file), report);
  const after = JSON.stringify(data);
  report.sourceFiles += 1;
  if (before !== after) {
    report.changedFiles += 1;
    transformed.push({ file, data });
  }
}

if (report.errors.length) {
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} else {
  if (write) {
    for (const { file, data } of transformed)
      fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
}
