const express = require("express");
const { Move, Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { integer } = require("../lib/http");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const q = String(request.query.q || "").trim();
    if (q.length < 2)
      throw new ApiError(400, "Le paramètre q doit contenir au moins 2 caractères.", "INVALID_SEARCH");
    const regex = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const limit = integer(request.query.limit, 20, { min: 1, max: 50 });
    const [pokemon, moves] = await Promise.all([
      Pokemon.find({ searchTerms: regex }).sort({ dexNr: 1 }).limit(limit).lean(),
      Move.find({ searchTerms: regex }).sort({ kind: 1, id: 1 }).limit(limit).lean(),
    ]);
    response.json({
      data: { pokemon, moves },
      meta: { query: q, pokemon: pokemon.length, moves: moves.length },
    });
  }),
);

module.exports = router;
