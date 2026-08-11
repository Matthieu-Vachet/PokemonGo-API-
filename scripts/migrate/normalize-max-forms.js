const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const write = process.argv.includes("--write");
const pokemonDir = dataPath("data", "pokemon", "normal");
const forms = ["dynamax", "gigantamax"];

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function diffObject(parent = {}, form = {}) {
  return Object.fromEntries(
    Object.entries(form).filter(([key, value]) => !same(parent[key], value)),
  );
}

function parentFor(form) {
  const files = fs.readdirSync(pokemonDir).filter((name) => name.endsWith(".json"));
  const byDex = form.dexId
    ? files.find((name) => name.startsWith(`${form.dexId}-`))
    : null;
  const file =
    byDex ||
    files.find((name) => {
      const candidate = read(path.join(pokemonDir, name));
      return (
        candidate.id === form.id ||
        candidate.formId === form.baseFormId ||
        candidate.formId === form.inherits
      );
    });
  if (!file) throw new Error(`Parent introuvable pour ${form.formId}`);
  return read(path.join(pokemonDir, file));
}

function maxMoves(form) {
  return (form.cinematicMoves || []).filter(
    (id) => typeof id === "string" && /^(G?MAX)_/.test(id),
  );
}

function normalize(form, parent) {
  const formSuffix = String(form.form || "").toLowerCase();
  const slug =
    form.slug ||
    [parent.slug || form.id.toLowerCase(), formSuffix].filter(Boolean).join("-");
  const level20 =
    form.maxCp?.maxBattlesLevel20 ??
    form.maxBattle?.encounterCp?.level20 ??
    form.maxCp?.dynamaxLevel20 ??
    null;
  const result = {
    id: form.id,
    formId: form.formId,
    slug,
    dexNr: form.dexNr ?? parent.dexNr,
    dexId: form.dexId || parent.dexId,
    form: form.form,
    generation: form.generation ?? parent.generation,
    baseFormId: form.baseFormId || form.inherits || parent.formId,
    availability: diffObject(parent.availability, form.availability),
    maxCp: {
      maxLevel50: form.maxCp?.maxLevel50 ?? parent.maxCp?.maxLevel50 ?? null,
      maxLevel40: form.maxCp?.maxLevel40 ?? parent.maxCp?.maxLevel40 ?? null,
      maxBattlesLevel20: level20,
    },
    maxBattle: {
      moves: form.maxBattle?.moves || maxMoves(form),
    },
    assets: form.assets,
  };
  if (!Object.keys(result.availability).length) delete result.availability;
  if (!result.assets || same(result.assets, parent.assets)) delete result.assets;
  if (form.evolutions && !same(form.evolutions, parent.evolutions))
    result.evolutions = form.evolutions;
  return result;
}

const report = { mode: write ? "write" : "dry-run", files: [], errors: [] };

for (const folder of forms) {
  const directory = dataPath("data", "pokemon", folder);
  if (!fs.existsSync(directory)) continue;
  for (const name of fs.readdirSync(directory).filter((file) => file.endsWith(".json"))) {
    const file = path.join(directory, name);
    try {
      const data = normalize(read(file), parentFor(read(file)));
      report.files.push(relativeToApp(file));
      if (write) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
    } catch (error) {
      report.errors.push(`${relativeToApp(file)}: ${error.message}`);
    }
  }
}

console.log(JSON.stringify(report, null, 2));
if (report.errors.length) process.exitCode = 1;
