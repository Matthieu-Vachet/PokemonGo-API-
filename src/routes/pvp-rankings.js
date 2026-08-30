const express = require("express");
const { getCurrentDatasetAdapter } = require("../current-datasets/adapters");
const { createCurrentDatasetRouter } = require("../current-datasets/router");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { readCurrentDatasetFromMongo } = require("../lib/current-dataset-reader");
const { PvpRanking } = require("../models");
const { suggestedTeammatesFor } = require("../services/pvp-suggested-teammates-service");

const router = express.Router();

function teammateContext(current, league, speciesId) {
  const format = (current.data.formats || []).find((item) => item.id === league);
  if (!format) throw new ApiError(404, "Format PvPoke introuvable.", "PVP_FORMAT_NOT_FOUND");
  const rankings = current.data.leagues?.[league]?.rankings || [];
  const ranking = rankings.find((item) => item.sourceIdentity?.speciesId === speciesId);
  if (!ranking) return null;
  return {
    league: format.id,
    sourceGroup: format.sourceGroup,
    cp: format.cp,
    speciesId: ranking.sourceIdentity.speciesId,
    sourceHash: current.document.sourceHash,
    rankings,
  };
}

router.get("/:league/:speciesId/teammates", asyncHandler(async (request, response) => {
  const current = await readCurrentDatasetFromMongo({ model: PvpRanking, domain: "pvp-rankings" });
  if (!current.ok) return response.status(current.status).json(current.body);
  const context = teammateContext(current, request.params.league, request.params.speciesId);
  if (!context) {
    response.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
    return response.json({
      data: [],
      meta: {
        source: "pvpoke-ranked-dataset",
        sourceUrl: null,
        fetchedAt: null,
        cache: "not-applicable",
        total: 0,
        diagnostics: [],
        emptyReason: "RANKING_NOT_FOUND",
      },
    });
  }
  const result = await suggestedTeammatesFor(context);
  response.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return response.json({
    data: result.items,
    meta: {
      source: "pvpoke-ranked-dataset",
      strategy: result.sourceStrategy,
      sourceUrl: result.sourceUrl,
      fetchedAt: result.fetchedAt,
      cache: result.cache,
      total: result.items.length,
      diagnostics: result.diagnostics,
      emptyReason: result.emptyReason || null,
      persistenceWarnings: result.persistenceWarnings || [],
    },
  });
}));

router.use(createCurrentDatasetRouter(getCurrentDatasetAdapter("pvp-rankings")));

module.exports = router;
module.exports.teammateContext = teammateContext;
