const { dataPath, dataRoot } = require("../lib/data-repository");
const { resolveAlias } = require("./pokemon-identity-service");
const {
  pokemonResolutionRevision,
  registerPokemonResolutionInvalidator,
} = require("./pokemon-resolution-cache-service");

const { loadPokemonEntries } = require(dataPath("scripts", "lib", "current-event-utils.js"));
const {
  resolvePokemonAssetByCanonicalIdentity,
} = require(dataPath("scripts", "lib", "pokemon-canonical-asset-resolver.js"));

const cache = new Map();
let entries = null;

registerPokemonResolutionInvalidator(() => {
  cache.clear();
});

function localEntries({ force = false } = {}) {
  if (force || !entries) entries = loadPokemonEntries(dataRoot);
  return entries;
}

function invalidateLocalAssetInventory() {
  entries = null;
  cache.clear();
}

function resolveCanonicalPokemonAsset(identity, options = {}) {
  const key = JSON.stringify([
    pokemonResolutionRevision(),
    identity?.identityId || identity?.canonicalId || null,
    options.shiny === true,
    typeof options.isFemale === "boolean" ? options.isFemale : null,
  ]);
  if (!options.force && cache.has(key)) return cache.get(key);
  const result = resolvePokemonAssetByCanonicalIdentity({
    identity,
    entries: localEntries({ force: options.force === true }),
    shiny: options.shiny === true,
    ...(typeof options.isFemale === "boolean" ? { isFemale: options.isFemale } : {}),
  });
  cache.set(key, result);
  return result;
}

async function resolveProviderPokemonAsset(payload = {}) {
  const identityResolution = await resolveAlias(payload);
  if (identityResolution.status !== "matched") {
    return {
      identityResolution,
      assetResolution: null,
      status: identityResolution.status,
      reason: identityResolution.reason || "CANONICAL_ID_NOT_FOUND",
    };
  }
  const assetResolution = resolveCanonicalPokemonAsset(identityResolution.identity, {
    shiny: payload.shiny === true || payload.isShiny === true,
    ...(typeof payload.isFemale === "boolean" ? { isFemale: payload.isFemale } : {}),
    force: payload.force === true,
  });
  return {
    identityResolution,
    assetResolution,
    status: assetResolution.status,
    reason: assetResolution.reason,
  };
}

module.exports = {
  invalidateLocalAssetInventory,
  resolveCanonicalPokemonAsset,
  resolveProviderPokemonAsset,
};
