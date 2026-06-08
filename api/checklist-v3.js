const { buildChecklist } = require("../apps/checklist/server/engine");
const { requireAuth } = require("../apps/checklist/server/auth");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;

  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ entries: buildChecklist() });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};
