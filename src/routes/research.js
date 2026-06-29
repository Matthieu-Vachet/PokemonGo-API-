const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Research } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");

const router = express.Router();
const researchFile = dataPath("research", "currentResearch.json");

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
        sourceFile: "data/research/currentResearch.json",
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
    const data = payload?.currentResearchList ? payload : readCurrentResearchFile();
    const document = await upsertCurrentResearch(data);
    response.json({
      data: {
        imported: true,
        key: document.key,
        summary: researchSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const data = readCurrentResearchFile();
    const document = await upsertCurrentResearch(data);
    response.json({
      data: {
        regenerated: true,
        source: "data/research/currentResearch.json",
        key: document.key,
        summary: researchSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

module.exports = router;
