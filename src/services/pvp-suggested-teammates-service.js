const fs = require("node:fs");
const { ApiError } = require("../lib/api-error");
const { PvpTeammateCache } = require("../models");
const identityService = require("./pokemon-identity-service");

const sourceBaseUrl = "https://pvpoke.com";
const cacheTtlMs = 24 * 60 * 60 * 1000;
const sourceReadyTimeoutMs = 48_000;
const safeTokenPattern = /^[a-z0-9_]+$/;

function safeToken(value, field) {
  const token = String(value || "").trim().toLowerCase();
  if (!safeTokenPattern.test(token)) throw new ApiError(422, `${field} PvPoke invalide.`, "PVP_TEAMMATE_CONTEXT_INVALID");
  return token;
}

function safeContextId(value, field) {
  const token = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(token)) throw new ApiError(422, `${field} PvPoke invalide.`, "PVP_TEAMMATE_CONTEXT_INVALID");
  return token;
}

function sourceUrlFor({ sourceGroup, cp, speciesId }) {
  const group = safeToken(sourceGroup, "Groupe");
  const species = safeToken(speciesId, "SpeciesId");
  const cap = Number(cp);
  if (!Number.isInteger(cap) || cap < 10 || cap > 10000) throw new ApiError(422, "Plafond PC PvPoke invalide.", "PVP_TEAMMATE_CONTEXT_INVALID");
  return `${sourceBaseUrl}/rankings/${group}/${cap}/overall/${species}/`;
}

async function launchBrowser() {
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);
  const localCandidates = process.platform === "darwin" ? [
    process.env.CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean) : [];
  const localExecutable = localCandidates.find((candidate) => {
    try {
      return fs.statSync(candidate).isFile() && !fs.accessSync(candidate, fs.constants.X_OK);
    } catch {
      return false;
    }
  });
  return puppeteer.launch({
    args: localExecutable ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args,
    defaultViewport: { width: 1280, height: 900 },
    executablePath: localExecutable || await chromium.executablePath(),
    headless: "shell",
  });
}

function shouldBlockPvpokeRequest(url, resourceType) {
  if (["font", "image", "media"].includes(resourceType)) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname !== "pvpoke.com" && hostname !== "www.pvpoke.com";
  } catch {
    return true;
  }
}

async function waitForSuggestedTeammates(page, { sourceUrl, timeout = sourceReadyTimeoutMs, browserErrors = [] } = {}) {
  try {
    await page.waitForFunction(
      () => document.querySelectorAll(".partner-pokemon .list a").length > 0
        || !document.querySelector(".partner-pokemon"),
      { polling: 250, timeout },
    );
  } catch (error) {
    throw new ApiError(
      504,
      "PvPoke n'a pas terminé le calcul des coéquipiers suggérés dans le délai imparti.",
      "PVP_TEAMMATE_SOURCE_TIMEOUT",
      {
        sourceUrl,
        timeout,
        browserErrors: browserErrors.slice(-5),
        cause: error instanceof Error ? error.message : String(error),
      },
    );
  }
}

async function scrapeSuggestedTeammates(context) {
  const sourceUrl = sourceUrlFor(context);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("pageerror", (error) => browserErrors.push(error instanceof Error ? error.message : String(error)));
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149 Safari/537.36");
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (shouldBlockPvpokeRequest(request.url(), request.resourceType())) request.abort();
      else request.continue();
    });
    await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 40_000 });
    await waitForSuggestedTeammates(page, { sourceUrl, browserErrors });
    const items = await page.$$eval(".partner-pokemon .list a", (links) => links.slice(0, 5).map((link, index) => ({
      rawName: String(link.textContent || "").replace(/\s*→\s*$/, "").trim(),
      providerAlias: link.getAttribute("data") || "",
      rankOrOrder: index + 1,
    })));
    return {
      sourceUrl,
      items,
      emptyReason: items.length ? null : "SOURCE_RETURNED_NO_SUGGESTIONS",
    };
  } finally {
    await browser.close();
  }
}

function normalizedAlias(item) {
  const providerAlias = safeToken(item.providerAlias, "Alias");
  return {
    providerAlias,
    identityAlias: providerAlias.replace(/_shadow$/, ""),
    shadow: providerAlias.endsWith("_shadow"),
  };
}

async function resolveSuggestedTeammates(rawItems, context, resolver = identityService.resolveAliasesBatch) {
  const prepared = rawItems.map((item) => ({ ...item, ...normalizedAlias(item) }));
  const resolutions = await resolver(prepared.map((item) => ({
    provider: "pvpoke",
    rawAlias: item.identityAlias,
  })));
  const items = prepared.map((item, index) => {
    const resolution = resolutions[index] || { status: "unmatched", reason: "ALIAS_UNKNOWN", confidence: 0 };
    const identity = resolution.identity || null;
    const local = identity?.localIdentity || null;
    const selectedAsset = resolution.selectedAsset || local?.assets || null;
    const image = selectedAsset?.image || null;
    const shinyImage = selectedAsset?.shinyImage || null;
    const assetStatus = resolution.status === "matched" && image ? "matched" : "missing-asset";
    return {
      rawName: item.rawName,
      providerAlias: item.providerAlias,
      canonicalId: identity?.canonicalId || null,
      pokemonId: identity?.pokemonId || null,
      form: identity?.form || null,
      costume: identity?.costume || null,
      shadow: item.shadow,
      rankOrOrder: Number(item.rankOrOrder) || index + 1,
      resolutionStatus: resolution.status,
      resolutionReason: resolution.reason || null,
      pokemon: identity ? {
        id: local?.pokemonKey || identity.canonicalId,
        dexNr: identity.pokemonId,
        formId: local?.formId || identity.form || identity.canonicalId,
        names: { French: local?.pokemonName || item.rawName, English: item.rawName },
        types: local?.types || [],
        assets: { image, shinyImage },
        identity: {
          canonicalId: identity.canonicalId,
          pokemon: identity.pokemonId,
          form: identity.form || local?.formId || null,
          costume: identity.costume || null,
          provider: "pvpoke",
          rawAlias: item.identityAlias,
          image,
          shinyImage,
          resolutionStatus: assetStatus,
          assetResolution: {
            status: assetStatus,
            image,
            shinyImage,
            reason: assetStatus === "matched" ? null : "CANONICAL_ASSET_MISSING",
          },
        },
      } : null,
    };
  });
  const diagnostics = items.filter((item) => item.resolutionStatus !== "matched").map((item) => ({
    provider: "pvpoke",
    sourceId: item.providerAlias,
    rawAlias: item.providerAlias.replace(/_shadow$/, ""),
    pokemonId: item.pokemonId,
    pokemon: item.rawName,
    form: item.form,
    costume: item.costume,
    reason: item.resolutionReason || "ALIAS_UNKNOWN",
    confidence: 0,
    candidates: [],
    proposedAction: "associate",
    sourcePayload: { domain: "pvp-rankings", league: context.league, speciesId: context.speciesId },
  }));
  return { items, diagnostics };
}

async function suggestedTeammatesFor(context, options = {}) {
  const sourceHash = String(context.sourceHash || "");
  const league = safeContextId(context.league, "Ligue");
  const speciesId = safeToken(context.speciesId, "SpeciesId");
  const key = `v2:${sourceHash}:${league}:${speciesId}`;
  const now = new Date();
  const cacheModel = options.cacheModel || PvpTeammateCache;
  const persistenceWarnings = [];
  let cached = null;
  try {
    cached = await cacheModel.findOne({ key, expiresAt: { $gt: now } }).lean();
  } catch (error) {
    persistenceWarnings.push({
      code: "PVP_TEAMMATE_CACHE_READ_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (cached) return { ...cached, cache: "hit" };

  const scraped = await (options.scrape || scrapeSuggestedTeammates)({ ...context, league, speciesId });
  const resolved = await resolveSuggestedTeammates(scraped.items, { league, speciesId }, options.resolveAliasesBatch);
  if (resolved.diagnostics.length) {
    try {
      await (options.recordDiagnosticsBatch || identityService.recordDiagnosticsBatch)(resolved.diagnostics);
    } catch (error) {
      persistenceWarnings.push({
        code: "PVP_TEAMMATE_DIAGNOSTICS_WRITE_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const payload = {
    key,
    league,
    speciesId,
    sourceHash,
    sourceUrl: scraped.sourceUrl,
    fetchedAt: now,
    expiresAt: new Date(now.getTime() + cacheTtlMs),
    items: resolved.items,
    diagnostics: resolved.diagnostics,
    emptyReason: scraped.emptyReason || null,
  };
  try {
    await cacheModel.findOneAndUpdate({ key }, { $set: payload }, { upsert: true, returnDocument: "after" });
  } catch (error) {
    persistenceWarnings.push({
      code: "PVP_TEAMMATE_CACHE_WRITE_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return { ...payload, cache: persistenceWarnings.length ? "miss-unpersisted" : "miss", persistenceWarnings };
}

module.exports = {
  normalizedAlias,
  resolveSuggestedTeammates,
  scrapeSuggestedTeammates,
  shouldBlockPvpokeRequest,
  sourceUrlFor,
  suggestedTeammatesFor,
  waitForSuggestedTeammates,
};
