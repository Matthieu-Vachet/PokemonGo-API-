const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { findPokemon } = require("../services/pokemon-service");
const { presentPokemonList } = require("../services/pokemon-presenter");

const router = express.Router();

function backgroundFilter(query = {}) {
  const match = {};
  if (query.type) match["data.assets.locationCards.type"] = String(query.type).toLowerCase();
  if (query.date) match["data.assets.locationCards.date"] = {
    $regex: String(query.date),
    $options: "i",
  };
  return match;
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const filter = backgroundFilter(request.query);
    const data = await Pokemon.aggregate([
      { $match: { "data.assets.locationCards.0": { $exists: true }, ...filter } },
      { $unwind: "$data.assets.locationCards" },
      ...(request.query.type
        ? [{ $match: { "data.assets.locationCards.type": String(request.query.type).toLowerCase() } }]
        : []),
      ...(request.query.date
        ? [{
            $match: {
              "data.assets.locationCards.date": {
                $regex: String(request.query.date),
                $options: "i",
              },
            },
          }]
        : []),
      {
        $group: {
          _id: "$data.assets.locationCards.id",
          background: { $first: "$data.assets.locationCards" },
          eligiblePokemon: { $addToSet: "$key" },
        },
      },
      { $sort: { "background.type": 1, "background.name": 1 } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              "$background",
              { eligiblePokemon: "$eligiblePokemon" },
            ],
          },
        },
      },
    ]);
    response.json({ data, meta: { total: data.length, filters: filter } });
  }),
);

router.get(
  "/:id/pokemon",
  asyncHandler(async (request, response) => {
    const data = await Pokemon.find({ "data.assets.locationCards.id": request.params.id })
      .sort({ dexNr: 1, form: 1 })
      .lean();
    if (!data.length)
      throw new ApiError(404, `Background introuvable : ${request.params.id}`, "BACKGROUND_NOT_FOUND");
    response.json({
      data: presentPokemonList(data),
      meta: { background: request.params.id, total: data.length },
    });
  }),
);

router.get(
  "/pokemon/:identifier",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    const backgrounds = pokemon.data?.assets?.locationCards || [];
    response.json({
      data: backgrounds,
      meta: { pokemon: pokemon.key, total: backgrounds.length },
    });
  }),
);

module.exports = router;
