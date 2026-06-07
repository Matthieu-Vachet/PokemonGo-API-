const express = require("express");
const { Generation, Pokemon, Region, Type } = require("../models");
const { asyncHandler } = require("../lib/async-handler");
const { ApiError } = require("../lib/api-error");

function catalogRouter(Model, field, pokemonField, normalize = (value) => value) {
  const router = express.Router();
  router.get(
    "/",
    asyncHandler(async (_request, response) => {
      response.json({ data: await Model.find().sort({ generation: 1, id: 1 }).lean() });
    }),
  );
  router.get(
    "/:identifier/pokemon",
    asyncHandler(async (request, response) => {
      const identifier = normalize(request.params.identifier);
      const data = await Pokemon.find({ [pokemonField]: identifier })
        .sort({ dexNr: 1, form: 1 })
        .lean();
      response.json({ data, meta: { total: data.length } });
    }),
  );
  router.get(
    "/:identifier",
    asyncHandler(async (request, response) => {
      const identifier = normalize(request.params.identifier);
      const value = field === "generation" ? Number(identifier) : identifier;
      const data = await Model.findOne({
        $or: [{ [field]: value }, { id: identifier }, { slug: String(identifier).toLowerCase() }],
      }).lean();
      if (!data) throw new ApiError(404, "Ressource introuvable.", "CATALOG_NOT_FOUND");
      response.json({ data });
    }),
  );
  return router;
}

module.exports = {
  generations: catalogRouter(Generation, "generation", "generation", Number),
  regions: catalogRouter(Region, "id", "regionId", (value) => String(value).toUpperCase()),
  types: catalogRouter(Type, "id", "types", (value) => String(value).toUpperCase()),
};
