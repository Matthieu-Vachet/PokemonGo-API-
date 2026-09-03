const express = require("express");
const { requireAdminSecret } = require("../lib/admin-auth");
const { asyncHandler } = require("../lib/async-handler");
const { paginatedResponse } = require("../lib/http");
const service = require("../services/adventure-effect-service");

const router = express.Router();

router.get("/", (request, response) => {
  const result = service.listEffects(request.query);
  response.json(paginatedResponse(result.items, result.total, result.page, result.limit, { locale: result.locale }));
});

router.get("/:identifier", (request, response) => {
  response.json({ data: service.hydrate(service.findEffect(request.params.identifier), request.query.locale || "en") });
});

router.post("/regenerate", asyncHandler(async (request, response) => {
  requireAdminSecret(request);
  response.json({ data: await service.synchronizeAdventureEffects() });
}));

module.exports = router;
