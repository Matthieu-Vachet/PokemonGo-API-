const express = require("express");
const { Move, Pokemon, Type, Weather } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");

const router = express.Router();

async function findWeather(identifier) {
  const value = String(identifier);
  const weather = await Weather.findOne({
    $or: [
      { id: value },
      { slug: value.toLowerCase() },
      { searchTerms: value.toLowerCase() },
    ],
  }).lean();
  if (!weather)
    throw new ApiError(404, "Météo introuvable.", "WEATHER_NOT_FOUND");
  return weather;
}

router.get(
  "/",
  asyncHandler(async (_request, response) => {
    const data = await Weather.find().sort({ id: 1 }).lean();
    response.json({ data, meta: { total: data.length } });
  }),
);

router.get(
  "/:identifier/pokemon",
  asyncHandler(async (request, response) => {
    const weather = await findWeather(request.params.identifier);
    const data = await Pokemon.find({ weatherBoost: weather.id })
      .sort({ dexNr: 1, form: 1 })
      .lean();
    response.json({ data, meta: { weather: weather.id, total: data.length } });
  }),
);

router.get(
  "/:identifier/types",
  asyncHandler(async (request, response) => {
    const weather = await findWeather(request.params.identifier);
    const data = await Type.find({ "data.weatherBoost": weather.id })
      .sort({ id: 1 })
      .lean();
    response.json({ data, meta: { weather: weather.id, total: data.length } });
  }),
);

router.get(
  "/:identifier/moves",
  asyncHandler(async (request, response) => {
    const weather = await findWeather(request.params.identifier);
    const types = await Type.find({ "data.weatherBoost": weather.id })
      .distinct("id");
    const data = await Move.find({ type: { $in: types } })
      .sort({ type: 1, id: 1 })
      .lean();
    response.json({
      data,
      meta: { weather: weather.id, boostedTypes: types, total: data.length },
    });
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    response.json({ data: await findWeather(request.params.identifier) });
  }),
);

module.exports = router;
