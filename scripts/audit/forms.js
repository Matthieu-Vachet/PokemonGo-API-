const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const pokemonDir = dataPath("pokemon");
const formsDir = dataPath("pokemon-forms");

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
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

const formIds = new Map(
  files(formsDir).map((file) => {
    const form = read(file);
    return [form.formId, relativeToApp(file)];
  }),
);
const missingReferences = [];
const embeddedForms = [];
for (const file of files(pokemonDir)) {
  const pokemon = read(file);
  for (const field of [
    "regionForms",
    "megaEvolutions",
    "dynamaxForms",
    "gigantamaxForms",
  ]) {
    const value = pokemon[field] || [];
    if (!Array.isArray(value)) {
      embeddedForms.push({ file: relativeToApp(file), field });
      continue;
    }
    for (const formId of value)
      if (!formIds.has(formId))
        missingReferences.push({
          file: relativeToApp(file),
          field,
          formId,
        });
  }
}

const sources = [...files(pokemonDir), ...files(formsDir)].map((file) => ({
  file,
  data: read(file),
}));
const parents = new Map();
for (const source of sources)
  if (!["dynamax", "gigantamax"].includes(source.data.form))
    for (const id of [source.data.formId, source.data.id])
      if (id && !parents.has(id)) parents.set(id, source);
for (const source of sources.filter((item) =>
  ["dynamax", "gigantamax"].includes(item.data.form),
)) {
  const parent = parents.get(source.data.baseFormId);
  const field =
    source.data.form === "dynamax" ? "dynamaxForms" : "gigantamaxForms";
  if (!parent || !parent.data[field]?.includes(source.data.formId))
    missingReferences.push({
      file: parent ? relativeToApp(parent.file) : null,
      field,
      formId: source.data.formId,
      expectedParent: source.data.baseFormId,
    });
}

const result = {
  dedicatedForms: formIds.size,
  embeddedForms,
  missingReferences,
  valid: embeddedForms.length === 0 && missingReferences.length === 0,
};
console.log(JSON.stringify(result, null, 2));
if (!result.valid) process.exitCode = 1;
