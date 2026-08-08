const express = require("express");
const { Pokemon, PokemonAssetFamily } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { findPokemon } = require("../services/pokemon-service");
const { presentPokemonList } = require("../services/pokemon-presenter");

const router = express.Router();

function backgroundFilter(query = {}) {
  const match = {};
  if (query.type) match["payload.type"] = String(query.type).toLowerCase();
  if (query.date) match["payload.date"] = {
    $regex: String(query.date),
    $options: "i",
  };
  return match;
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const filter = backgroundFilter(request.query);
    const data = await PokemonAssetFamily.aggregate([
      { $match: { family: "location-cards", "payload.0": { $exists: true } } },
      { $unwind: "$payload" },
      ...(request.query.type
        ? [{ $match: { "payload.type": String(request.query.type).toLowerCase() } }]
        : []),
      ...(request.query.date
        ? [{
            $match: {
              "payload.date": {
                $regex: String(request.query.date),
                $options: "i",
              },
            },
          }]
        : []),
      {
        $group: {
          _id: "$payload.id",
          background: { $first: "$payload" },
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
    const assets = await PokemonAssetFamily.find({
      family: "location-cards",
      "payload.id": request.params.id,
    })
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
    const pokemon = await findPokemon(request.params.identifier, {
      ...request.query,
      include: [request.query.include, "location-cards"].filter(Boolean).join(","),
    });
    const backgrounds = pokemon.data?.assets?.locationCards || [];
    response.json({
      data: backgrounds,
      meta: { pokemon: pokemon.key, total: backgrounds.length },
    });
  }),
);

module.exports = router;
