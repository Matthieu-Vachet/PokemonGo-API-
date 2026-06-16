const { requireAuth } = require("../../apps/checklist/server/auth");
const { customRules } = require("../../apps/checklist/server/workshop");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;
  if (request.method !== "GET")
    return response.status(405).json({ error: "Méthode non autorisée." });

  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: customRules() });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};
