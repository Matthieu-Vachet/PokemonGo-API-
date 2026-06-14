const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");

const router = express.Router();

function shadowResponse(pokemon) {
  return {
    pokemon: {
      key: pokemon.key,
      id: pokemon.id,
      formId: pokemon.formId,
      slug: pokemon.slug,
      dexNr: pokemon.dexNr,
      dexId: pokemon.dexId,
      form: pokemon.form,
      names: pokemon.names,
    },
    shadow: pokemon.data?.shadow || null,
  };
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = {
      "flags.shadow": true,
      "data.shadow": { $exists: true },
    };
    if (request.query.variant)
      filter["data.shadow.variants.variant"] = String(request.query.variant);
    if (request.query.releasedFrom || request.query.releasedTo) {
      filter["data.shadow.firstReleaseDate"] = {};
      if (request.query.releasedFrom)
        filter["data.shadow.firstReleaseDate"].$gte = String(request.query.releasedFrom);
      if (request.query.releasedTo)
        filter["data.shadow.firstReleaseDate"].$lte = String(request.query.releasedTo);
    }
    const [items, total] = await Promise.all([
      Pokemon.find(filter)
        .select("key id formId slug dexNr dexId form names data.shadow")
        .sort({ "data.shadow.firstReleaseDate": 1, dexNr: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pokemon.countDocuments(filter),
    ]);
    response.json(
      paginatedResponse(items.map(shadowResponse), total, page, limit, {
        filters: filter,
      }),
    );
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    if (!pokemon.data?.shadow)
      throw new ApiError(
        404,
        `Version Shadow non sortie : ${request.params.identifier}`,
        "SHADOW_NOT_FOUND",
      );
    response.json({ data: shadowResponse(pokemon) });
  }),
);

module.exports = router;
