const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Egg } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");
const { buildPipelineReport, bucketStats, generateCurrentData } = require("../lib/current-data-pipeline");

const router = express.Router();
const eggsFile = dataPath("eggs", "currentEggs.json");
const eggsJsonPath = "data/eggs/currentEggs.json";

function readCurrentEggsFile() {
  if (!fs.existsSync(eggsFile)) {
    throw new ApiError(404, "Fichier eggs/currentEggs.json introuvable.", "EGGS_NOT_FOUND");
  }
  return JSON.parse(fs.readFileSync(eggsFile, "utf8"));
}

function eggSummary(data) {
  const currentEggsList = data?.currentEggsList || {};
  return Object.fromEntries(
    Object.entries(currentEggsList).map(([key, pokemon]) => [key, Array.isArray(pokemon) ? pokemon.length : 0]),
  );
}

function eggStats(_data, report, buckets) {
  return bucketStats(report, buckets);
}

async function regenerateCurrentEggs() {
  return generateCurrentData({
    source: "eggs",
    scriptName: "generateCurrentEggs.js",
    exportName: "generateCurrentEggs",
    jsonPath: eggsJsonPath,
    summarize: eggSummary,
    stats: eggStats,
  });
}

async function readMongoCurrentEggs() {
  if (mongoose.connection.readyState !== 1) return null;
  const document = await Egg.findOne({ key: "current" }).lean();
  return document?.data || null;
}

async function upsertCurrentEggs(data) {
  if (!data?.currentEggsList || typeof data.currentEggsList !== "object") {
    throw new ApiError(400, "Payload oeufs invalide: currentEggsList requis.", "INVALID_EGGS_PAYLOAD");
  }

  const sourceHash = hash(data);
  const document = await Egg.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        key: "current",
        data,
        sourceFile: eggsJsonPath,
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
    const fromMongo = source === "mongo" ? await readMongoCurrentEggs() : null;
    const data = fromMongo || readCurrentEggsFile();
    response.json({
      data,
      meta: {
        source: fromMongo ? "mongo" : "file",
        buckets: eggSummary(data),
      },
    });
  }),
);

router.post(
  "/import",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const payload = request.body?.currentEggsList ? request.body : request.body?.data;
    // Un import sans payload synchronise le JSON du depot, jamais un ancien snapshot Mongo.
    const data = payload?.currentEggsList ? payload : readCurrentEggsFile();
    const document = await upsertCurrentEggs(data);
    const buckets = eggSummary(document.data);
    const itemsParsed = Object.values(buckets).reduce((sum, count) => sum + Number(count || 0), 0);
    const report = buildPipelineReport({
      source: "eggs",
      summary: buckets,
      stats: { itemsParsed, itemsMatched: itemsParsed },
      jsonPath: eggsJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        imported: true,
        importedFrom: payload?.currentEggsList ? "request" : eggsJsonPath,
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
    const generated = await regenerateCurrentEggs();
    const document = await upsertCurrentEggs(generated.data);
    const report = buildPipelineReport({
      source: "eggs",
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
      jsonPath: eggsJsonPath,
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
