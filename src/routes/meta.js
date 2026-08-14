const express = require("express");
const { Move, Pokemon, Weather } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { versionMetadata } = require("../lib/version-metadata");

const router = express.Router();

router.get("/", (_request, response) => {
  response.json({ meta: versionMetadata() });
});

router.get(
  "/filters",
  asyncHandler(async (_request, response) => {
    const [forms, kinds, regions, generations, types, weather, leagues, moveTypes] =
      await Promise.all([
        Pokemon.distinct("form"),
        Pokemon.distinct("kind"),
        Pokemon.distinct("regionId"),
        Pokemon.distinct("generation"),
        Pokemon.distinct("types"),
        Weather.distinct("id"),
        Pokemon.distinct("pvpLeagues"),
        Move.distinct("type"),
      ]);
    response.json({
      data: { forms, kinds, regions, generations, types, weather, leagues, moveTypes },
    });
  }),
);

module.exports = router;
