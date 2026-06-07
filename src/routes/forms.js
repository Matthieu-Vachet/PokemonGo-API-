const express = require("express");
const { Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { pagination, paginatedResponse } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");

function kindRouter(kind) {
  const router = express.Router();
  router.get(
    "/",
    asyncHandler(async (request, response) => {
      const { page, limit, skip } = pagination(request.query);
      const filter = { kind };
      const [items, total] = await Promise.all([
        Pokemon.find(filter).sort({ dexNr: 1, form: 1 }).skip(skip).limit(limit).lean(),
        Pokemon.countDocuments(filter),
      ]);
      response.json(paginatedResponse(items, total, page, limit));
    }),
  );
  router.get(
    "/:identifier",
    asyncHandler(async (request, response) => {
      response.json({
        data: await findPokemon(request.params.identifier, {
          ...request.query,
          kind,
        }),
      });
    }),
  );
  return router;
}

module.exports = {
  gigantamax: kindRouter("gigantamax"),
  mega: kindRouter("mega"),
  regional: kindRouter("regional"),
};
