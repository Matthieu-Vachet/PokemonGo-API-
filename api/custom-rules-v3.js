const { requireAuth } = require("../apps/checklist/server/auth");
const {
  customRules,
  deleteCustomRule,
  previewCustomRule,
  saveCustomRule,
  toggleCustomRule,
} = require("../apps/checklist/server/workshop");

module.exports = function handler(request, response) {
  if (!requireAuth(request, response)) return;

  const pathname = String(request.url || "").split("?")[0];
  const action = pathname.replace(/\/+$/, "").split("/").pop();

  try {
    response.setHeader("Cache-Control", "private, no-store");

    if (request.method === "GET" && action === "custom-rules-v3")
      return response.status(200).json({ data: customRules() });
    if (request.method === "POST" && action === "preview")
      return response.status(200).json({ data: previewCustomRule(request.body || {}) });
    if (request.method === "POST" && action === "toggle")
      return response.status(200).json({ data: toggleCustomRule(request.body || {}) });
    if (request.method === "POST" && action === "delete")
      return response.status(200).json({ data: deleteCustomRule(request.body || {}) });
    if (request.method === "POST" && action === "custom-rules-v3")
      return response.status(200).json({ data: saveCustomRule(request.body || {}) });

    return response.status(405).json({ error: "Méthode non autorisée." });
  } catch (error) {
    if (["EROFS", "EPERM", "EACCES"].includes(error.code))
      return response.status(409).json({
        error:
          "Cette version de la checklist stocke maintenant les règles perso dans le navigateur. Recharge la page puis réessaie.",
      });
    return response.status(error.status || 500).json({ error: error.message });
  }
};
