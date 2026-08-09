const { Pokemon, PokemonAsset, PokemonAssetFamily } = require("../models");
const { ApiError } = require("../lib/api-error");
const { boolean, csv, pagination, sortFromQuery } = require("../lib/http");
const {
  presentPokemon,
  presentPokemonList,
} = require("./pokemon-presenter");

const SORT_FIELDS = [
  "dexNr",
  "slug",
  "form",
  "generation",
  "stats.attack",
  "stats.defense",
  "stats.stamina",
  "maxCp.maxLevel50",
  "buddyDistance",
  "catchRate",
  "fleeRate",
];
const ASSET_FAMILIES = Object.freeze([
  "home",
  "shuffle",
  "variants",
  "location-cards",
]);
const ASSET_FAMILY_ALIASES = Object.freeze({
  home: "home",
  shuffle: "shuffle",
  variants: "variants",
  assetforms: "variants",
  "asset-forms": "variants",
  "location-cards": "location-cards",
  locationcards: "location-cards",
  backgrounds: "location-cards",
});

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberRange(query, field, minName, maxName) {
  const range = {};
  if (query[minName] !== undefined) {
    range.$gte = Number(query[minName]);
    if (!Number.isFinite(range.$gte)) {
      throw new ApiError(400, `Valeur numérique invalide : ${minName}`, "INVALID_FILTER");
    }
  }
  if (query[maxName] !== undefined) {
    range.$lte = Number(query[maxName]);
    if (!Number.isFinite(range.$lte)) {
      throw new ApiError(400, `Valeur numérique invalide : ${maxName}`, "INVALID_FILTER");
    }
  }
  if (range.$gte !== undefined && range.$lte !== undefined && range.$gte > range.$lte) {
    throw new ApiError(400, `${minName} doit être inférieur ou égal à ${maxName}.`, "INVALID_FILTER");
  }
  return Object.keys(range).length ? { [field]: range } : {};
}

function buildPokemonFilter(query = {}) {
  const filter = {};
  const generations = csv(query.generation).map(Number).filter(Number.isFinite);
  const regions = csv(query.region).map((value) => value.toUpperCase());
  const forms = csv(query.form).map((value) => value.toLowerCase());
  const kinds = csv(query.kind).map((value) => value.toLowerCase());
  const types = csv(query.type).map((value) => value.toUpperCase());
  const weather = csv(query.weather);
  const moves = csv(query.move).map((value) => value.toUpperCase());

  if (generations.length) filter.generation = { $in: generations };
  if (regions.length) filter.regionId = { $in: regions };
  if (forms.length) filter.form = { $in: forms };
  if (kinds.length) filter.kind = { $in: kinds };
  if (types.length) filter.types = query.matchAllTypes === "true" ? { $all: types } : { $in: types };
  if (query.primaryType) filter.primaryType = String(query.primaryType).toUpperCase();
  if (query.secondaryType)
    filter.secondaryType = String(query.secondaryType).toUpperCase();
  if (weather.length) filter.weatherBoost = { $in: weather };
  if (moves.length) filter.moveIds = { $all: moves };
  if (query.pvpLeague) filter.pvpLeagues = query.pvpLeague;

  for (const flag of [
    "released",
    "shinyReleased",
    "shadowShinyReleased",
    "tradable",
    "pokemonHomeTransfer",
    "shadow",
    "apex",
    "dynamax",
    "gigantamax",
    "mega",
  ]) {
    const value = boolean(query[flag]);
    if (value !== undefined) filter[`flags.${flag}`] = value;
  }

  Object.assign(
    filter,
    numberRange(query, "buddyDistance", "buddyDistanceMin", "buddyDistanceMax"),
    numberRange(query, "catchRate", "catchRateMin", "catchRateMax"),
    numberRange(query, "fleeRate", "fleeRateMin", "fleeRateMax"),
    numberRange(query, "maxCp.maxLevel50", "maxCpMin", "maxCpMax"),
  );

  if (query.q) {
    filter.searchTerms = {
      $regex: escapeRegex(query.q.trim()),
      $options: "i",
    };
  }
  return filter;
}

function listProjection(includeData) {
  return includeData
    ? {}
    : {
        data: 0,
        searchTerms: 0,
        sourceHash: 0,
      };
}

function normalizeAssetFamilies(value) {
  const tokens = Array.isArray(value) ? value : csv(value);
  if (tokens.some((token) => ["all", "heavy"].includes(String(token).toLowerCase()))) {
    return [...ASSET_FAMILIES];
  }
  return [...new Set(tokens
    .map((token) => ASSET_FAMILY_ALIASES[String(token).toLowerCase()])
    .filter(Boolean))];
}

function assetFamiliesFromQuery(query = {}) {
  return normalizeAssetFamilies(query.assetFamilies || query.include);
}

function familyPayload(document, family) {
  if (!document) return undefined;
  if (document.payload !== undefined) return document.payload;
  const field = family === "location-cards" ? "locationCards" : family;
  return document.data?.[field] ?? document[field];
}

function mergeAssetData(
  data = {},
  assetDocument = null,
  familyDocuments = [],
) {
  const coreAssets = assetDocument?.assets || assetDocument?.data?.assets || {};
  const byFamily = new Map(
    familyDocuments.map((document) => [document.family, document]),
  );
  const { assets: _legacyEmbeddedAssets, ...withoutEmbeddedAssets } = data;
  const assets = { ...coreAssets, candy: coreAssets.candy ?? null };
  const assetRefs = assetDocument?.assetRefs || assetDocument?.data?.assetRefs || {};
  const separatedCore = Object.keys(assetRefs).length > 0 ||
    /(?:^|\/)pokemon-assets\/core\//.test(String(assetDocument?.sourceFile || ""));
  const legacyHeavyAssets = assetDocument && !separatedCore ? coreAssets : {};
  const home = familyPayload(byFamily.get("home"), "home") ?? legacyHeavyAssets.home;
  const shuffle = familyPayload(byFamily.get("shuffle"), "shuffle") ?? legacyHeavyAssets.shuffle;
  const variants = familyPayload(byFamily.get("variants"), "variants") ?? legacyHeavyAssets.assetForms;
  const locationCards = familyPayload(byFamily.get("location-cards"), "location-cards") ?? legacyHeavyAssets.locationCards;

  if (home !== undefined) assets.home = home;
  if (shuffle !== undefined) assets.shuffle = shuffle;
  if (locationCards !== undefined) assets.locationCards = locationCards;

  const merged = {
    ...withoutEmbeddedAssets,
    assets,
    assetRefs: Object.keys(assetRefs).length ? assetRefs : data.assetRefs || {},
  };
  if (variants !== undefined) merged.assetForms = variants;
  return merged;
}

function attachPokemonAssets(document, assetDocument = null, familyDocuments = []) {
  if (!document) return document;
  return {
    ...document,
    data: mergeAssetData(
      document.data,
      assetDocument,
      familyDocuments,
    ),
  };
}

async function findPokemonAsset(formId) {
  if (!formId) return null;
  return PokemonAsset.findOne({ formId }).lean();
}

async function findPokemonAssetFamilies(formIds, families = []) {
  const normalizedFamilies = normalizeAssetFamilies(families);
  const normalizedFormIds = [].concat(formIds || []).filter(Boolean);
  if (!normalizedFormIds.length || !normalizedFamilies.length) return [];
  return PokemonAssetFamily.find({
    formId: { $in: normalizedFormIds },
    family: { $in: normalizedFamilies },
  }).lean();
}

async function hydratePokemonAssets(document, options = {}) {
  if (!document) return document;
  const families = normalizeAssetFamilies(options.families || options);
  const [assetDocument, familyDocuments] = await Promise.all([
    findPokemonAsset(document.formId),
    findPokemonAssetFamilies(document.formId, families),
  ]);
  return attachPokemonAssets(document, assetDocument, familyDocuments);
}

async function hydratePokemonAssetsBatch(documents = [], options = {}) {
  const families = normalizeAssetFamilies(options.families || options);
  const formIds = [
    ...new Set(
      documents
        .map((document) => document?.formId)
        .filter(Boolean),
    ),
  ];
  if (!formIds.length) return documents;
  const [assetDocuments, familyDocuments] = await Promise.all([
    PokemonAsset.find({ formId: { $in: formIds } }).lean(),
    findPokemonAssetFamilies(formIds, families),
  ]);
  const assetsByFormId = new Map(
    assetDocuments.map((assetDocument) => [assetDocument.formId, assetDocument]),
  );
  const familiesByFormId = new Map();
  for (const familyDocument of familyDocuments) {
    const documentsForForm = familiesByFormId.get(familyDocument.formId) || [];
    documentsForForm.push(familyDocument);
    familiesByFormId.set(familyDocument.formId, documentsForForm);
  }
  return documents.map((document) =>
    attachPokemonAssets(
      document,
      assetsByFormId.get(document.formId),
      familiesByFormId.get(document.formId) || [],
    ),
  );
}

async function listPokemon(query) {
  const { page, limit, skip } = pagination(query);
  const filter = buildPokemonFilter(query);
  const sort = sortFromQuery(query.sort, SORT_FIELDS, { dexNr: 1, form: 1 });
  const includeData = csv(query.include).includes("data");
  const [items, total] = await Promise.all([
    Pokemon.find(filter, listProjection(includeData))
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Pokemon.countDocuments(filter),
  ]);
  return { items: presentPokemonList(items), total, page, limit, filter, sort };
}

function identifierFilter(identifier) {
  const value = String(identifier);
  const upper = value.toUpperCase();
  const dex = Number.parseInt(value, 10);
  return {
    $or: [
      { key: upper },
      { formId: upper },
      { id: upper },
      { slug: value.toLowerCase() },
      ...(Number.isFinite(dex) ? [{ dexNr: dex }] : []),
    ],
  };
}

async function findPokemon(identifier, query = {}) {
  const base = identifierFilter(identifier);
  const conditions = [];
  if (query.form) conditions.push({ form: String(query.form).toLowerCase() });
  if (query.kind) conditions.push({ kind: String(query.kind).toLowerCase() });
  if (conditions.length) base.$and = conditions;
  const documents = await Pokemon.find(base).sort({ kind: 1, form: 1 }).lean();
  if (!documents.length) {
    throw new ApiError(404, `Pokémon introuvable : ${identifier}`, "POKEMON_NOT_FOUND");
  }
  const selected =
    documents.length === 1 || query.form
      ? documents[0]
      : documents.find((document) => document.form === "normal") || documents[0];
  return presentPokemon(await hydratePokemonAssets(selected, {
    families: assetFamiliesFromQuery(query),
  }));
}

async function findAllForms(identifier, query = {}) {
  const pokemon = await findPokemon(identifier, query);
  const documents = await Pokemon.find({
    $or: [
      { id: pokemon.id },
      { dexNr: pokemon.dexNr },
      { parentKey: pokemon.key },
      { key: pokemon.parentKey },
    ],
  })
    .sort({ kind: 1, form: 1 })
    .lean();
  return presentPokemonList(await hydratePokemonAssetsBatch(documents, {
    families: assetFamiliesFromQuery(query),
  }));
}

module.exports = {
  SORT_FIELDS,
  ASSET_FAMILIES,
  assetFamiliesFromQuery,
  attachPokemonAssets,
  buildPokemonFilter,
  findAllForms,
  findPokemon,
  findPokemonAsset,
  findPokemonAssetFamilies,
  hydratePokemonAssets,
  hydratePokemonAssetsBatch,
  identifierFilter,
  listPokemon,
  mergeAssetData,
  normalizeAssetFamilies,
};
