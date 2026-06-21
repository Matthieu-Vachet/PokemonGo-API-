const { buildChecklist, detailForKey } = require("../apps/checklist/server/engine");
const workshop = require("../apps/checklist/server/workshop");
const { summarizeChecklist } = require("../src/lib/site-dashboard");

function actionFrom(request) {
  return String(request.query?.action || "bootstrap").trim();
}

function send(response, data, cacheSeconds = 300) {
  response.setHeader(
    "Cache-Control",
    `public, max-age=0, s-maxage=${cacheSeconds}, stale-while-revalidate=86400`,
  );
  return response.status(200).json({ data });
}

function bootstrapResponse() {
  const entries = buildChecklist();
  const dataCatalog = workshop.catalog();
  return {
    entries,
    summary: summarizeChecklist(entries),
    catalog: {
      types: dataCatalog.types.length,
      weather: dataCatalog.weather.length,
      stickers: dataCatalog.stickers.length,
      moves: dataCatalog.moves.length,
    },
    customRules: [],
  };
}

function publicDetail(detail) {
  return detail;
}

function readOnlyResponse(response) {
  return response.status(410).json({
    error: "Action de correction déplacée vers le dashboard privé. PokemonGo-API est maintenant read-only.",
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
    return send(response, bootstrapResponse());
  if (action === "detail") {
    const data = detailForKey(String(request.query?.key || ""));
    if (!data) return response.status(404).json({ error: "Fiche introuvable." });
    return send(response, {
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
    return send(response, { readOnly: true });
  if (["source-watch", "history", "url-audit"].includes(action))
    return readOnlyResponse(response);
  return response.status(404).json({ error: "Action inconnue." });
}

module.exports = async function handler(request, response) {
  try {
    if (request.method === "OPTIONS") {
      response.setHeader("Allow", "GET, HEAD, OPTIONS");
      return response.status(204).end();
    }
    if (request.method === "GET" || request.method === "HEAD")
      return await handleGet(request, response, actionFrom(request));
    response.setHeader("Allow", "GET, HEAD, OPTIONS");
    return response.status(405).json({ error: "Méthode non autorisée." });
  } catch (error) {
    return response.status(error.status || 500).json({ error: error.message });
  }
};
