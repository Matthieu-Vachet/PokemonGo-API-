const { buildChecklist, detailForKey } = require("../apps/checklist/server/engine");
const { sourceWatch } = require("../apps/checklist/server/source-watch");
const workshop = require("../apps/checklist/server/workshop");
const {
  clearSession,
  isAdminRequest,
  isValidAdminPassword,
  requireAdmin,
  setSession,
} = require("../src/lib/checklist-auth");
const { summarizeChecklist } = require("../src/lib/site-dashboard");

function actionFrom(request) {
  return String(
    request.query?.action ||
      request.body?.action ||
      "bootstrap",
  ).trim();
}

function payloadRules(request) {
  if (!isAdminRequest(request)) return null;
  return Array.isArray(request.body?.customRules) ? request.body.customRules : null;
}

function send(response, data) {
  response.setHeader("Cache-Control", "private, no-store");
  return response.status(200).json({ data });
}

function bootstrapResponse(request) {
  const customRules = payloadRules(request);
  const entries = buildChecklist(customRules);
  const dataCatalog = workshop.catalog();
  return {
    viewer: {
      admin: isAdminRequest(request),
    },
    entries,
    summary: summarizeChecklist(entries),
    catalog: {
      types: dataCatalog.types.length,
      weather: dataCatalog.weather.length,
      stickers: dataCatalog.stickers.length,
      moves: dataCatalog.moves.length,
    },
    customRules: customRules || [],
  };
}

function publicDetail(detail) {
  if (!detail || typeof detail !== "object") return detail;
  const { sourceData, ...safeDetail } = detail;
  return safeDetail;
}

function publicAssetAudit(audit) {
  return {
    totals: audit.totals,
    goAssets: audit.goAssets,
    shuffleAssets: audit.shuffleAssets,
  };
}

async function handleGet(request, response, action) {
  if (action === "bootstrap")
    return send(response, bootstrapResponse(request));
  if (action === "detail") {
    const data = detailForKey(String(request.query?.key || ""));
    if (!data) return response.status(404).json({ error: "Fiche introuvable." });
    const admin = isAdminRequest(request);
    return send(response, {
      viewer: { admin },
      detail: admin ? data : publicDetail(data),
    });
  }
  if (action === "catalog")
    return send(response, workshop.catalog());
  if (action === "assets") {
    const audit = await workshop.assetAudit(request.query?.dexId || "");
    return send(response, isAdminRequest(request) ? audit : publicAssetAudit(audit));
  }
  if (action === "session")
    return send(response, { authenticated: isAdminRequest(request) });
  if (action === "source-watch") {
    if (!requireAdmin(request, response)) return null;
    return send(response, await sourceWatch());
  }
  if (action === "history") {
    if (!requireAdmin(request, response)) return null;
    return send(response, workshop.repoHistory());
  }
  if (action === "url-audit") {
    if (!requireAdmin(request, response)) return null;
    return send(response, await workshop.auditUrls(request.query?.key || ""));
  }
  return response.status(404).json({ error: "Action inconnue." });
}

async function handlePost(request, response, action) {
  if (action === "bootstrap") {
    if (Array.isArray(request.body?.customRules) && !requireAdmin(request, response))
      return null;
    return send(response, bootstrapResponse(request));
  }
  if (action === "login") {
    if (!isValidAdminPassword(request.body?.password || ""))
      return response.status(401).json({ error: "Mot de passe administrateur incorrect." });
    setSession(response, request);
    return send(response, { authenticated: true });
  }
  if (action === "logout") {
    clearSession(response, request);
    return send(response, { authenticated: false });
  }
  if (action === "validate") {
    if (!requireAdmin(request, response)) return null;
    return send(
      response,
      workshop.validate(
        request.body?.sourceData,
        request.body?.file || "",
        request.body?.kind || "",
      ),
    );
  }
  if (action === "preview-rule") {
    if (!requireAdmin(request, response)) return null;
    return send(response, workshop.previewCustomRule(request.body || {}));
  }
  return response.status(404).json({ error: "Action inconnue." });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET")
      return await handleGet(request, response, actionFrom(request));
    if (request.method === "POST")
      return await handlePost(request, response, actionFrom(request));
    return response.status(405).json({ error: "Méthode non autorisée." });
  } catch (error) {
    return response.status(error.status || 500).json({ error: error.message });
  }
};
