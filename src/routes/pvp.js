const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { pagination, paginatedResponse } = require("../lib/http");
const { normalizeLeague } = require("../lib/pvp");
const { findPokemon } = require("../services/pokemon-service");

const router = express.Router();

function dedicatedLeagueId(legacyLeagueId) {
  return {
    littleCup: "little",
    greatLeague: "great",
    ultraLeague: "ultra",
    masterLeague: "master",
  }[legacyLeagueId];
}

router.get(
  "/:league/rankings",
  asyncHandler(async (request, response) => {
    const leagueId = normalizeLeague(request.params.league);
    const dedicatedId = dedicatedLeagueId(leagueId);
    const { page, limit, skip } = pagination(request.query);
    const filter = { pvpLeagues: leagueId };
    const [items, total] = await Promise.all([
      Pokemon.find(filter)
        .sort({ [`data.pvpRecord.leagues.${dedicatedId}.variants.rank`]: 1, "maxCp.maxLevel50": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pokemon.countDocuments(filter),
    ]);
    response.json(paginatedResponse(items, total, page, limit, { league: leagueId }));
  }),
);

router.get(
  "/:league/top",
  asyncHandler(async (request, response) => {
    const leagueId = normalizeLeague(request.params.league);
    const dedicatedId = dedicatedLeagueId(leagueId);
    const { page, limit, skip } = pagination(request.query);
    const filter = { pvpLeagues: leagueId };
    const [items, total] = await Promise.all([
      Pokemon.find(filter)
        .sort({ [`data.pvpRecord.leagues.${dedicatedId}.variants.rank`]: 1, "maxCp.maxLevel50": -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Pokemon.countDocuments(filter),
    ]);
    response.json(paginatedResponse(items, total, page, limit, { league: leagueId }));
  }),
);

router.get(
  "/:league/:identifier",
  asyncHandler(async (request, response) => {
    const leagueId = normalizeLeague(request.params.league);
    const dedicatedId = dedicatedLeagueId(leagueId);
    const pokemon = await findPokemon(request.params.identifier, request.query);
    response.json({
      data: {
        pokemon: pokemon.key,
        league: leagueId,
        ranking: pokemon.data?.pvpRecord?.leagues?.[dedicatedId] || null,
        legacyRanking: pokemon.data?.pvp?.[leagueId] || null,
        pvpRef: pokemon.data?.pvpRef || null,
      },
    });
  }),
);

module.exports = router;
