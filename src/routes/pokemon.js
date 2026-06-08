const express = require("express");
const { Move, Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { paginatedResponse } = require("../lib/http");
const {
  findAllForms,
  findPokemon,
  listPokemon,
} = require("../services/pokemon-service");
const {
  directEvolutions,
  evolutionChain,
} = require("../services/evolution-service");
const { calculateCp, buildCpByLevel } = require("../lib/pokemon-cp");
const {
  moveIds,
  presentPokemon,
  presentPokemonList,
} = require("../services/pokemon-presenter");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const result = await listPokemon(request.query);
    response.json(
      paginatedResponse(result.items, result.total, result.page, result.limit, {
        filters: result.filter,
        sort: result.sort,
      }),
    );
  }),
);

router.get(
  "/random",
  asyncHandler(async (request, response) => {
    const match = request.query.released === "true" ? { "flags.released": true } : {};
    const [pokemon] = await Pokemon.aggregate([{ $match: match }, { $sample: { size: 1 } }]);
    response.json({ data: presentPokemon(pokemon || null) });
  }),
);

for (const [route, field] of [
  ["/slug/:value", "slug"],
  ["/id/:value", "id"],
  ["/dex/:value", "dexNr"],
  ["/form-id/:value", "formId"],
]) {
  router.get(
    route,
    asyncHandler(async (request, response) => {
      const value = field === "dexNr" ? Number(request.params.value) : request.params.value;
      const data = await Pokemon.find({ [field]: value }).sort({ form: 1 }).lean();
      response.json({ data: presentPokemonList(data), meta: { total: data.length } });
    }),
  );
}

router.get(
  "/:identifier/forms",
  asyncHandler(async (request, response) => {
    response.json({ data: await findAllForms(request.params.identifier) });
  }),
);

router.get(
  "/:identifier/evolutions",
  asyncHandler(async (request, response) => {
    response.json({ data: await directEvolutions(request.params.identifier) });
  }),
);

router.get(
  "/:identifier/evolution-chain",
  asyncHandler(async (request, response) => {
    response.json({ data: await evolutionChain(request.params.identifier) });
  }),
);

router.get(
  "/:identifier/cp",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    const level = Number(request.query.level);
    if (Number.isFinite(level)) {
      const ivs = {
        attack: Number(request.query.attackIv || 15),
        defense: Number(request.query.defenseIv || 15),
        stamina: Number(request.query.staminaIv || 15),
      };
      return response.json({
        data: {
          pokemon: pokemon.key,
          level,
          ivs,
          cp: calculateCp(pokemon.stats, level, ivs),
        },
      });
    }
    return response.json({
      data: { pokemon: pokemon.key, levels: buildCpByLevel(pokemon.stats) },
    });
  }),
);

router.get(
  "/:identifier/assets",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    response.json({
      data: {
        key: pokemon.key,
        assets: pokemon.data?.assets || {},
        forms: pokemon.data?.assetForms || [],
      },
    });
  }),
);

router.get(
  "/:identifier/moves",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    const categories = {
      quickMoves: moveIds(pokemon.data?.quickMoves),
      cinematicMoves: moveIds(pokemon.data?.cinematicMoves),
      eliteQuickMoves: moveIds(pokemon.data?.eliteQuickMoves),
      eliteCinematicMoves: moveIds(pokemon.data?.eliteCinematicMoves),
    };
    const ids = [...new Set(Object.values(categories).flat())];
    const moves = await Move.find({ id: { $in: ids } }).lean();
    const byId = new Map(moves.map((move) => [move.id, move]));

    response.json({
      data: Object.fromEntries(
        Object.entries(categories).map(([category, moveIds]) => [
          category,
          moveIds.map((id) => byId.get(id)).filter(Boolean),
        ]),
      ),
      meta: { pokemon: pokemon.key, total: ids.length },
    });
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    response.json({ data: await findPokemon(request.params.identifier, request.query) });
  }),
);

module.exports = router;
