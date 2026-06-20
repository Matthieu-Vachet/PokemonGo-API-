const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const sourceDir = path.join(rootDir, "asset", "pokemonShuffle");
const pokemonDir = dataPath("pokemon");
const formsDir = dataPath("pokemon-forms");
const reportFile = dataPath("pokemon-shuffle-import-report.json");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/pokemonShuffle";
const write = process.argv.includes("--write");
const maxForms = new Set(["dynamax", "gigantamax"]);
const terminalStates = new Set(["dynamax", "gigantamax", "shadow", "purified"]);
const genericVariantPrefixes = ["normal", "event", "femelle", "female", "male"];

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function files(directory, extension = ".json") {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(file, extension)
      : entry.name.endsWith(extension)
        ? [file]
        : [];
  });
}

function compact(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function aliases(record) {
  const values = new Set([
    record.data.slug,
    record.data.formId,
    record.isBase ? record.data.id : null,
  ]);
  for (const value of [...values]) {
    values.add(String(value).replace(/galarian/gi, "galar"));
    values.add(String(value).replace(/hisuian/gi, "hisui"));
    values.add(String(value).replace(/paldean/gi, "paldea"));
    values.add(String(value).replace(/alolan/gi, "alola"));
    if (String(record.data.form).startsWith("mega"))
      values.add(String(value).replace(/mega/gi, "dynamax-mega"));
  }
  return [...new Set([...values].map(compact).filter(Boolean))].sort(
    (left, right) => right.length - left.length,
  );
}

function parseImage(filename) {
  const match = filename.match(/^(\d+)_([^.]+)\.png$/i);
  if (!match) return null;
  const tokens = match[2].split("_").filter(Boolean);
  const shiny = tokens.at(-1) === "chromatique";
  if (shiny) tokens.pop();
  const explicitState = terminalStates.has(tokens.at(-1)) ? tokens.pop() : null;
  return {
    dexNr: Number(match[1]),
    filename,
    shiny,
    explicitState,
    root: tokens.join("_"),
    codes: match[2].split("_").filter(Boolean),
  };
}

function isGenericRemainder(remainder) {
  return (
    remainder === "" ||
    genericVariantPrefixes.some((prefix) => remainder.startsWith(prefix))
  );
}

function matchUnderlying(image, records) {
  const root = compact(image.root);
  const matches = [];
  for (const record of records.filter(({ data }) => !maxForms.has(data.form))) {
    for (const alias of record.aliases) {
      if (!root.startsWith(alias)) continue;
      const remainder = root.slice(alias.length);
      if (!isGenericRemainder(remainder)) continue;
      matches.push({ record, aliasLength: alias.length, remainder });
      break;
    }
  }
  matches.sort(
    (left, right) =>
      right.aliasLength - left.aliasLength ||
      Number(left.record.isBase) - Number(right.record.isBase),
  );
  if (!matches.length) return { error: "forme source introuvable" };
  if (
    matches.length > 1 &&
    matches[0].aliasLength === matches[1].aliasLength &&
    matches[0].record.file !== matches[1].record.file
  ) {
    return {
      error: "forme source ambiguë",
      candidates: matches
        .filter(({ aliasLength }) => aliasLength === matches[0].aliasLength)
        .map(({ record }) => record.relative),
    };
  }
  return { record: matches[0].record, remainder: matches[0].remainder };
}

function maxTarget(image, underlying, records) {
  const targets = records.filter(({ data }) => data.form === image.explicitState);
  const exact = targets.filter(
    ({ data }) => data.baseFormId === underlying.data.formId,
  );
  if (exact.length === 1) return { record: exact[0] };
  if (exact.length > 1)
    return {
      error: `plusieurs fiches ${image.explicitState} exactes`,
      candidates: exact.map(({ relative }) => relative),
    };
  return {
    error: `fiche ${image.explicitState} exacte introuvable`,
    candidates: targets.map(({ relative }) => relative),
  };
}

function targetFor(image, records) {
  const underlying = matchUnderlying(image, records);
  if (!underlying.record) return underlying;
  if (["dynamax", "gigantamax"].includes(image.explicitState)) {
    return maxTarget(image, underlying.record, records);
  }
  return { record: underlying.record };
}

function stateFor(image, record) {
  if (image.explicitState) return image.explicitState;
  if (String(record.data.form).startsWith("mega") || record.data.form === "primal")
    return "mega";
  if (image.root.includes("_event_")) return "event";
  return "normal";
}

function variantFor(image, record) {
  return {
    id: image.filename.replace(/\.png$/i, ""),
    form: record.data.form,
    image: `${remoteBase}/${encodeURIComponent(image.filename)}`,
    filename: image.filename,
    state: stateFor(image, record),
    codes: image.codes,
    tags: image.root.split("_").filter(Boolean),
    shiny: image.shiny,
  };
}

function withShuffle(record, variants) {
  const assets =
    record.data.assets && typeof record.data.assets === "object"
      ? { ...record.data.assets }
      : {};
  assets.shuffle = {
    source: "pokemon-shuffle",
    variants: variants.sort((left, right) => left.filename.localeCompare(right.filename)),
  };
  return { ...record.data, assets };
}

const records = [...files(pokemonDir), ...files(formsDir)].map((file) => {
  const data = read(file);
  return {
    file,
    relative: relativeToApp(file),
    data,
    isBase: file.startsWith(`${pokemonDir}${path.sep}`),
    aliases: [],
  };
});
for (const record of records) record.aliases = aliases(record);

const recordsByDex = new Map();
for (const record of records) {
  const entries = recordsByDex.get(record.data.dexNr) || [];
  entries.push(record);
  recordsByDex.set(record.data.dexNr, entries);
}

const assigned = new Map();
const unmatched = [];
const invalidFiles = [];
for (const filename of fs.readdirSync(sourceDir).filter((name) => name.endsWith(".png")).sort()) {
  const image = parseImage(filename);
  if (!image) {
    invalidFiles.push(filename);
    continue;
  }
  const target = targetFor(image, recordsByDex.get(image.dexNr) || []);
  if (!target.record) {
    unmatched.push({
      filename,
      dexNr: image.dexNr,
      reason: target.error,
      candidates: target.candidates || [],
    });
    continue;
  }
  const variants = assigned.get(target.record.file) || [];
  variants.push(variantFor(image, target.record));
  assigned.set(target.record.file, variants);
}

const changedFiles = [];
for (const record of records) {
  const variants = assigned.get(record.file);
  const hadShuffle = Boolean(record.data.assets?.shuffle);
  if (!variants && !hadShuffle) continue;
  const next = variants
    ? withShuffle(record, variants)
    : {
        ...record.data,
        assets: { ...record.data.assets },
      };
  if (!variants) {
    delete next.assets.shuffle;
    if (!Object.keys(next.assets).length) next.assets = null;
  }
  if (JSON.stringify(next) === JSON.stringify(record.data)) continue;
  changedFiles.push(record.relative);
  if (write) writeJson(record.file, next);
}

const assignedFilenames = [...assigned.values()].flat().map(({ filename }) => filename);
const duplicateAssignments = assignedFilenames.filter(
  (filename, index) => assignedFilenames.indexOf(filename) !== index,
);
const stateCounts = {};
const formCounts = {};
for (const variants of assigned.values()) {
  for (const variant of variants) {
    stateCounts[variant.state] = (stateCounts[variant.state] || 0) + 1;
    formCounts[variant.form] = (formCounts[variant.form] || 0) + 1;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  mode: write ? "write" : "dry-run",
  sourceImages: assignedFilenames.length + unmatched.length,
  assignedImages: assignedFilenames.length,
  unmatchedImages: unmatched.length,
  assignedRecords: assigned.size,
  changedFiles: changedFiles.length,
  duplicateAssignments,
  stateCounts,
  formCounts,
  unmatched,
  invalidFiles,
  note:
    "Chaque image est associée à une seule fiche exacte. Les images sans fiche compatible restent dans la galerie globale et dans cette liste.",
};
if (write) writeJson(reportFile, report);
console.log(JSON.stringify(report, null, 2));
