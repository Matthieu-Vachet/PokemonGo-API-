const { Pokemon } = require("../models");
const { ApiError } = require("../lib/api-error");
const { boolean, csv, pagination, sortFromQuery } = require("../lib/http");

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
  return { items, total, page, limit, filter, sort };
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
  if (documents.length === 1 || query.form) return documents[0];
  return documents.find((document) => document.form === "normal") || documents[0];
}

async function findAllForms(identifier) {
  const pokemon = await findPokemon(identifier);
  return Pokemon.find({
    $or: [
      { id: pokemon.id },
      { dexNr: pokemon.dexNr },
      { parentKey: pokemon.key },
      { key: pokemon.parentKey },
    ],
  })
    .sort({ kind: 1, form: 1 })
    .lean();
}

module.exports = {
  SORT_FIELDS,
  buildPokemonFilter,
  findAllForms,
  findPokemon,
  identifierFilter,
  listPokemon,
};
