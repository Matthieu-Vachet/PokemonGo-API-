const { requireAuth } = require("../apps/checklist/server/auth");
const { auditUrls } = require("../apps/checklist/server/workshop");

module.exports = async function handler(request, response) {
  if (!requireAuth(request, response)) return;
  try {
    response.setHeader("Cache-Control", "private, no-store");
    response.status(200).json({ data: await auditUrls(request.query.key) });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
};
