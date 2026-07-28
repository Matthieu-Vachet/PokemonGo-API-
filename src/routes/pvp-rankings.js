const express = require("express");
const { getCurrentDatasetAdapter } = require("../current-datasets/adapters");
const { createCurrentDatasetRouter } = require("../current-datasets/router");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { readCurrentDatasetFromMongo } = require("../lib/current-dataset-reader");
const { PvpRanking } = require("../models");
const { suggestedTeammatesFor } = require("../services/pvp-suggested-teammates-service");

const router = express.Router();

router.get("/:league/:speciesId/teammates", asyncHandler(async (request, response) => {
  const current = await readCurrentDatasetFromMongo({ model: PvpRanking, domain: "pvp-rankings" });
  if (!current.ok) return response.status(current.status).json(current.body);
  const format = (current.data.formats || []).find((item) => item.id === request.params.league);
  const ranking = current.data.leagues?.[request.params.league]?.rankings?.find((item) => item.sourceIdentity?.speciesId === request.params.speciesId);
  if (!format || !ranking) throw new ApiError(404, "Pokémon ou format PvPoke introuvable.", "PVP_RANKING_NOT_FOUND");
  const result = await suggestedTeammatesFor({
    league: format.id,
    sourceGroup: format.sourceGroup,
    cp: format.cp,
    speciesId: ranking.sourceIdentity.speciesId,
    sourceHash: current.document.sourceHash,
  });
  response.set("Cache-Control", "public, max-age=300, stale-while-revalidate=3600");
  return response.json({ data: result.items, meta: { source: "pvpoke-browser", sourceUrl: result.sourceUrl, fetchedAt: result.fetchedAt, cache: result.cache, total: result.items.length, diagnostics: result.diagnostics } });
}));

router.use(createCurrentDatasetRouter(getCurrentDatasetAdapter("pvp-rankings")));

module.exports = router;
