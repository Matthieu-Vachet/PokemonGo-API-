const express = require("express");
const { Item } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse, sortFromQuery } = require("../lib/http");

const router = express.Router();

function publicItem(document) {
  return document.data || {
    id: document.id,
    templateId: document.templateId,
    itemId: document.itemId,
    category: document.category,
    itemType: document.itemType,
    names: document.names || {},
    description: document.description || {},
    asset: document.asset ?? null,
    assetKey: document.assetKey || null,
  };
}

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, limit, skip } = pagination(request.query);
    const filter = {};
    if (request.query.category) filter.category = String(request.query.category);
    if (request.query.itemType) filter.itemType = String(request.query.itemType);
    if (request.query.assetKey) filter.assetKey = String(request.query.assetKey);
    if (request.query.q) filter.searchTerms = { $regex: request.query.q, $options: "i" };

    const sort = sortFromQuery(request.query.sort, ["id", "category", "itemType", "assetKey"], { id: 1 });
    const [items, total] = await Promise.all([
      Item.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Item.countDocuments(filter),
    ]);

    response.json(paginatedResponse(items.map(publicItem), total, page, limit));
  }),
);

router.get(
  "/:identifier",
  asyncHandler(async (request, response) => {
    const identifier = String(request.params.identifier);
    const item = await Item.findOne({
      $or: [{ id: identifier }, { itemId: identifier }, { templateId: identifier }, { assetKey: identifier }],
    }).lean();
    if (!item) throw new ApiError(404, `Item introuvable : ${identifier}`, "ITEM_NOT_FOUND");
    response.json({ data: publicItem(item) });
  }),
);

module.exports = router;
