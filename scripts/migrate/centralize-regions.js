const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const write = process.argv.includes("--write");
const sourceDirectories = ["data/pokemon"];

function files(directory) {
  const absolute = dataPathFromRelative(directory);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(relative)
      : entry.name.endsWith(".json")
        ? [dataPathFromRelative(relative)]
        : [];
  });
}

function centralize(value, report) {
  if (!value || typeof value !== "object") return;
  const pokemonRecord =
    typeof value.form === "string" &&
    (typeof value.formId === "string" || typeof value.dexId === "string");
  if (pokemonRecord) {
    if (value.region && typeof value.region === "object" && value.region.id) {
      value.regionId = value.region.id;
      delete value.region;
      report.regionBlocksRemoved += 1;
    }
    if (Object.hasOwn(value, "generation")) {
      delete value.generation;
      report.generationsRemoved += 1;
    }
  }
  for (const child of Object.values(value)) centralize(child, report);
}

const report = {
  mode: write ? "write" : "dry-run",
  sourceFiles: 0,
  changedFiles: 0,
  regionBlocksRemoved: 0,
  generationsRemoved: 0,
};
const changed = [];

for (const file of sourceDirectories.flatMap(files)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(data);
  centralize(data, report);
  report.sourceFiles += 1;
  if (before !== JSON.stringify(data)) {
    report.changedFiles += 1;
    changed.push({ file, data });
  }
}

if (write)
  for (const { file, data } of changed)
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

console.log(JSON.stringify(report, null, 2));
