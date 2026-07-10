const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Research } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");
const { buildPipelineReport, generateCurrentData } = require("../lib/current-data-pipeline");

const router = express.Router();
const researchFile = dataPath("research", "currentResearch.json");
const researchJsonPath = "data/research/currentResearch.json";

function readCurrentResearchFile() {
  if (!fs.existsSync(researchFile)) {
    throw new ApiError(404, "Fichier research/currentResearch.json introuvable.", "RESEARCH_NOT_FOUND");
  }
  return JSON.parse(fs.readFileSync(researchFile, "utf8"));
}

function researchSummary(data) {
  const currentResearchList = data?.currentResearchList || {};
  const buckets = Object.fromEntries(
    Object.entries(currentResearchList).map(([key, tasks]) => [key, Array.isArray(tasks) ? tasks.length : 0]),
  );
  const tasks = Object.values(currentResearchList).flatMap((items) => (Array.isArray(items) ? items : []));
  const rewards = tasks.flatMap((task) => (Array.isArray(task.rewards) ? task.rewards : []));
  return {
    buckets,
    tasks: tasks.length,
    pokemonRewards: rewards.filter((reward) => reward.rewardType === "pokemon").length,
    itemRewards: rewards.filter((reward) => reward.rewardType === "item").length,
  };
}

function assertGeneratedResearch(_data, report = {}, summary = {}) {
  if (!summary.tasks) {
    throw new ApiError(502, "No Research tasks parsed from LeekDuck", "RESEARCH_REGENERATE_EMPTY");
  }
  if ((report.eventCategoryBlocksFound || 0) > 0 && !summary.buckets.eventResearch) {
    throw new ApiError(502, "No event tasks parsed from LeekDuck", "RESEARCH_REGENERATE_NO_EVENT_TASKS");
  }
}

function researchStats(_data, report, summary) {
  const unmatchedPokemon = Array.isArray(report.unmatchedPokemonRewards) ? report.unmatchedPokemonRewards.length : 0;
  const unmatchedItems = Array.isArray(report.unmatchedItemRewards) ? report.unmatchedItemRewards.length : 0;
  return {
    itemsParsed: summary.tasks,
    itemsMatched: Number(report.pokemonRewardsMatched || 0) + Number(report.itemRewardsMatched || 0),
    itemsUnmatched: unmatchedPokemon + unmatchedItems,
  };
}

async function regenerateCurrentResearchFromLeekDuck() {
  return generateCurrentData({
    source: "research",
    scriptName: "generateCurrentResearch.js",
    exportName: "generateCurrentResearch",
    jsonPath: researchJsonPath,
    summarize: researchSummary,
    stats: researchStats,
    validate: assertGeneratedResearch,
  });
}

async function readMongoCurrentResearch() {
  if (mongoose.connection.readyState !== 1) return null;
  const document = await Research.findOne({ key: "current" }).lean();
  return document?.data || null;
}

async function upsertCurrentResearch(data) {
  if (!data?.currentResearchList || typeof data.currentResearchList !== "object") {
    throw new ApiError(400, "Payload Research invalide: currentResearchList requis.", "INVALID_RESEARCH_PAYLOAD");
  }

  const sourceHash = hash(data);
  const document = await Research.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        key: "current",
        data,
        sourceFile: researchJsonPath,
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
    const fromMongo = source === "mongo" ? await readMongoCurrentResearch() : null;
    const data = fromMongo || readCurrentResearchFile();
    response.json({
      data,
      meta: {
        source: fromMongo ? "mongo" : "file",
        summary: researchSummary(data),
      },
    });
  }),
);

router.post(
  "/import",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const payload = request.body?.currentResearchList ? request.body : request.body?.data;
    // Un clic d'import sans JSON explicite part du fichier genere, pas d'un cache Mongo.
    const data = payload?.currentResearchList ? payload : readCurrentResearchFile();
    const document = await upsertCurrentResearch(data);
    const summary = researchSummary(document.data);
    const report = buildPipelineReport({
      source: "research",
      summary,
      stats: { itemsParsed: summary.tasks, itemsMatched: summary.pokemonRewards + summary.itemRewards },
      jsonPath: researchJsonPath,
      mongoUpdated: true,
      updatedAt: document.updatedAt,
    });
    response.json({
      data: {
        imported: true,
        importedFrom: payload?.currentResearchList ? "request" : researchJsonPath,
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
    const generated = await regenerateCurrentResearchFromLeekDuck();
    const data = generated.data;
    const document = await upsertCurrentResearch(data);
    const report = buildPipelineReport({
      source: "research",
      report: generated.report,
      summary: generated.summary,
      stats: generated.stats,
      jsonPath: researchJsonPath,
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
