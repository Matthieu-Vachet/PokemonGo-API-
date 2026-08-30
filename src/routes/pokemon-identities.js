const express = require("express");
const { ApiError } = require("../lib/api-error");
const { requireAdminSecret } = require("../lib/admin-auth");
const { asyncHandler } = require("../lib/async-handler");
const service = require("../services/pokemon-identity-service");
const inventoryService = require("../services/pokemon-local-identity-inventory-service");
const syncService = require("../services/pokemon-identity-sync-service");
const canonicalAssetService = require("../services/pokemon-canonical-asset-service");

const router = express.Router();

router.use((request, response, next) => {
  requireAdminSecret(request);
  response.set("Cache-Control", "private, no-store");
  next();
});

function user(request) {
  return request.get("x-admin-user") || "dashboard-admin";
}

router.get("/", asyncHandler(async (request, response) => {
  const result = await service.listIdentities(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, stats: result.stats, source: "mongodb", visibility: "private" } });
}));

router.get("/conflicts", asyncHandler(async (_request, response) => {
  response.json({ data: await service.conflicts(), meta: { source: "mongodb", visibility: "private" } });
}));

router.get("/history", asyncHandler(async (request, response) => {
  const result = await service.listHistory(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, source: "mongodb", visibility: "private" } });
}));

router.get("/diagnostics", asyncHandler(async (request, response) => {
  const result = await service.listDiagnostics(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, source: "mongodb", visibility: "private" } });
}));

router.get("/diagnostics/summary", asyncHandler(async (_request, response) => {
  response.json({ data: await service.diagnosticSummary(), meta: { source: "identity-manager", visibility: "private" } });
}));

router.get("/providers", asyncHandler(async (_request, response) => {
  response.json({ data: await service.listProviders(), meta: { source: "identity-manager", visibility: "private" } });
}));

router.get("/inventory", asyncHandler(async (request, response) => {
  const result = inventoryService.searchLocalIdentities(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, stats: result.stats, inventory: result.metadata, source: "PokemonGo-Data", visibility: "private" } });
}));

router.get("/sync/preview", asyncHandler(async (_request, response) => {
  const plan = await syncService.previewIdentitySync({ forceInventory: true });
  response.json({ data: syncService.reportFromPlan(plan, "dry-run"), meta: { digest: syncService.syncPlanDigest(plan), visibility: "private" } });
}));

router.post("/sync/apply", asyncHandler(async (request, response) => {
  const result = await syncService.applyIdentitySync({ requestedBy: user(request), forceInventory: true });
  service.invalidateIdentityCache();
  response.json({ data: result, meta: { visibility: "private" } });
}));

router.get("/export", asyncHandler(async (request, response) => {
  const result = await service.listIdentities({ ...request.query, page: 1, limit: 200 });
  const pages = [result.items];
  for (let page = 2; page <= result.pagination.pages; page += 1) {
    pages.push((await service.listIdentities({ ...request.query, page, limit: 200 })).items);
  }
  response.set("Content-Disposition", `attachment; filename=\"pokemon-identities-${new Date().toISOString().slice(0, 10)}.json\"`);
  response.type("application/json").send(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), identities: pages.flat() }, null, 2));
}));

router.post("/", asyncHandler(async (request, response) => {
  response.status(201).json({ data: await service.createIdentity(request.body, user(request)) });
}));

router.post("/resolve", asyncHandler(async (request, response) => {
  response.json({ data: await service.resolveAlias(request.body) });
}));

router.post("/resolve-assets", asyncHandler(async (request, response) => {
  const data = await canonicalAssetService.resolveProviderPokemonAssets(request.body?.requests);
  response.json({
    data,
    meta: {
      total: data.length,
      matched: data.filter((entry) => entry.status === "matched").length,
      visibility: "private",
    },
  });
}));

router.post("/import", asyncHandler(async (request, response) => {
  response.json({ data: await service.importIdentities(request.body, user(request)) });
}));

router.post("/diagnostics", asyncHandler(async (request, response) => {
  response.status(201).json({ data: await service.recordDiagnostic(request.body) });
}));

router.post("/diagnostics/batch", asyncHandler(async (request, response) => {
  const entries = Array.isArray(request.body?.entries) ? request.body.entries : [];
  if (!entries.length || entries.length > 500) {
    throw new ApiError(422, "Le lot de diagnostics doit contenir entre 1 et 500 entrées.", "IDENTITY_DIAGNOSTIC_BATCH_INVALID");
  }
  response.status(201).json({ data: await service.recordDiagnosticsBatch(entries), meta: { visibility: "private", limit: 500 } });
}));

router.post("/diagnostics/reconcile", asyncHandler(async (request, response) => {
  response.json({ data: await service.reconcileDiagnosticsWithAliases(user(request)), meta: { visibility: "private" } });
}));

router.patch("/diagnostics/:diagnosticId", asyncHandler(async (request, response) => {
  response.json({ data: await service.updateDiagnostic(request.params.diagnosticId, request.body, user(request)) });
}));

router.get("/:identityId", asyncHandler(async (request, response) => {
  response.json({ data: await service.getIdentity(request.params.identityId), meta: { source: "mongodb", visibility: "private" } });
}));

router.patch("/:identityId", asyncHandler(async (request, response) => {
  response.json({ data: await service.updateIdentity(request.params.identityId, request.body, user(request)) });
}));

router.delete("/:identityId", asyncHandler(async (request, response) => {
  response.json({ data: await service.deprecateIdentity(request.params.identityId, request.body?.reason || request.query.reason, user(request)) });
}));

router.post("/:identityId/restore", asyncHandler(async (request, response) => {
  response.json({ data: await service.restoreIdentity(request.params.identityId, user(request)) });
}));

router.post("/:identityId/merge", asyncHandler(async (request, response) => {
  response.json({ data: await service.mergeIdentities(request.params.identityId, request.body?.targetId, request.body?.reason, user(request)) });
}));

router.post("/:identityId/aliases", asyncHandler(async (request, response) => {
  response.status(201).json({ data: await service.addAlias(request.params.identityId, request.body, user(request)) });
}));

router.patch("/:identityId/aliases/:aliasId", asyncHandler(async (request, response) => {
  response.json({ data: await service.updateAlias(request.params.identityId, request.params.aliasId, request.body, user(request)) });
}));

module.exports = router;
