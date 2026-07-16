const express = require("express");
const { requireAdminSecret } = require("../lib/admin-auth");
const {
  clearDynamaxImageCache,
  createDynamaxZip,
  dynamaxImagePath,
  readState,
  scanDynamaxImages,
} = require("../services/dynamax-images-service");

const router = express.Router();

router.use((request, _response, next) => {
  requireAdminSecret(request);
  next();
});

router.get("/", async (request, response, next) => {
  try {
    if (request.query.file) {
      const result = await dynamaxImagePath(String(request.query.file));
      response.setHeader("Cache-Control", "private, max-age=300");
      return response.sendFile(result.filePath);
    }
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ success: true, data: await readState() });
  } catch (error) {
    return next(error);
  }
});

router.post("/scan", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ success: true, data: await scanDynamaxImages() });
  } catch (error) {
    return next(error);
  }
});

router.get("/export.zip", async (_request, response, next) => {
  try {
    return await createDynamaxZip(response);
  } catch (error) {
    return next(error);
  }
});

router.delete("/cache", async (_request, response, next) => {
  try {
    response.setHeader("Cache-Control", "private, no-store");
    return response.json({ success: true, data: await clearDynamaxImageCache() });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
