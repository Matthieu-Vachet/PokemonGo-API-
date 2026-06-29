const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Raid } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");

const router = express.Router();
const raidsFile = dataPath("raids", "currentRaids.json");

function readCurrentRaidsFile() {
  if (!fs.existsSync(raidsFile)) {
    throw new ApiError(404, "Fichier raids/currentRaids.json introuvable.", "RAIDS_NOT_FOUND");
  }
  return JSON.parse(fs.readFileSync(raidsFile, "utf8"));
}

function raidSummary(data) {
  const currentList = data?.currentList || {};
  return Object.fromEntries(
    Object.entries(currentList).map(([key, bosses]) => [key, Array.isArray(bosses) ? bosses.length : 0]),
  );
}

async function readMongoCurrentRaids() {
  if (mongoose.connection.readyState !== 1) return null;
  const document = await Raid.findOne({ key: "current" }).lean();
  return document?.data || null;
}

async function upsertCurrentRaids(data) {
  if (!data?.currentList || typeof data.currentList !== "object") {
    throw new ApiError(400, "Payload raids invalide: currentList requis.", "INVALID_RAIDS_PAYLOAD");
  }

  const sourceHash = hash(data);
  const document = await Raid.findOneAndUpdate(
    { key: "current" },
    {
      $set: {
        key: "current",
        data,
        sourceFile: "data/raids/currentRaids.json",
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
    const fromMongo = source === "mongo" ? await readMongoCurrentRaids() : null;
    const data = fromMongo || readCurrentRaidsFile();
    response.json({
      data,
      meta: {
        source: fromMongo ? "mongo" : "file",
        buckets: raidSummary(data),
      },
    });
  }),
);

router.post(
  "/import",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const payload = request.body?.currentList ? request.body : request.body?.data;
    const data = payload?.currentList ? payload : readCurrentRaidsFile();
    const document = await upsertCurrentRaids(data);
    response.json({
      data: {
        imported: true,
        key: document.key,
        buckets: raidSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const data = readCurrentRaidsFile();
    const document = await upsertCurrentRaids(data);
    response.json({
      data: {
        regenerated: true,
        source: "data/raids/currentRaids.json",
        key: document.key,
        buckets: raidSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

module.exports = router;
