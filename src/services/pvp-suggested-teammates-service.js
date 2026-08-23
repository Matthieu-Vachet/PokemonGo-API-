const { ApiError } = require("../lib/api-error");
const { PvpTeammateCache } = require("../models");
const identityService = require("./pokemon-identity-service");

const sourceBaseUrl = "https://pvpoke.com";
const cacheTtlMs = 24 * 60 * 60 * 1000;
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

function normalizedAlias(item) {
  const providerAlias = safeToken(item.providerAlias, "Alias");
  return {
    providerAlias,
    identityAlias: providerAlias.replace(/_shadow$/, ""),
    shadow: providerAlias.endsWith("_shadow"),
  };
}

function rankingAlias(ranking) {
  return String(ranking?.sourceIdentity?.speciesId || "").trim().toLowerCase();
}

function rankingDex(ranking) {
  return Number(ranking?.pokemon?.dexNr || ranking?.pokemon?.identity?.pokemonId) || null;
}

function rankedCandidateScore(candidate, sourceCounters) {
  const covered = (candidate.matchups || []).filter((matchup) => sourceCounters.has(matchup.sourceId));
  const coverage = covered.reduce((total, matchup) => {
    const counter = sourceCounters.get(matchup.sourceId);
    const urgency = Math.max(0.5, (1000 - Number(counter?.rating || 500)) / 500);
    const certainty = Math.max(0.5, Number(matchup.rating || 500) / 500);
    return total + (urgency * certainty);
  }, 0);
  const sharedWeaknesses = (candidate.counters || []).filter((counter) => sourceCounters.has(counter.sourceId)).length;
  return {
    coverage,
    sharedWeaknesses,
    value: (coverage * 1000) + (Number(candidate.score || 0) * 10) - (sharedWeaknesses * 250) - Number(candidate.rank || 9999),
  };
}

function rankingToRawSuggestedItem(ranking, rankOrOrder) {
  const providerAlias = safeToken(rankingAlias(ranking), "Alias");
  return {
    rawName: ranking.sourceIdentity?.speciesName || ranking.pokemon?.names?.English || providerAlias,
    providerAlias,
    rankOrOrder,
  };
}

function suggestedTeammatesFromRankings(context, limit = 20) {
  if (!Array.isArray(context.rankings)) {
    throw new ApiError(
      502,
      "Le snapshot PvPoke synchronisé ne contient pas le classement requis.",
      "PVP_TEAMMATE_RANKING_SNAPSHOT_INVALID",
    );
  }
  const source = context.rankings.find((ranking) => rankingAlias(ranking) === context.speciesId);
  if (!source) return { items: [], diagnostics: [], emptyReason: "RANKING_NOT_FOUND" };
  const sourceCounters = new Map((source.counters || []).map((counter) => [counter.sourceId, counter]));
  const sourceDex = rankingDex(source);
  const candidates = context.rankings
    .filter((candidate) => rankingAlias(candidate) && rankingAlias(candidate) !== context.speciesId)
    .filter((candidate) => !sourceDex || rankingDex(candidate) !== sourceDex)
    .map((candidate) => ({ candidate, ...rankedCandidateScore(candidate, sourceCounters) }))
    .sort((left, right) => right.value - left.value || Number(left.candidate.rank || 9999) - Number(right.candidate.rank || 9999));

  const selected = [];
  const usedDex = new Set();
  for (const entry of candidates) {
    const dex = rankingDex(entry.candidate);
    if (dex && usedDex.has(dex)) continue;
    selected.push(entry.candidate);
    if (dex) usedDex.add(dex);
    if (selected.length === limit) break;
  }
  const items = selected.map((ranking, index) => rankingToRawSuggestedItem(ranking, index + 1));
  return {
    items,
    sourceItem: rankingToRawSuggestedItem(source, 0),
    emptyReason: items.length ? null : "SOURCE_RETURNED_NO_SUGGESTIONS",
  };
}

function selectUniqueResolvedTeammates(items, sourcePokemonId, limit = 5) {
  const selected = [];
  const usedPokemonIds = new Set();
  const usedFallbacks = new Set();
  for (const item of items) {
    if (sourcePokemonId != null && item.pokemonId === sourcePokemonId) continue;
    const fallback = item.canonicalId || item.providerAlias;
    if (item.pokemonId != null && usedPokemonIds.has(item.pokemonId)) continue;
    if (item.pokemonId == null && usedFallbacks.has(fallback)) continue;
    selected.push({ ...item, rankOrOrder: selected.length + 1 });
    if (item.pokemonId != null) usedPokemonIds.add(item.pokemonId);
    else usedFallbacks.add(fallback);
    if (selected.length === limit) break;
  }
  return selected;
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
  const key = `v4:${sourceHash}:${league}:${speciesId}`;
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

  const sourceUrl = sourceUrlFor({ ...context, speciesId });
  const ranked = options.scrape
    ? null
    : suggestedTeammatesFromRankings({ ...context, league, speciesId });
  const scraped = ranked || await options.scrape({ ...context, league, speciesId });
  const resolvedBatch = await resolveSuggestedTeammates(
    ranked ? [ranked.sourceItem, ...ranked.items] : scraped.items,
    { league, speciesId },
    options.resolveAliasesBatch,
  );
  const resolved = ranked
    ? (() => {
      const source = resolvedBatch.items[0];
      const items = selectUniqueResolvedTeammates(resolvedBatch.items.slice(1), source?.pokemonId);
      const selectedAliases = new Set(items.map((item) => item.providerAlias));
      return {
        items,
        diagnostics: resolvedBatch.diagnostics.filter((diagnostic) => selectedAliases.has(diagnostic.sourceId)),
      };
    })()
    : resolvedBatch;
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
    sourceUrl: scraped.sourceUrl || sourceUrl,
    sourceStrategy: ranked ? "ranked-dataset-complement" : "browser-team-ranker",
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
  rankedCandidateScore,
  rankingToRawSuggestedItem,
  resolveSuggestedTeammates,
  sourceUrlFor,
  suggestedTeammatesFor,
  suggestedTeammatesFromRankings,
  selectUniqueResolvedTeammates,
};
