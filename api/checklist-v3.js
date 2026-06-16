const { buildChecklist } = require("../apps/checklist/server/engine");
const { requireAuth } = require("../apps/checklist/server/auth");
const { customRules: storedCustomRules } = require("../apps/checklist/server/workshop");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;

  try {
    response.setHeader("Cache-Control", "private, no-store");
    if (request.method === "GET")
      return response.status(200).json({
        entries: buildChecklist(),
        customRules: storedCustomRules(),
      });
    if (request.method === "POST") {
      const customRules = Array.isArray(request.body?.customRules)
        ? request.body.customRules
        : [];
      return response.status(200).json({
        entries: buildChecklist(customRules),
        customRules,
      });
    }
    return response.status(405).json({ error: "Méthode non autorisée." });
  } catch (error) {
    response.status(error.status || 500).json({ error: error.message });
  }
};
