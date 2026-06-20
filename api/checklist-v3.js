const { buildChecklist, detailForKey } = require("../apps/checklist/server/engine");
const workshop = require("../apps/checklist/server/workshop");
const { summarizeChecklist } = require("../src/lib/site-dashboard");

function actionFrom(request) {
  return String(
    request.query?.action ||
      request.body?.action ||
      "bootstrap",
  ).trim();
}

function payloadRules(request) {
  return null;
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
      admin: false,
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
  return detail;
}

function readOnlyResponse(response) {
  return response.status(410).json({
    error: "Action admin migrée vers dashboard_Admin. PokemonGo-API est maintenant read-only.",
  });
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
    return send(response, {
      viewer: { admin: false },
      detail: publicDetail(data),
    });
  }
  if (action === "catalog")
    return send(response, workshop.catalog());
  if (action === "assets") {
    const audit = await workshop.assetAudit(request.query?.dexId || "");
    return send(response, publicAssetAudit(audit));
  }
  if (action === "session")
    return send(response, { authenticated: false, readOnly: true });
  if (["source-watch", "history", "url-audit"].includes(action))
    return readOnlyResponse(response);
  return response.status(404).json({ error: "Action inconnue." });
}

async function handlePost(request, response, action) {
  if (action === "bootstrap")
    return send(response, bootstrapResponse(request));
  if (["login", "logout", "validate", "preview-rule"].includes(action))
    return readOnlyResponse(response);
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
