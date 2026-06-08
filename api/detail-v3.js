const { detailForKey } = require("../apps/checklist/server/engine");
const { requireAuth } = require("../apps/checklist/server/auth");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;

  try {
    const data = detailForKey(String(request.query.key || ""));
    if (!data) return response.status(404).json({ error: "Fiche introuvable." });
    response.setHeader("Cache-Control", "private, no-store");
    return response.status(200).json({ data });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
};
