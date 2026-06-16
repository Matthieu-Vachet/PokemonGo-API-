const { requireAuth } = require("../apps/checklist/server/auth");
const { sourceWatch } = require("../apps/checklist/server/source-watch");

module.exports = async function handler(request, response) {
  if (!requireAuth(request, response)) return;
  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: await sourceWatch() });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};
