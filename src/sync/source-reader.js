const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  dataPath,
  dataPathFromRelative,
  relativeToApp,
} = require("../lib/data-repository");

const copySuffix = / \d+\.json$/;

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(file);
    return entry.isFile() &&
      entry.name.endsWith(".json") &&
      !copySuffix.test(entry.name)
      ? [file]
      : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function relative(file) {
  return relativeToApp(file);
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
  const reference = value && typeof value === "object" ? value.type : value;
  return String(reference || "")
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

function normalizePokemonMoveFields(data) {
  return {
    ...data,
    primaryType: normalizeType(data.primaryType) || undefined,
    secondaryType:
      data.secondaryType === null
        ? null
        : normalizeType(data.secondaryType) || undefined,
    quickMoves: moveIds(data.quickMoves),
    cinematicMoves: moveIds(data.cinematicMoves),
    eliteQuickMoves: moveIds(data.eliteQuickMoves),
    eliteCinematicMoves: moveIds(data.eliteCinematicMoves),
    maxBattle: data.maxBattle
      ? { ...data.maxBattle, moves: moveIds(data.maxBattle.moves) }
      : data.maxBattle,
  };
}

function pokemonKind(data, hint) {
  if (hint) return hint;
  if (data.form === "dynamax") return "dynamax";
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

function mergedFormAssets(parent, form) {
  const assets = {
    ...(parent.assets || {}),
    ...(form.assets || {}),
    home: form.assets?.home || parent.assets?.home,
  };
  if (form.assets?.shuffle === undefined) delete assets.shuffle;
  return assets;
}

function mergePokemon(parent, form) {
  const isMaxForm = ["dynamax", "gigantamax"].includes(form.form);
  const baseFormId = form.baseFormId || form.inherits || parent.formId || parent.id;
  const merged = {
    ...parent,
    ...form,
    formId: form.formId || form.id || parent.formId,
    baseFormId,
    regionId: form.regionId || parent.regionId,
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
    availability: {
      ...(parent.availability || {}),
      ...(form.availability || {}),
    },
    maxCp: isMaxForm
      ? form.maxCp || {}
      : form.maxCp === undefined
        ? parent.maxCp
        : form.maxCp,
    pvp: form.pvp === undefined ? parent.pvp : form.pvp,
    assets: mergedFormAssets(parent, form),
    maxBattle: form.maxBattle || parent.maxBattle,
  };
  if (!isMaxForm) return merged;
  return {
    ...merged,
    quickMoves: form.quickMoves || [],
    cinematicMoves: form.cinematicMoves || [],
    eliteQuickMoves: form.eliteQuickMoves || [],
    eliteCinematicMoves: form.eliteCinematicMoves || [],
    pvp: form.pvp === undefined ? null : form.pvp,
    evolutions: form.evolutions || [],
    regionForms: form.regionForms || [],
    hasMegaEvolution: false,
    megaEvolutions: [],
    dynamaxForms: [],
    hasGigantamaxEvolution: form.form === "gigantamax",
    gigantamaxForms: [],
  };
}

function toPokemonDocument(data, sourceFiles, hint, parentKey = null) {
  const normalizedData = normalizePokemonMoveFields(data);
  const availability = data.availability || {};
  const kind = pokemonKind(data, hint);
  const primaryType = normalizeType(data.primaryType);
  const secondaryType = normalizeType(data.secondaryType);
  const quickMoves = moveIds(data.quickMoves);
  const chargedMoves = moveIds(data.cinematicMoves);
  const eliteQuickMoves = moveIds(data.eliteQuickMoves);
  const eliteChargedMoves = moveIds(data.eliteCinematicMoves);
  const maxMoves = moveIds(data.maxBattle?.moves);
  const key = pokemonKey(data);
  const searchTerms = [
    data.id,
    data.formId,
    data.slug,
    data.dexId,
    data.form,
    data.regionId,
    data.region?.id,
    ...namesToTerms(data.names),
    ...quickMoves,
    ...chargedMoves,
    ...maxMoves,
  ]
    .filter(Boolean)
    .map(String);

  return {
    key,
    kind,
    parentKey,
    baseFormId: data.baseFormId || null,
    id: data.id,
    formId: data.formId || key,
    slug: data.slug,
    dexNr: data.dexNr ?? Number.parseInt(data.dexId, 10),
    dexId: data.dexId || String(data.dexNr || "").padStart(4, "0"),
    form: data.form || "normal",
    generation: data.generation || data.region?.generation,
    regionId: data.regionId || data.region?.id,
    names: data.names || {},
    searchTerms: [...new Set(searchTerms)],
    primaryType: primaryType || undefined,
    secondaryType: secondaryType || undefined,
    types: [primaryType, secondaryType].filter(Boolean),
    weatherBoost: (data.weatherBoost || []).map(String),
    moveIds: [...new Set([...quickMoves, ...chargedMoves])],
    eliteMoveIds: [...new Set([...eliteQuickMoves, ...eliteChargedMoves])],
    maxMoveIds: [...new Set(maxMoves)],
    pvpLeagues:
      data.pvp && typeof data.pvp === "object"
        ? Object.entries(data.pvp)
            .filter(([, league]) => league !== null)
            .map(([league]) => league)
        : [],
    stats: data.stats || {},
    maxCp: data.maxCp || {},
    flags: {
      released: availability.released,
      shinyReleased: availability.shinyReleased,
      shadowShinyReleased: availability.shadowShinyReleased,
      tradable: availability.tradable,
      pokemonHomeTransfer: availability.pokemonHomeTransfer,
      shadow: availability.shadow,
      apex: availability.apex,
      dynamax: availability.dynamax === true || kind === "dynamax",
      gigantamax:
        availability.gigantamax === true || kind === "gigantamax",
      mega: kind === "mega",
    },
    buddyDistance: data.buddyDistance,
    catchRate: data.catchRate,
    fleeRate: data.fleeRate,
    sourceFiles: [...new Set(sourceFiles)],
    sourceHash: hash(normalizedData),
    data: normalizedData,
  };
}

function resolveRegionReference(data, regions, parent = {}) {
  const regionId =
    data.regionId ||
    (typeof data.region === "string" ? data.region : data.region?.id) ||
    parent.regionId ||
    parent.region?.id;
  const region = regions.get(regionId) || data.region || parent.region;
  return {
    ...data,
    regionId,
    region,
    generation: data.generation || region?.generation || parent.generation,
  };
}

function collectPokemonDocuments(generations = collectGenerationDocuments()) {
  const pokemonDir = dataPath("pokemon");
  const formsDir = dataPath("pokemon-forms");
  const documents = new Map();
  const parents = new Map();
  const regions = new Map(generations.map((entry) => [entry.id, entry.data]));

  for (const file of listJsonFiles(pokemonDir)) {
    const data = resolveRegionReference(readJson(file), regions);
    const source = relative(file);
    const parentKey = pokemonKey(data);
    parents.set(data.dexId, data);
    parents.set(data.id, data);
    parents.set(data.formId, data);
    documents.set(parentKey, toPokemonDocument(data, [source], "pokemon"));

  }

  for (const file of listJsonFiles(formsDir)) {
    const form = readJson(file);
    const parent =
      parents.get(form.baseFormId) ||
      parents.get(form.inherits) ||
      parents.get(form.dexId) ||
      parents.get(form.id) ||
      {};
    const merged = mergePokemon(
      parent,
      resolveRegionReference(form, regions, parent),
    );
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
    ["data/moves/max", "max", false],
    ["data/moves/gmax", "gmax", false],
  ];
  const documents = new Map();

  for (const [directory, kind, elite] of directories) {
    for (const file of listJsonFiles(dataPathFromRelative(directory))) {
      const data = readJson(file);
      const existing = documents.get(data.id);
      const sourceFiles = [...(existing?.sourceFiles || []), relative(file)];
      const categories = [
        ...(existing?.categories || []),
        elite ? `${kind}_elite` : kind,
      ];
      const legacySlugs = [
        ...(existing?.legacySlugs || []),
        ...(data.legacySlugs || []),
      ];
      documents.set(data.id, {
        id: data.id,
        slug: data.slug,
        kind,
        categories: [...new Set(categories)],
        elite: elite || existing?.elite || false,
        type: normalizeType(data.type),
        names: data.names || {},
        searchTerms: [
          data.id,
          data.slug,
          ...legacySlugs,
          normalizeType(data.type),
          ...namesToTerms(data.names),
        ].filter(Boolean),
        power: data.power,
        energy: data.energy,
        durationMs: data.durationMs,
        combat: data.combat,
        sourceFiles: [...new Set(sourceFiles)],
        sourceHash: hash(data),
        legacySlugs: [...new Set(legacySlugs)],
        data: { ...data, type: normalizeType(data.type) },
      });
    }
  }
  return [...documents.values()];
}

function collectTypeDocuments() {
  const directory = dataPath("types");
  const files = listJsonFiles(directory).filter(
    (file) => path.basename(file) !== "types.json",
  );
  const types = files.length
    ? files.map(readJson)
    : readJson(path.join(directory, "types.json"));
  return types.map((data) => ({
    id: String(data.id || data.type).toUpperCase(),
    slug: data.slug,
    names: data.names || {},
    searchTerms: [
      data.id,
      data.slug,
      data.type,
      ...namesToTerms(data.names),
    ].filter(Boolean),
    sourceHash: hash(data),
    data,
  }));
}

function collectWeatherDocuments() {
  const directory = dataPath("weather");
  const files = listJsonFiles(directory).filter(
    (file) => path.basename(file) !== "weather.json",
  );
  const weather = files.length
    ? files.map(readJson)
    : readJson(path.join(directory, "weather.json"));
  return weather.map((data) => ({
    id: data.id,
    slug: data.slug,
    names: data.names || {},
    assets: data.assets || {},
    boostedTypes: data.boostedTypes || [],
    searchTerms: [
      data.id,
      data.slug,
      ...namesToTerms(data.names),
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase()),
    sourceHash: hash(data),
    data,
  }));
}

function collectGenerationDocuments() {
  return listJsonFiles(dataPath("generations")).map((file) => {
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
    pokemon: collectPokemonDocuments(generations),
    moves: collectMoveDocuments(),
    types: collectTypeDocuments(),
    weather: collectWeatherDocuments(),
    generations,
    regions: collectRegionDocuments(generations),
  };
}

module.exports = {
  collectAllDocuments,
  collectWeatherDocuments,
  hash,
  listJsonFiles,
  mergePokemon,
  namesToTerms,
  normalizeType,
  normalizePokemonMoveFields,
  readJson,
};
