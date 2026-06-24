const express = require("express");
const { PokemonAsset } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { pagination, paginatedResponse, boolean } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");

const router = express.Router();

function variantFilter(query = {}) {
  const filter = {};
  if (query.state) filter["assets.shuffle.variants.state"] = String(query.state).toLowerCase();
  if (query.form) filter["assets.shuffle.variants.form"] = String(query.form).toLowerCase();
  const shiny = boolean(query.shiny);
  if (shiny !== undefined) filter["assets.shuffle.variants.shiny"] = shiny;
  if (query.q)
    filter["assets.shuffle.variants.filename"] = {
      $regex: String(query.q),
      $options: "i",
    };
  return filter;
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = variantFilter(request.query);
    const [result] = await PokemonAsset.aggregate([
      { $match: { "assets.shuffle.variants.0": { $exists: true } } },
      { $unwind: "$assets.shuffle.variants" },
      ...(Object.keys(filter).length ? [{ $match: filter }] : []),
      {
        $lookup: {
          from: "pokemons",
          localField: "formId",
          foreignField: "formId",
          as: "pokemonDocument",
        },
      },
      { $unwind: { path: "$pokemonDocument", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          pokemon: {
            key: "$key",
            formId: "$formId",
            slug: "$slug",
            dexNr: "$dexNr",
            dexId: "$dexId",
            form: "$form",
            names: "$pokemonDocument.names",
            types: "$pokemonDocument.types",
            primaryType: "$pokemonDocument.primaryType",
            secondaryType: "$pokemonDocument.secondaryType",
          },
          asset: "$assets.shuffle.variants",
        },
      },
      { $sort: { "pokemon.dexNr": 1, "asset.filename": 1 } },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          count: [{ $count: "total" }],
        },
      },
    ]);
    const items = result?.items || [];
    const total = result?.count?.[0]?.total || 0;
    response.json(
      paginatedResponse(items, total, page, limit, { filters: filter }),
    );
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    const variants = pokemon.data?.assets?.shuffle?.variants || [];
    response.json({
      data: variants,
      meta: { pokemon: pokemon.key, total: variants.length },
    });
  }),
);

module.exports = router;
