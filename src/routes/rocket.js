const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Rocket } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");
const { buildPipelineReport, generateCurrentData } = require("../lib/current-data-pipeline");

const router = express.Router();
const rocketFile = dataPath("rocket", "currentRocket.json");
const rocketJsonPath = "data/rocket/currentRocket.json";

function readCurrentRocketFile() {
  if (!fs.existsSync(rocketFile)) {
    throw new ApiError(404, "Fichier rocket/currentRocket.json introuvable.", "ROCKET_NOT_FOUND");
  }
  return JSON.parse(fs.readFileSync(rocketFile, "utf8"));
}

function countPokemon(profile) {
  return Object.values(profile?.slots || {}).reduce((sum, slot) => sum + (Array.isArray(slot) ? slot.length : 0), 0);
}

function rocketSummary(data) {
  const currentRocketList = data?.currentRocketList || {};
  const leaders = currentRocketList.leaders || {};
  const leaderProfiles = Object.values(leaders).flatMap((items) => (Array.isArray(items) ? items : []));
  const giovanni = Array.isArray(currentRocketList.giovanni) ? currentRocketList.giovanni : [];
  const grunts = Array.isArray(currentRocketList.grunts) ? currentRocketList.grunts : [];
  const profiles = [...giovanni, ...leaderProfiles, ...grunts];
  return {
    giovanni: giovanni.length,
    leaders: leaderProfiles.length,
    grunts: grunts.length,
    trainers: profiles.length,
    pokemonEntries: profiles.reduce((sum, profile) => sum + countPokemon(profile), 0),
  };
}

function rocketStats(_data, report, summary) {
  const itemsParsed = Number(report.trainers || summary.trainers || 0);
  const itemsUnmatched = Array.isArray(report.unmatched) ? report.unmatched.length : 0;
  return {
    itemsParsed,
    itemsMatched: Number(report.matched || summary.pokemonEntries || 0),
    itemsUnmatched,
  };
}

async function regenerateCurrentRocket() {
  return generateCurrentData({
    source: "rocket",
    scriptName: "generateCurrentRocket.js",
    exportName: "generateCurrentRocket",
    jsonPath: rocketJsonPath,
    summarize: rocketSummary,
    stats: rocketStats,
  });
}

async function readMongoCurrentRocket() {
  if (mongoose.connection.readyState !== 1) return null;
  const document = await Rocket.findOne({ key: "current" }).lean();
  return document?.data || null;
}

async function upsertCurrentRocket(data) {
  if (!data?.currentRocketList || typeof data.currentRocketList !== "object") {
    throw new ApiError(400, "Payload Rocket invalide: currentRocketList requis.", "INVALID_ROCKET_PAYLOAD");
  }

  const sourceHash = hash(data);
  const document = await Rocket.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        key: "current",
        data,
        sourceFile: rocketJsonPath,
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
    const fromMongo = source === "mongo" ? await readMongoCurrentRocket() : null;
    const data = fromMongo || readCurrentRocketFile();
    response.json({
      data,
      meta: {
        source: fromMongo ? "mongo" : "file",
        summary: rocketSummary(data),
      },
    });
  }),
);

router.post(
  "/import",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const payload = request.body?.currentRocketList ? request.body : request.body?.data;
    const data = payload?.currentRocketList ? payload : (await readMongoCurrentRocket()) || readCurrentRocketFile();
    const document = await upsertCurrentRocket(data);
    const summary = rocketSummary(document.data);
    const report = buildPipelineReport({
      source: "rocket",
      summary,
      stats: { itemsParsed: summary.trainers, itemsMatched: summary.pokemonEntries },
      jsonPath: rocketJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        imported: true,
        key: document.key,
        summary,
        ...report,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const generated = await regenerateCurrentRocket();
    const document = await upsertCurrentRocket(generated.data);
    const report = buildPipelineReport({
      source: "rocket",
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
      jsonPath: rocketJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        regenerated: true,
        key: document.key,
        summary: generated.summary,
        ...report,
      },
    });
  }),
);

module.exports = router;
