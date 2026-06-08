const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(file);
    return entry.isFile() && entry.name.endsWith(".json") ? [file] : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function relative(file) {
  return path.relative(rootDir, file);
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function namesToTerms(names) {
  return Object.values(names || {})
    .filter((value) => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeType(value) {
  return String(value || "")
    .replace(/^POKEMON_TYPE_/, "")
    .toUpperCase();
}

function objectValues(value) {
  if (!value || Array.isArray(value) || typeof value !== "object") return [];
  return Object.values(value);
}

function moveIds(value) {
  if (Array.isArray(value)) {
    return value
      .map((move) => (typeof move === "string" ? move : move?.id))
      .filter(Boolean);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function pokemonKind(data, hint) {
  if (hint) return hint;
  if (data.form === "gigantamax") return "gigantamax";
  if (String(data.form || "").startsWith("mega") || data.form === "primal")
    return "mega";
  if (["alola", "galar", "hisui", "paldea"].includes(data.form))
    return "regional";
  return data.form && data.form !== "normal" ? "form" : "pokemon";
}

function pokemonKey(data) {
  return String(data.formId || `${data.id}:${data.form || "normal"}`).toUpperCase();
}

function mergePokemon(parent, form) {
  return {
    ...parent,
    ...form,
    region: form.region || parent.region,
    names: form.names || parent.names,
    stats: form.stats || parent.stats,
    primaryType: form.primaryType || parent.primaryType,
    secondaryType:
      form.secondaryType === undefined ? parent.secondaryType : form.secondaryType,
    pokemonClass: form.pokemonClass || parent.pokemonClass,
    quickMoves: form.quickMoves || parent.quickMoves,
    cinematicMoves: form.cinematicMoves || parent.cinematicMoves,
    eliteQuickMoves: form.eliteQuickMoves || parent.eliteQuickMoves,
    eliteCinematicMoves:
      form.eliteCinematicMoves || parent.eliteCinematicMoves,
    availability: form.availability || parent.availability,
    maxCp: form.maxCp || parent.maxCp,
    pvp: form.pvp || parent.pvp,
    assets: form.assets || parent.assets,
  };
}

function toPokemonDocument(data, sourceFiles, hint, parentKey = null) {
  const availability = data.availability || {};
  const kind = pokemonKind(data, hint);
  const primaryType = normalizeType(data.primaryType?.type);
  const secondaryType = normalizeType(data.secondaryType?.type);
  const quickMoves = moveIds(data.quickMoves);
  const chargedMoves = moveIds(data.cinematicMoves);
  const eliteQuickMoves = moveIds(data.eliteQuickMoves);
  const eliteChargedMoves = moveIds(data.eliteCinematicMoves);
  const key = pokemonKey(data);
  const searchTerms = [
    data.id,
    data.formId,
    data.slug,
    data.dexId,
    data.form,
    data.region?.id,
    ...namesToTerms(data.names),
    ...quickMoves,
    ...chargedMoves,
  ]
    .filter(Boolean)
    .map(String);

  return {
    key,
    kind,
    parentKey,
    id: data.id,
    formId: data.formId || key,
    slug: data.slug,
    dexNr: data.dexNr ?? Number.parseInt(data.dexId, 10),
    dexId: data.dexId || String(data.dexNr || "").padStart(4, "0"),
    form: data.form || "normal",
    generation: data.generation || data.region?.generation,
    regionId: data.region?.id,
    names: data.names || {},
    searchTerms: [...new Set(searchTerms)],
    primaryType: primaryType || undefined,
    secondaryType: secondaryType || undefined,
    types: [primaryType, secondaryType].filter(Boolean),
    weatherBoost: (data.weatherBoost || []).map(String),
    moveIds: [...new Set([...quickMoves, ...chargedMoves])],
    eliteMoveIds: [...new Set([...eliteQuickMoves, ...eliteChargedMoves])],
    pvpLeagues:
      data.pvp && typeof data.pvp === "object" ? Object.keys(data.pvp) : [],
    stats: data.stats || {},
    maxCp: data.maxCp || {},
    flags: {
      released: availability.released,
      shinyReleased: availability.shinyReleased,
      tradable: availability.tradable,
      pokemonHomeTransfer: availability.pokemonHomeTransfer,
      shadow: availability.shadow,
      apex: availability.apex,
      dynamax: availability.dynamax,
      gigantamax:
        availability.gigantamax === true || kind === "gigantamax",
      mega: kind === "mega",
    },
    buddyDistance: data.buddyDistance,
    catchRate: data.catchRate,
    fleeRate: data.fleeRate,
    sourceFiles: [...new Set(sourceFiles)],
    sourceHash: hash(data),
    data,
  };
}

function collectPokemonDocuments() {
  const pokemonDir = path.join(rootDir, "data", "pokemon");
  const formsDir = path.join(rootDir, "data", "pokemon-forms");
  const documents = new Map();
  const parents = new Map();

  for (const file of listJsonFiles(pokemonDir)) {
    const data = readJson(file);
    const source = relative(file);
    const parentKey = pokemonKey(data);
    parents.set(data.dexId, data);
    parents.set(data.id, data);
    documents.set(parentKey, toPokemonDocument(data, [source], "pokemon"));

    for (const form of objectValues(data.regionForms)) {
      const merged = mergePokemon(data, form);
      const key = pokemonKey(merged);
      documents.set(
        key,
        toPokemonDocument(merged, [source], "regional", parentKey),
      );
    }
    for (const mega of objectValues(data.megaEvolutions)) {
      const merged = mergePokemon(data, mega);
      const key = pokemonKey(merged);
      documents.set(key, toPokemonDocument(merged, [source], "mega", parentKey));
    }
  }

  for (const file of listJsonFiles(formsDir)) {
    const form = readJson(file);
    const parent = parents.get(form.dexId) || parents.get(form.id) || {};
    const merged = mergePokemon(parent, form);
    const key = pokemonKey(merged);
    const existing = documents.get(key);
    const parentKey = parent.id ? pokemonKey(parent) : null;
    documents.set(
      key,
      toPokemonDocument(
        merged,
        [...(existing?.sourceFiles || []), relative(file)],
        pokemonKind(form),
        parentKey,
      ),
    );
  }
  return [...documents.values()];
}

function collectMoveDocuments() {
  const directories = [
    ["data/moves/fast", "fast", false],
    ["data/moves/charged", "charged", false],
    ["data/moves/fast_elite", "fast", true],
    ["data/moves/charged_elite", "charged", true],
  ];
  const documents = new Map();

  for (const [directory, kind, elite] of directories) {
    for (const file of listJsonFiles(path.join(rootDir, directory))) {
      const data = readJson(file);
      const existing = documents.get(data.id);
      const sourceFiles = [...(existing?.sourceFiles || []), relative(file)];
      const categories = [
        ...(existing?.categories || []),
        elite ? `${kind}_elite` : kind,
      ];
      documents.set(data.id, {
        id: data.id,
        slug: data.slug,
        kind,
        categories: [...new Set(categories)],
        elite: elite || existing?.elite || false,
        type: normalizeType(data.type?.type),
        names: data.names || {},
        searchTerms: [
          data.id,
          data.slug,
          normalizeType(data.type?.type),
          ...namesToTerms(data.names),
        ].filter(Boolean),
        power: data.power,
        energy: data.energy,
        durationMs: data.durationMs,
        combat: data.combat,
        sourceFiles: [...new Set(sourceFiles)],
        sourceHash: hash(data),
        data,
      });
    }
  }
  return [...documents.values()];
}

function collectTypeDocuments() {
  const file = path.join(rootDir, "data", "types", "types.json");
  return readJson(file).map((data) => ({
    id: String(data.type).toUpperCase(),
    names: data.names || {},
    searchTerms: [data.type, ...namesToTerms(data.names)].filter(Boolean),
    sourceHash: hash(data),
    data,
  }));
}

function collectGenerationDocuments() {
  return listJsonFiles(path.join(rootDir, "data", "generations")).map((file) => {
    const data = readJson(file);
    return {
      id: data.id,
      slug: data.slug,
      generation: data.generation,
      names: data.names || {},
      sourceHash: hash(data),
      data,
    };
  });
}

function collectRegionDocuments(generations) {
  const regions = new Map();
  for (const generation of generations) {
    regions.set(generation.id, {
      id: generation.id,
      slug: generation.slug,
      generation: generation.generation,
      names: generation.names,
      sourceHash: generation.sourceHash,
      data: generation.data,
    });
  }
  return [...regions.values()];
}

function collectAllDocuments() {
  const generations = collectGenerationDocuments();
  return {
    pokemon: collectPokemonDocuments(),
    moves: collectMoveDocuments(),
    types: collectTypeDocuments(),
    generations,
    regions: collectRegionDocuments(generations),
  };
}

module.exports = {
  collectAllDocuments,
  hash,
  listJsonFiles,
  mergePokemon,
  namesToTerms,
  normalizeType,
  readJson,
};
