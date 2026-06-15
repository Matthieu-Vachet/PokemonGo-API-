const express = require("express");
const { Move, Pokemon, SyncRun, Weather } = require("../models");
const { asyncHandler } = require("../lib/async-handler");

const router = express.Router();

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

router.get(
  "/sync",
  asyncHandler(async (_request, response) => {
    response.json({ data: await SyncRun.findOne().sort({ startedAt: -1 }).lean() });
  }),
);

module.exports = router;
