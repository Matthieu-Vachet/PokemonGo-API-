const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Egg } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");

const router = express.Router();
const eggsFile = dataPath("eggs", "currentEggs.json");

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
        sourceFile: "data/eggs/currentEggs.json",
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
    const data = payload?.currentEggsList ? payload : readCurrentEggsFile();
    const document = await upsertCurrentEggs(data);
    response.json({
      data: {
        imported: true,
        key: document.key,
        buckets: eggSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const data = readCurrentEggsFile();
    const document = await upsertCurrentEggs(data);
    response.json({
      data: {
        regenerated: true,
        source: "data/eggs/currentEggs.json",
        key: document.key,
        buckets: eggSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

module.exports = router;
