const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

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
  const absolute = dataPathFromRelative(directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(relative)
      : entry.name.endsWith(".json")
        ? [dataPathFromRelative(relative)]
        : [];
  });
}

const missing = new Map();
const conflicts = [];

function collect(value, location) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const category = moveFields[key];
    if (category && child && !Array.isArray(child) && typeof child === "object") {
      for (const [id, move] of Object.entries(child)) {
        const target = dataPath("moves", category, `${id}.json`);
        if (fs.existsSync(target)) continue;
        const catalogKey = `${category}:${id}`;
        const existing = missing.get(catalogKey);
        if (existing && JSON.stringify(existing.move) !== JSON.stringify(move))
          conflicts.push(`${location}.${key}.${id}`);
        else missing.set(catalogKey, { target, move });
      }
    }
    collect(child, location ? `${location}.${key}` : key);
  }
}

for (const file of sourceDirectories.flatMap(jsonFiles))
  collect(readJson(file), relativeToApp(file));

const result = {
  mode: write ? "write" : "dry-run",
  missingCatalogEntries: missing.size,
  conflicts,
  files: [...missing.values()].map(({ target }) => relativeToApp(target)),
};

if (conflicts.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  if (write) {
    for (const { target, move } of missing.values()) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, `${JSON.stringify(move, null, 2)}\n`);
    }
  }
  console.log(JSON.stringify(result, null, 2));
}
