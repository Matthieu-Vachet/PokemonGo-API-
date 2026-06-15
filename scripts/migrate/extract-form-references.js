const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const write = process.argv.includes("--write");

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function jsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? jsonFiles(file)
      : entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

function slug(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

const dedicatedByFormId = new Map(
  jsonFiles(formsDir).map((file) => {
    const form = read(file);
    return [form.formId, { file, form }];
  }),
);
const created = [];
const updated = [];
const pokemonChanged = [];
const maxReferenceChanges = [];

for (const filename of fs
  .readdirSync(pokemonDir)
  .filter((name) => name.endsWith(".json"))
  .sort()) {
  const file = path.join(pokemonDir, filename);
  const pokemon = read(file);
  let changed = false;
  for (const field of ["regionForms", "megaEvolutions"]) {
    if (!pokemon[field] || Array.isArray(pokemon[field])) continue;
    const references = [];
    for (const [key, embedded] of Object.entries(pokemon[field])) {
      const formId = embedded.formId || key;
      references.push(formId);
      const existing = dedicatedByFormId.get(formId);
      const complete = {
        dexId: pokemon.dexId,
        dexNr: pokemon.dexNr,
        generation: pokemon.generation,
        baseFormId: embedded.baseFormId || pokemon.formId || pokemon.id,
        ...embedded,
        ...(existing?.form || {}),
        formId,
        form:
          existing?.form.form ||
          embedded.form ||
          (field === "megaEvolutions"
            ? formId.includes("PRIMAL")
              ? "primal"
              : "mega"
            : "normal"),
      };
      const folder = slug(complete.form || "other");
      const formFile =
        existing?.file ||
        path.join(
          formsDir,
          folder,
          `${pokemon.dexId}-${slug(complete.slug || formId)}.json`,
        );
      if (!existing) created.push(path.relative(rootDir, formFile));
      else if (JSON.stringify(existing.form) !== JSON.stringify(complete))
        updated.push(path.relative(rootDir, formFile));
      if (write) writeJson(formFile, complete);
      dedicatedByFormId.set(formId, { file: formFile, form: complete });
    }
    pokemon[field] = references;
    changed = true;
  }
  if (!changed) continue;
  pokemonChanged.push(path.relative(rootDir, file));
  if (write) writeJson(file, pokemon);
}

const sourceFiles = [
  ...fs.readdirSync(pokemonDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(pokemonDir, name)),
  ...jsonFiles(formsDir),
];
const parentsById = new Map();
const maxReferences = new Map();
for (const file of sourceFiles) {
  const data = read(file);
  if (!["dynamax", "gigantamax"].includes(data.form)) {
    for (const id of [data.formId, data.id])
      if (id && !parentsById.has(id)) parentsById.set(id, file);
    continue;
  }
  const field = data.form === "dynamax" ? "dynamaxForms" : "gigantamaxForms";
  const key = `${data.baseFormId}:${field}`;
  const references = maxReferences.get(key) || [];
  references.push(data.formId);
  maxReferences.set(key, references);
}
for (const [key, references] of maxReferences) {
  const separator = key.lastIndexOf(":");
  const parentId = key.slice(0, separator);
  const field = key.slice(separator + 1);
  const file = parentsById.get(parentId);
  if (!file) continue;
  const parent = read(file);
  const next = [...new Set(references)].sort();
  if (JSON.stringify(parent[field]) === JSON.stringify(next)) continue;
  parent[field] = next;
  maxReferenceChanges.push(path.relative(rootDir, file));
  if (write) writeJson(file, parent);
}

console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      createdForms: created.length,
      updatedForms: updated.length,
      pokemonChanged: pokemonChanged.length,
      maxReferenceChanges: maxReferenceChanges.length,
      created,
      updated,
    },
    null,
    2,
  ),
);
