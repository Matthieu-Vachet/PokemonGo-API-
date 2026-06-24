const express = require("express");
const { Pokemon, PokemonAsset } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { findPokemon } = require("../services/pokemon-service");
const { presentPokemonList } = require("../services/pokemon-presenter");

const router = express.Router();

function backgroundFilter(query = {}) {
  const match = {};
  if (query.type) match["assets.locationCards.type"] = String(query.type).toLowerCase();
  if (query.date) match["assets.locationCards.date"] = {
    $regex: String(query.date),
    $options: "i",
  };
  return match;
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const filter = backgroundFilter(request.query);
    const data = await PokemonAsset.aggregate([
      { $match: { "assets.locationCards.0": { $exists: true }, ...filter } },
      { $unwind: "$assets.locationCards" },
      ...(request.query.type
        ? [{ $match: { "assets.locationCards.type": String(request.query.type).toLowerCase() } }]
        : []),
      ...(request.query.date
        ? [{
            $match: {
              "assets.locationCards.date": {
                $regex: String(request.query.date),
                $options: "i",
              },
            },
          }]
        : []),
      {
        $group: {
          _id: "$assets.locationCards.id",
          background: { $first: "$assets.locationCards" },
          eligiblePokemon: { $addToSet: "$formId" },
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
    const assets = await PokemonAsset.find({ "assets.locationCards.id": request.params.id })
      .select("formId")
      .lean();
    const formIds = assets.map((asset) => asset.formId);
    const data = await Pokemon.find({ formId: { $in: formIds } })
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
