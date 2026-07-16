const express = require("express");
const { getEventHistory, listEventHistory } = require("../services/reference-collections-service");

const router = express.Router();

router.get("/", async (request, response, next) => {
  try {
    const result = await listEventHistory(request.query);
    response.json({ success: true, data: result.documents, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/revisions", async (request, response, next) => {
  try {
    const event = await getEventHistory(request.params.id, { includeRevisions: true });
    response.json({ success: true, data: event.revisionHistory || [], meta: { id: event.id, revision: event.revision } });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    response.json({ success: true, data: await getEventHistory(request.params.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
