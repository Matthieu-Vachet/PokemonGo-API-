const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const write = process.argv.includes("--write");
const sourceDirectories = ["data/pokemon", "data/moves"];

function jsonFiles(directory) {
  const absolute = dataPathFromRelative(directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(relative)
      : entry.name.endsWith(".json")
        ? [dataPathFromRelative(relative)]
        : [];
  });
}

function typeId(value) {
  const reference = value && typeof value === "object" ? value.type : value;
  return String(reference || "")
    .replace(/^POKEMON_TYPE_/, "")
    .toUpperCase();
}

function normalize(value, report) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (
      ["primaryType", "secondaryType", "type"].includes(key) &&
      child &&
      !Array.isArray(child) &&
      typeof child === "object" &&
      typeof child.type === "string"
    ) {
      value[key] = typeId(child);
      report.convertedReferences += 1;
    } else {
      normalize(child, report);
    }
  }
}

const report = {
  mode: write ? "write" : "dry-run",
  sourceFiles: 0,
  changedFiles: 0,
  convertedReferences: 0,
};
const changed = [];

for (const file of sourceDirectories.flatMap(jsonFiles)) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = JSON.stringify(data);
  normalize(data, report);
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
