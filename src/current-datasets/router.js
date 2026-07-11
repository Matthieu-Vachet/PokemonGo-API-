const express = require("express");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { asyncHandler } = require("../lib/async-handler");
const {
  importCurrentDataset,
  regenerateCurrentDataset,
} = require("../lib/current-dataset-pipeline");
const {
  MONGODB_SOURCE,
  readCurrentDatasetFromMongo,
  serializeCurrentDatasetDocument,
} = require("../lib/current-dataset-reader");

function dynamicHeaders(response) {
  response.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.set("Pragma", "no-cache");
  response.set("Expires", "0");
}

function currentMeta(adapter, document, summary) {
  return {
    source: MONGODB_SOURCE,
    domain: adapter.domain,
    provider: document.source?.provider || null,
    url: document.source?.url || null,
    mode: document.source?.mode || null,
    event: document.source?.event || null,
    fetchedAt: document.source?.fetchedAt || null,
    generatedAt: document.generatedAt || null,
    savedAt: document.savedAt || document.updatedAt || null,
    count: Number(document.count ?? adapter.count(document.data, summary)),
    sourceHash: document.sourceHash || null,
    status: document.status || "success",
    diagnostics: document.diagnostics || null,
    [adapter.metaKey]: summary,
  };
}

function actionPayload(adapter, result, action) {
  const { current, summary, stats, report } = result;
  return {
    success: true,
    [action]: true,
    key: current.key,
    current,
    [adapter.metaKey]: summary,
    source: MONGODB_SOURCE,
    sourceUrl: current.source?.url || null,
    itemsParsed: Number(stats.itemsParsed || 0),
    itemsMatched: Number(stats.itemsMatched || 0),
    itemsUnmatched: Number(stats.itemsUnmatched || 0),
    mongoUpdated: true,
    changed: Boolean(current.diagnostics?.diff?.changed),
    diff: current.diagnostics?.diff || null,
    report,
  };
}

function createCurrentDatasetRouter(adapter) {
  const router = express.Router();

  router.use((_request, response, next) => {
    dynamicHeaders(response);
    next();
  });

  router.get(
    "/",
    asyncHandler(async (_request, response) => {
      const result = await readCurrentDatasetFromMongo({
        model: adapter.Model,
        domain: adapter.domain,
      });
      if (!result.ok) return response.status(result.status).json(result.body);
      const summary = adapter.summarize(result.data);
      return response.json({
        data: result.data,
        meta: currentMeta(adapter, result.document, summary),
        current: serializeCurrentDatasetDocument(result.document),
      });
    }),
  );

  router.post(
    "/import",
    asyncHandler(async (request, response) => {
      requireAdminSecret(request);
      const payload = request.body?.[adapter.rootKey] ? request.body : request.body?.data;
      if (!payload?.[adapter.rootKey]) {
        throw new ApiError(
          400,
          `Un payload explicite contenant ${adapter.rootKey} est requis. Aucun JSON local ne sera importe automatiquement.`,
          "CURRENT_IMPORT_PAYLOAD_REQUIRED",
          { domain: adapter.domain },
        );
      }
      const result = await importCurrentDataset(adapter, payload);
      return response.json({
        data: {
          ...actionPayload(adapter, result, "imported"),
          importedFrom: "request",
        },
      });
    }),
  );

  router.post(
    "/regenerate",
    asyncHandler(async (request, response) => {
      requireAdminSecret(request);
      const result = await regenerateCurrentDataset(adapter);
      return response.json({ data: actionPayload(adapter, result, "regenerated") });
    }),
  );

  return router;
}

module.exports = {
  actionPayload,
  createCurrentDatasetRouter,
  currentMeta,
};
