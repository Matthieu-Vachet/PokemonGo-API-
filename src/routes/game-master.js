const express = require("express");
const { requireAdminSecret } = require("../lib/admin-auth");
const { asyncHandler } = require("../lib/async-handler");
const service = require("../services/game-master-explorer-service");

const router = express.Router();

router.use((request, response, next) => {
  requireAdminSecret(request);
  response.set("Cache-Control", "private, no-store");
  next();
});

router.get("/summary", asyncHandler(async (_request, response) => {
  response.json({ data: await service.summary(), meta: { source: "mongodb", visibility: "private" } });
}));

router.get("/categories", asyncHandler(async (_request, response) => {
  response.json({ data: await service.categories(), meta: { source: "mongodb", visibility: "private" } });
}));

router.get("/templates", asyncHandler(async (request, response) => {
  const result = await service.listTemplates(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, filters: result.filters, source: "mongodb", visibility: "private" } });
}));

router.get("/search", asyncHandler(async (request, response) => {
  const result = await service.listTemplates({ ...request.query, q: request.query.q || request.query.search });
  response.json({ data: result.items, meta: { ...result.pagination, filters: result.filters, mode: request.query.match === "exact" ? "exact" : "partial", source: "mongodb", visibility: "private" } });
}));

router.get("/templates/:templateId", asyncHandler(async (request, response) => {
  response.json({ data: await service.getTemplate(request.params.templateId), meta: { source: "mongodb", visibility: "private" } });
}));

router.get("/local-comparison", asyncHandler(async (request, response) => {
  const result = await service.listLocalComparison(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, source: "mongodb", visibility: "private" } });
}));

router.get("/snapshots", asyncHandler(async (request, response) => {
  const result = await service.listSnapshots(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, source: "mongodb", visibility: "private" } });
}));

router.get("/runs", asyncHandler(async (request, response) => {
  const result = await service.listRuns(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, source: "mongodb", visibility: "private" } });
}));

router.get("/snapshots/:snapshotId", asyncHandler(async (request, response) => {
  response.json({ data: await service.getSnapshot(request.params.snapshotId), meta: { source: "mongodb", visibility: "private" } });
}));

router.get("/diff", asyncHandler(async (request, response) => {
  const result = await service.listDiff(request.query);
  response.json({ data: result.items, meta: { ...result.pagination, from: result.from, to: result.to, source: "mongodb", visibility: "private" } });
}));

router.get("/export", asyncHandler(async (request, response) => {
  const data = await service.exportData(request.query);
  const format = String(request.query.format || "json").toLowerCase();
  const fileName = `game-master-${String(request.query.scope || "templates")}-${new Date().toISOString().slice(0, 10)}`;
  response.set("Content-Disposition", `attachment; filename=\"${fileName}.${format === "csv" ? "csv" : "json"}\"`);
  if (format !== "csv") return response.type("application/json").send(JSON.stringify(data, null, 2));
  const keys = [...new Set(data.flatMap((entry) => Object.keys(entry).filter((key) => !["raw", "flattenedPaths", "changes"].includes(key))))];
  const cell = (value) => `\"${String(value ?? "").replace(/\"/g, '\"\"')}\"`;
  const csv = [keys.map(cell).join(","), ...data.map((entry) => keys.map((key) => cell(typeof entry[key] === "object" ? JSON.stringify(entry[key]) : entry[key])).join(","))].join("\n");
  return response.type("text/csv; charset=utf-8").send(`\uFEFF${csv}`);
}));

router.post("/regenerate", asyncHandler(async (_request, response) => {
  response.json({ data: await service.regenerate() });
}));

router.post("/reindex", asyncHandler(async (request, response) => {
  response.json({ data: await service.reindex(request.body?.continuation || request.body || {}) });
}));

module.exports = router;
