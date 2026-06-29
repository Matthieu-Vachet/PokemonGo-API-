const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const { Rocket } = require("../models");
const { requireAdminSecret } = require("../lib/admin-auth");
const { ApiError } = require("../lib/api-error");
const { dataPath } = require("../lib/data-repository");
const { hash } = require("../sync/source-reader");
const { asyncHandler } = require("../lib/async-handler");

const router = express.Router();
const rocketFile = dataPath("rocket", "currentRocket.json");

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
        sourceFile: "data/rocket/currentRocket.json",
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
    const data = payload?.currentRocketList ? payload : readCurrentRocketFile();
    const document = await upsertCurrentRocket(data);
    response.json({
      data: {
        imported: true,
        key: document.key,
        summary: rocketSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

router.post(
  "/regenerate",
  asyncHandler(async (request, response) => {
    requireAdminSecret(request);
    const data = readCurrentRocketFile();
    const document = await upsertCurrentRocket(data);
    response.json({
      data: {
        regenerated: true,
        source: "data/rocket/currentRocket.json",
        key: document.key,
        summary: rocketSummary(document.data),
        updatedAt: document.updatedAt,
      },
    });
  }),
);

module.exports = router;
