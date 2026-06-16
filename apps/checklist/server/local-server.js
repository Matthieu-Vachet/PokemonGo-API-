const express = require("express");
const os = require("os");
const path = require("path");
const { buildChecklist, detailForKey } = require("./engine");
const { sourceWatch } = require("./source-watch");
const workshop = require("./workshop");

const app = express();
const port = Number(process.env.CHECKLIST_PORT || process.env.CHECKLIST_V3_PORT || 3003);
const host = process.env.CHECKLIST_HOST || process.env.CHECKLIST_V3_HOST || "0.0.0.0";

app.use(express.json({ limit: "5mb" }));
app.use("/asset", express.static(path.resolve(__dirname, "../../../asset")));
app.use(express.static(path.resolve(__dirname, "..")));

app.get("/api/checklist-v3", (_request, response) => {
  try {
    response.json({
      entries: buildChecklist(),
      customRules: workshop.customRules(),
    });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/checklist-v3", (request, response) => {
  try {
    const customRules = Array.isArray(request.body?.customRules)
      ? request.body.customRules
      : [];
    response.json({
      entries: buildChecklist(customRules),
      customRules,
    });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message });
  }
});

app.get("/api/detail-v3", (request, response) => {
  try {
    const data = detailForKey(String(request.query.key || ""));
    if (!data) return response.status(404).json({ error: "Fiche introuvable." });
    return response.json({ data });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
});

function route(handler) {
  return async (request, response) => {
    try {
      response.json({ data: await handler(request) });
    } catch (error) {
      response
        .status(error.status || 500)
        .json({ error: error.message, issues: error.issues || [] });
    }
  };
}

app.post("/api/validate-v3", route((request) =>
  workshop.validate(
    request.body.data,
    request.body.file || "",
    request.body.kind || "",
  ),
));
app.get("/api/assets-v3", route((request) => workshop.assetAudit(request.query.dexId)));
app.get("/api/url-audit-v3", route((request) => workshop.auditUrls(request.query.key)));
app.get("/api/catalog-v3", route(() => workshop.catalog()));
app.get("/api/custom-rules-v3", route(() => workshop.customRules()));
app.post("/api/custom-rules-v3/preview", route((request) =>
  workshop.previewCustomRule(request.body),
));
app.post("/api/custom-rules-v3", route((request) =>
  workshop.saveCustomRule(request.body),
));
app.post("/api/custom-rules-v3/toggle", route((request) =>
  workshop.toggleCustomRule(request.body),
));
app.post("/api/custom-rules-v3/delete", route((request) =>
  workshop.deleteCustomRule(request.body),
));
app.get("/api/notes-v3", route(() => workshop.notes()));
app.post("/api/notes-v3", route((request) => workshop.saveNote(request.body)));
app.get("/api/image-reviews-v3", route(() => workshop.imageReviews()));
app.post("/api/image-reviews-v3", route((request) => workshop.saveImageReview(request.body)));
app.get("/api/source-watch-v3", route(() => sourceWatch()));
app.get("/api/git-history-v3", route((request) => workshop.gitHistory(request.query.file)));
app.post("/api/open-file-v3", route((request) => workshop.openFile(request.body.file)));

app.listen(port, host, () => {
  console.log(`Checklist Pokemon disponible sur http://localhost:${port}`);
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) {
        console.log(`Acces mobile: http://${address.address}:${port}`);
      }
    }
  }
});
