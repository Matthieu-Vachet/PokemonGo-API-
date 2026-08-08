const express = require("express");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { csv } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");
const { calculateCp } = require("../lib/pokemon-cp");

const router = express.Router();

router.get(
  "/pokemon",
  asyncHandler(async (request, response) => {
    const identifiers = csv(request.query.ids);
    if (identifiers.length < 2 || identifiers.length > 10) {
      throw new ApiError(400, "ids doit contenir entre 2 et 10 Pokémon.", "INVALID_COMPARISON");
    }
    const pokemon = await Promise.all(identifiers.map((id) => findPokemon(id)));
    const level = Number(request.query.level || 50);
    response.json({
      data: pokemon.map((item) => ({
        key: item.key,
        names: item.names,
        form: item.form,
        types: item.types,
        stats: item.stats,
        maxCp: item.maxCp,
        cpAtLevel: calculateCp(item.stats, level, {
          attack: 15,
          defense: 15,
          stamina: 15,
        }),
        pvp: item.data?.pvpRecord || item.data?.pvp || {},
        pvpRef: item.data?.pvpRef || null,
      })),
      meta: { level },
    });
  }),
);

module.exports = router;
