const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const write = process.argv.includes("--write");

function jsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(file);
    return entry.isFile() && entry.name.endsWith(".json") ? [file] : [];
  });
}

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalEvolution(evolution) {
  const form = String(evolution.form || "normal").toLowerCase();
  const legacyFormId = String(evolution.targetFormId || evolution.formId || "");
  const targetFormId =
    form === "normal" && legacyFormId.endsWith("_NORMAL")
      ? legacyFormId.slice(0, -"_NORMAL".length)
      : legacyFormId || evolution.id;
  return {
    targetFormId,
    candies: evolution.candies ?? null,
    item: evolution.item ?? null,
    quests: evolution.quests || [],
  };
}

function normalizeEvolutions(value) {
  if (!Array.isArray(value)) return value;
  return value.map(canonicalEvolution);
}

function normalizeNestedForms(value, parent) {
  if (!value || Array.isArray(value) || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, form]) => [
      key,
      normalizeForm(form, parent),
    ]),
  );
}

function normalizeForm(form, parent) {
  const formId = form.formId || form.id;
  const suffix = slug(
    String(formId || form.form || "")
      .replace(new RegExp(`^${escapeRegExp(parent.id)}_?`, "i"), "")
      .replace(/_/g, "-"),
  );
  return {
    ...form,
    formId,
    slug: suffix ? `${parent.slug}-${suffix}` : parent.slug,
    baseFormId: parent.formId,
    evolutions: normalizeEvolutions(form.evolutions),
  };
}

function normalizePokemon(data, parent = null) {
  const normalized = parent ? normalizeForm(data, parent) : { ...data };
  normalized.evolutions = normalizeEvolutions(normalized.evolutions);
  normalized.regionForms = normalizeNestedForms(normalized.regionForms, normalized);
  normalized.megaEvolutions = normalizeNestedForms(normalized.megaEvolutions, normalized);
  return normalized;
}

const pokemonDirectory = path.join(rootDir, "data", "pokemon");
const pokemonFiles = jsonFiles(pokemonDirectory);
const parents = new Map();
for (const file of pokemonFiles) {
  const data = read(file);
  parents.set(data.id, data);
  parents.set(data.formId, data);
  parents.set(data.dexId, data);
}

const transformed = [];
const report = {
  mode: write ? "write" : "dry-run",
  changedFiles: 0,
  pokemonFiles: 0,
  formFiles: 0,
  moveFiles: 0,
  typeEntries: 0,
  errors: [],
};

for (const file of pokemonFiles) {
  const before = read(file);
  const after = normalizePokemon(before);
  report.pokemonFiles += 1;
  if (JSON.stringify(before) !== JSON.stringify(after)) transformed.push({ file, data: after });
}

for (const file of jsonFiles(path.join(rootDir, "data", "pokemon-forms"))) {
  const before = read(file);
  const parent =
    parents.get(before.baseFormId) ||
    parents.get(before.inherits) ||
    parents.get(before.id) ||
    parents.get(before.dexId);
  report.formFiles += 1;
  if (!parent) {
    report.errors.push(`${path.relative(rootDir, file)}: parent introuvable`);
    continue;
  }
  const after = normalizePokemon(
    {
      ...before,
      dexNr: before.dexNr ?? parent.dexNr,
      dexId: before.dexId || parent.dexId,
      generation: before.generation || parent.generation,
      baseFormId: before.baseFormId || parent.formId,
    },
    parent,
  );
  delete after.inherits;
  if (JSON.stringify(before) !== JSON.stringify(after)) transformed.push({ file, data: after });
}

for (const file of jsonFiles(path.join(rootDir, "data", "moves"))) {
  const before = read(file);
  const canonicalSlug = slug(before.slug || before.id);
  const after = { ...before, slug: canonicalSlug };
  if (before.slug && before.slug !== canonicalSlug) {
    after.legacySlugs = [...new Set([...(before.legacySlugs || []), before.slug])];
  }
  report.moveFiles += 1;
  if (JSON.stringify(before) !== JSON.stringify(after)) transformed.push({ file, data: after });
}

const typeFile = path.join(rootDir, "data", "types", "types.json");
const beforeTypes = read(typeFile);
const afterTypes = beforeTypes.map((type) => ({
  ...type,
  id: String(type.id || type.type).toUpperCase(),
  slug: slug(type.slug || type.type),
}));
report.typeEntries = afterTypes.length;
if (JSON.stringify(beforeTypes) !== JSON.stringify(afterTypes))
  transformed.push({ file: typeFile, data: afterTypes });

report.changedFiles = transformed.length;
if (!report.errors.length && write) {
  for (const { file, data } of transformed)
    fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
