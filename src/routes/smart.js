const express = require("express");
const { Pokemon, Type } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { integer } = require("../lib/http");
const { findPokemon } = require("../services/pokemon-service");

const router = express.Router();

router.get(
  "/availability/:flag",
  asyncHandler(async (request, response) => {
    const allowed = [
      "released",
      "shinyReleased",
      "shadowShinyReleased",
      "tradable",
      "pokemonHomeTransfer",
      "shadow",
      "apex",
      "dynamax",
      "gigantamax",
      "mega",
    ];
    if (!allowed.includes(request.params.flag))
      throw new ApiError(400, "Disponibilité inconnue.", "INVALID_AVAILABILITY");
    const data = await Pokemon.find({ [`flags.${request.params.flag}`]: true })
      .sort({ dexNr: 1, form: 1 })
      .lean();
    response.json({ data, meta: { flag: request.params.flag, total: data.length } });
  }),
);

router.get(
  "/assets/:identifier",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    response.json({
      data: {
        pokemon: pokemon.key,
        normal: pokemon.data?.assets?.image || null,
        shiny: pokemon.data?.assets?.shinyImage || null,
        variants: pokemon.data?.assetForms || [],
        home: pokemon.data?.assets?.home || null,
        backgrounds: pokemon.data?.assets?.locationCards || [],
        shuffle: pokemon.data?.assets?.shuffle || null,
      },
    });
  }),
);

router.get(
  "/pokemon/:identifier/shuffle",
  asyncHandler(async (request, response) => {
    const pokemon = await findPokemon(request.params.identifier, request.query);
    const variants = pokemon.data?.assets?.shuffle?.variants || [];
    response.json({
      data: variants,
      meta: { pokemon: pokemon.key, total: variants.length },
    });
  }),
);

router.get(
  "/collection/checklist",
  asyncHandler(async (request, response) => {
    const filter = { "flags.released": true };
    if (request.query.shiny === "true") filter["flags.shinyReleased"] = true;
    if (request.query.shadowShiny === "true")
      filter["flags.shadowShinyReleased"] = true;
    if (request.query.shadow === "true") filter["flags.shadow"] = true;
    if (request.query.tradable === "true") filter["flags.tradable"] = true;
    const data = await Pokemon.find(filter)
      .select("key id formId slug dexNr dexId form names flags data.assets")
      .sort({ dexNr: 1, form: 1 })
      .lean();
    response.json({ data, meta: { total: data.length, filters: filter } });
  }),
);

router.get(
  "/evolutions/special",
  asyncHandler(async (request, response) => {
    const conditions = [];
    if (!request.query.kind || request.query.kind === "item")
      conditions.push({ "data.evolutions.item": { $ne: null } });
    if (!request.query.kind || request.query.kind === "buddy")
      conditions.push({ "data.evolutions.quests.0": { $exists: true } });
    const data = await Pokemon.find({ $or: conditions })
      .select("key id formId slug dexNr form names data.evolutions")
      .sort({ dexNr: 1 })
      .lean();
    response.json({ data, meta: { total: data.length } });
  }),
);

router.get(
  "/raid/counters/:defenderType",
  asyncHandler(async (request, response) => {
    const defenderType = String(request.params.defenderType).toUpperCase();
    const type = await Type.findOne({ id: defenderType }).lean();
    if (!type) throw new ApiError(404, "Type introuvable.", "TYPE_NOT_FOUND");
    const effectiveTypes = (type.data?.doubleDamageFrom || []).map((value) =>
      String(value).toUpperCase(),
    );
    const limit = integer(request.query.limit, 25, { min: 1, max: 100 });
    const data = await Pokemon.find({
      types: { $in: effectiveTypes },
      "flags.released": { $ne: false },
      "stats.attack": { $ne: null },
    })
      .sort({ "stats.attack": -1, "maxCp.maxLevel50": -1 })
      .limit(limit)
      .lean();
    response.json({
      data,
      meta: { defenderType, effectiveTypes, limit, strategy: "type-and-attack" },
    });
  }),
);

module.exports = router;
