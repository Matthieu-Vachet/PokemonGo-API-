const { requireAuth } = require("../../apps/checklist/server/auth");
const { previewCustomRule } = require("../../apps/checklist/server/workshop");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;
  if (request.method !== "POST")
    return response.status(405).json({ error: "Méthode non autorisée." });

  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: previewCustomRule(request.body || {}) });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message });
  }
};
