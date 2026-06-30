const express = require("express");
const { RocketText } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse, sortFromQuery } = require("../lib/http");

const router = express.Router();

function publicRocketText(document) {
  return document.data || {
    id: document.id,
    textKey: document.textKey,
    trainerType: document.trainerType,
    gender: document.gender,
    type: document.type,
    character: document.character,
    texts: document.texts || {},
    textVariants: document.textVariants || {},
  };
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = {};
    if (request.query.trainerType) filter.trainerType = String(request.query.trainerType);
    if (request.query.gender) filter.gender = String(request.query.gender);
    if (request.query.type) filter.type = String(request.query.type).toUpperCase();
    if (request.query.character) filter.character = String(request.query.character);
    if (request.query.textKey) filter.textKey = String(request.query.textKey);
    if (request.query.q) filter.searchTerms = { $regex: request.query.q, $options: "i" };

    const sort = sortFromQuery(
      request.query.sort,
      ["id", "textKey", "trainerType", "gender", "type", "character"],
      { trainerType: 1, character: 1, type: 1, id: 1 },
    );
    const [texts, total] = await Promise.all([
      RocketText.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      RocketText.countDocuments(filter),
    ]);

    response.json(paginatedResponse(texts.map(publicRocketText), total, page, limit));
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    const identifier = String(request.params.identifier);
    const text = await RocketText.findOne({
      $or: [{ id: identifier }, { textKey: identifier }],
    }).lean();
    if (!text) throw new ApiError(404, `Texte Rocket introuvable : ${identifier}`, "ROCKET_TEXT_NOT_FOUND");
    response.json({ data: publicRocketText(text) });
  }),
);

module.exports = router;
