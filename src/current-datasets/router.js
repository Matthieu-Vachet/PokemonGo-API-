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
    visibility: document.visibility || adapter.visibility,
    provider: document.source?.provider || null,
    url: document.source?.url || null,
    mode: document.source?.mode || null,
    event: document.source?.event || null,
    timezone: document.source?.timezone || null,
    selection: document.source?.selection || null,
    dynamicShellDetected: Boolean(document.source?.dynamicShellDetected),
    sourceDetails: document.source || null,
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
  const serializedCurrent = adapter.compactCurrent ? { ...current, data: undefined } : current;
  return {
    success: true,
    [action]: true,
    key: current.key,
    current: serializedCurrent,
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
    asyncHandler(async (request, response) => {
      if (adapter.visibility === "private") requireAdminSecret(request);
      const result = await readCurrentDatasetFromMongo({
        model: adapter.Model,
        domain: adapter.domain,
      });
      if (!result.ok) return response.status(result.status).json(result.body);
      const summary = adapter.summarize(result.data);
      const presented = typeof adapter.present === "function"
        ? adapter.present(result.data, request.query)
        : { data: result.data, meta: {} };
      const current = serializeCurrentDatasetDocument(result.document);
      if (adapter.compactCurrent) delete current.data;
      return response.json({
        data: presented.data,
        meta: { ...currentMeta(adapter, result.document, summary), ...(presented.meta || {}) },
        current,
      });
    }),
  );

  if (adapter.SnapshotModel && typeof adapter.historyPoints === "function") {
    router.get(
      "/:identity/history",
      asyncHandler(async (request, response) => {
        if (adapter.visibility === "private") requireAdminSecret(request);
        const days = Math.min(365, Math.max(1, Number.parseInt(request.query.days, 10) || 30));
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const snapshots = await adapter.SnapshotModel.find({ snapshotAt: { $gte: since } })
          .sort({ snapshotAt: 1 })
          .lean();
        const points = snapshots
          .map((snapshot) => adapter.historyPoints(snapshot, request.params.identity, request.query))
          .filter(Boolean);
        const statistics = typeof adapter.historySummary === "function"
          ? adapter.historySummary(points)
          : null;
        return response.json({
          data: points,
          meta: { domain: adapter.domain, identity: request.params.identity, days, total: points.length, statistics },
        });
      }),
    );
  }

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
