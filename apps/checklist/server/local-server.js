const express = require("express");
const os = require("os");
const path = require("path");
const { buildChecklist, detailForKey } = require("./engine");

const app = express();
const port = Number(process.env.CHECKLIST_PORT || process.env.CHECKLIST_V3_PORT || 3003);
const host = process.env.CHECKLIST_HOST || process.env.CHECKLIST_V3_HOST || "0.0.0.0";

app.use(express.static(path.resolve(__dirname, "..")));

app.get("/api/checklist-v3", (_request, response) => {
  try {
    response.json({ entries: buildChecklist() });
  } catch (error) {
    response.status(500).json({ error: error.message });
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
