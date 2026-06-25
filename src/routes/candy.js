const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse } = require("../lib/http");
const { hydratePokemonAssetsBatch } = require("../services/pokemon-service");

const router = express.Router();

const projection = {
  key: 1,
  kind: 1,
  id: 1,
  formId: 1,
  slug: 1,
  dexNr: 1,
  dexId: 1,
  form: 1,
  generation: 1,
  names: 1,
  types: 1,
  primaryType: 1,
  secondaryType: 1,
  "data.assets.candy": 1,
  "data.assets.image": 1,
  "data.assets.portrait": 1,
  "data.assets.home.image": 1,
};

function pokemonName(doc) {
  return doc.names?.French || doc.names?.English || doc.slug || doc.id;
}

function pokemonPreview(doc) {
  return {
    key: doc.key,
    kind: doc.kind,
    id: doc.id,
    formId: doc.formId,
    slug: doc.slug,
    dexNr: doc.dexNr,
    dexId: doc.dexId,
    form: doc.form,
    generation: doc.generation,
    name: pokemonName(doc),
    names: doc.names,
    types: doc.types,
    primaryType: doc.primaryType,
    secondaryType: doc.secondaryType,
    image:
      doc.data?.assets?.portrait ||
      doc.data?.assets?.home?.image ||
      doc.data?.assets?.image ||
      null,
  };
}

function groupCandies(docs) {
  const groups = new Map();
  for (const doc of docs) {
    const candy = doc.data?.assets?.candy;
    if (!candy || (candy.familyId === undefined && candy.familyId !== 0)) continue;
    const key = String(candy.familyId);
    const current =
      groups.get(key) || {
        familyId: candy.familyId,
        image: candy.image || null,
        primaryColor: candy.primaryColor || null,
        secondaryColor: candy.secondaryColor || null,
        pokemon: [],
      };
    current.image ||= candy.image || null;
    current.primaryColor ||= candy.primaryColor || null;
    current.secondaryColor ||= candy.secondaryColor || null;
    current.pokemon.push(pokemonPreview(doc));
    groups.set(key, current);
  }
  return [...groups.values()].sort((left, right) => Number(left.familyId) - Number(right.familyId));
}

async function candyGroups() {
  const docs = await Pokemon.find(
    { "data.assets.candy.familyId": { $exists: true } },
    projection,
  )
    .sort({ dexNr: 1, form: 1, kind: 1 })
    .lean();
  return groupCandies(await hydratePokemonAssetsBatch(docs));
}

function matchesQuery(group, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [
    group.familyId,
    group.image,
    ...group.pokemon.flatMap((pokemon) => [
      pokemon.name,
      pokemon.id,
      pokemon.formId,
      pokemon.slug,
      pokemon.dexId,
      pokemon.form,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const q = String(request.query.q || "").trim();
    const familyId = String(request.query.familyId || "").trim();
    const groups = (await candyGroups()).filter(
      (group) =>
        (!familyId || String(group.familyId) === familyId) &&
        matchesQuery(group, q),
    );
    response.json(
      paginatedResponse(groups.slice(skip, skip + limit), groups.length, page, limit, {
        families: groups.length,
      }),
    );
  }),
);

router.get(
  "/:familyId",
  asyncHandler(async (request, response) => {
    const group = (await candyGroups()).find(
      (item) => String(item.familyId) === String(request.params.familyId),
    );
    if (!group)
      throw new ApiError(404, `Famille candy introuvable : ${request.params.familyId}`, "CANDY_NOT_FOUND");
    response.json({ data: group });
  }),
);

router.get(
  "/:familyId/pokemon",
  asyncHandler(async (request, response) => {
    const group = (await candyGroups()).find(
      (item) => String(item.familyId) === String(request.params.familyId),
    );
    if (!group)
      throw new ApiError(404, `Famille candy introuvable : ${request.params.familyId}`, "CANDY_NOT_FOUND");
    response.json({ data: group.pokemon, meta: { total: group.pokemon.length, familyId: group.familyId } });
  }),
);

module.exports = router;
