const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { pagination, paginatedResponse, boolean } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");

const router = express.Router();

function variantFilter(query = {}) {
  const filter = {};
  if (query.state) filter["data.assets.shuffle.variants.state"] = String(query.state).toLowerCase();
  if (query.form) filter["data.assets.shuffle.variants.form"] = String(query.form).toLowerCase();
  const shiny = boolean(query.shiny);
  if (shiny !== undefined) filter["data.assets.shuffle.variants.shiny"] = shiny;
  if (query.q)
    filter["data.assets.shuffle.variants.filename"] = {
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
    const [result] = await Pokemon.aggregate([
      { $match: { "data.assets.shuffle.variants.0": { $exists: true } } },
      { $unwind: "$data.assets.shuffle.variants" },
      ...(Object.keys(filter).length ? [{ $match: filter }] : []),
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
            names: "$names",
          },
          asset: "$data.assets.shuffle.variants",
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
