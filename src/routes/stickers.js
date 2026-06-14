const express = require("express");
const fs = require("fs");
const path = require("path");
const { ApiError } = require("../lib/api-error");
const { pagination, paginatedResponse } = require("../lib/http");

const router = express.Router();
const catalogFile = path.resolve(process.cwd(), "data", "stickers", "stickers.json");

function stickers() {
  return JSON.parse(fs.readFileSync(catalogFile, "utf8"));
}

router.get("/", (request, response) => {
  const { page, limit, skip } = pagination(request.query);
  const query = String(request.query.q || "").trim().toLowerCase();
  const category = String(request.query.category || "").trim().toLowerCase();
  const filtered = stickers().filter(
    (sticker) =>
      (!query ||
        [sticker.id, sticker.filename, sticker.category].some((value) =>
          String(value).toLowerCase().includes(query),
        )) &&
      (!category || sticker.category === category),
  );
  response.json(
    paginatedResponse(filtered.slice(skip, skip + limit), filtered.length, page, limit, {
      categories: [...new Set(stickers().map((sticker) => sticker.category))].sort(),
    }),
  );
});

router.get("/:id", (request, response) => {
  const sticker = stickers().find((item) => item.id === String(request.params.id).toLowerCase());
  if (!sticker)
    throw new ApiError(404, `Sticker introuvable : ${request.params.id}`, "STICKER_NOT_FOUND");
  response.json({ data: sticker });
});

module.exports = router;
