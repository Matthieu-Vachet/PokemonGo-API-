const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { MaxBattle } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");
const { buildPipelineReport, bucketStats, generateCurrentData } = require("../lib/current-data-pipeline");

const router = express.Router();
const maxBattlesFile = dataPath("max-battles", "currentsMaxBattle.json");
const maxBattlesJsonPath = "data/max-battles/currentsMaxBattle.json";

function readCurrentMaxBattlesFile() {
  if (!fs.existsSync(maxBattlesFile)) {
    throw new ApiError(404, "Fichier max-battles/currentsMaxBattle.json introuvable.", "MAX_BATTLES_NOT_FOUND");
  }
  return JSON.parse(fs.readFileSync(maxBattlesFile, "utf8"));
}

function maxBattleSummary(data) {
  const currentMaxBattle = data?.currentMaxBattle || {};
  return Object.fromEntries(
    Object.entries(currentMaxBattle).map(([key, pokemon]) => [key, Array.isArray(pokemon) ? pokemon.length : 0]),
  );
}

function maxBattleStats(_data, report, buckets) {
  return bucketStats(report, buckets);
}

async function regenerateCurrentMaxBattles() {
  return generateCurrentData({
    source: "max-battles",
    scriptName: "generateCurrentMaxBattles.js",
    exportName: "generateCurrentMaxBattles",
    jsonPath: maxBattlesJsonPath,
    summarize: maxBattleSummary,
    stats: maxBattleStats,
  });
}

async function readMongoCurrentMaxBattles() {
  if (mongoose.connection.readyState !== 1) return null;
  const document = await MaxBattle.findOne({ key: "current" }).lean();
  return document?.data || null;
}

async function upsertCurrentMaxBattles(data) {
  if (!data?.currentMaxBattle || typeof data.currentMaxBattle !== "object") {
    throw new ApiError(400, "Payload Max Battles invalide: currentMaxBattle requis.", "INVALID_MAX_BATTLES_PAYLOAD");
  }

  const sourceHash = hash(data);
  const document = await MaxBattle.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        key: "current",
        data,
        sourceFile: maxBattlesJsonPath,
        sourceHash,
        generatedAt: new Date(),
      },
    },
    { new: true, upsert: true },
  ).lean();

  return document;
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const source = String(request.query.source || "file").toLowerCase();
    const fromMongo = source === "mongo" ? await readMongoCurrentMaxBattles() : null;
    const data = fromMongo || readCurrentMaxBattlesFile();
    response.json({
      data,
      meta: {
        source: fromMongo ? "mongo" : "file",
        buckets: maxBattleSummary(data),
      },
    });
  }),
);

router.post(
  "/import",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const payload = request.body?.currentMaxBattle ? request.body : request.body?.data;
    const data = payload?.currentMaxBattle ? payload : (await readMongoCurrentMaxBattles()) || readCurrentMaxBattlesFile();
    const document = await upsertCurrentMaxBattles(data);
    const buckets = maxBattleSummary(document.data);
    const itemsParsed = Object.values(buckets).reduce((sum, count) => sum + Number(count || 0), 0);
    const report = buildPipelineReport({
      source: "max-battles",
      summary: buckets,
      stats: { itemsParsed, itemsMatched: itemsParsed },
      jsonPath: maxBattlesJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        imported: true,
        key: document.key,
        buckets,
        ...report,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const generated = await regenerateCurrentMaxBattles();
    const document = await upsertCurrentMaxBattles(generated.data);
    const report = buildPipelineReport({
      source: "max-battles",
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
      jsonPath: maxBattlesJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        regenerated: true,
        key: document.key,
        buckets: generated.summary,
        ...report,
      },
    });
  }),
);

module.exports = router;
