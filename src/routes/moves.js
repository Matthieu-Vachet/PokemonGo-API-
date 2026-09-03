const express = require("express");
const { Move, Pokemon } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse, sortFromQuery } = require("../lib/http");
const { effectForMove } = require("../services/adventure-effect-service");

const router = express.Router();

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = {};
    if (request.query.kind) filter.kind = request.query.kind;
    if (request.query.elite !== undefined) filter.elite = request.query.elite === "true";
    if (request.query.type) filter.type = String(request.query.type).toUpperCase();
    if (request.query.q)
      filter.searchTerms = { $regex: request.query.q, $options: "i" };
    const sort = sortFromQuery(
      request.query.sort,
      ["id", "slug", "power", "energy", "durationMs", "combat.power", "combat.energy"],
      { kind: 1, id: 1 },
    );
    const [items, total] = await Promise.all([
      Move.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Move.countDocuments(filter),
    ]);
    response.json(paginatedResponse(items, total, page, limit));
  }),
);

router.get(
  "/:identifier/adventure-effect",
  asyncHandler(async (request, response) => {
    response.json({ data: effectForMove(request.params.identifier, request.query) });
  }),
);

router.get(
  "/:identifier/pokemon",
  asyncHandler(async (request, response) => {
    const id = String(request.params.identifier).toUpperCase();
    const data = await Pokemon.find({
      $or: [{ moveIds: id }, { eliteMoveIds: id }, { legacyMoveIds: id }, { maxMoveIds: id }],
    })
      .sort({ dexNr: 1, form: 1 })
      .lean();
    response.json({ data, meta: { total: data.length } });
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    const value = request.params.identifier;
    const slug = value.toLowerCase();
    const move = await Move.findOne({
      $or: [{ id: value.toUpperCase() }, { slug }, { legacySlugs: slug }],
    }).lean();
    if (!move) throw new ApiError(404, `Attaque introuvable : ${value}`, "MOVE_NOT_FOUND");
    response.json({ data: move });
  }),
);

module.exports = router;
