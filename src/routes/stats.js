const express = require("express");
const { GlobalStat, Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { integer } = require("../lib/http");

const router = express.Router();
const rankings = {
  attack: "stats.attack",
  defense: "stats.defense",
  stamina: "stats.stamina",
  cp: "maxCp.maxLevel50",
};

router.get(
  "/global",
  asyncHandler(async (_request, response) => {
    const stats = await GlobalStat.findOne({ key: "global" }).lean();
    response.json({ data: stats?.data || null, meta: { generatedAt: stats?.generatedAt } });
  }),
);

router.get(
  "/top/:metric",
  asyncHandler(async (request, response) => {
    const field = rankings[request.params.metric];
    if (!field) throw new ApiError(400, "Classement inconnu.", "INVALID_RANKING");
    const limit = integer(request.query.limit, 25, { min: 1, max: 100 });
    const data = await Pokemon.find({ [field]: { $ne: null } })
      .sort({ [field]: -1, dexNr: 1 })
      .limit(limit)
      .lean();
    response.json({ data, meta: { metric: request.params.metric, field, limit } });
  }),
);

module.exports = router;
