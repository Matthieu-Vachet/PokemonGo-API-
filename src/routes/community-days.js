const express = require("express");
const { getCommunityDay, listCommunityDays } = require("../services/reference-collections-service");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    const result = await listCommunityDays(request.query);
    response.json({ success: true, data: result.documents, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    response.json({ success: true, data: await getCommunityDay(request.params.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
