const { dataPath, dataRoot } = require("../lib/data-repository");
const { z } = require("zod");
const { ApiError } = require("../lib/api-error");
const identityService = require("./pokemon-identity-service");
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
  const identityResolution = await identityService.resolveAlias(payload);
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

const providerAssetRequestSchema = z.object({
  provider: z.string().trim().min(1),
  rawAlias: z.string().trim().min(1),
  shiny: z.boolean().optional(),
  isShiny: z.boolean().optional(),
  isFemale: z.boolean().optional(),
  pokemonId: z.coerce.number().int().positive().optional(),
  form: z.string().trim().min(1).nullable().optional(),
  costume: z.string().trim().min(1).nullable().optional(),
  transformation: z.string().trim().min(1).nullable().optional(),
}).passthrough();

const providerAssetBatchSchema = z.array(providerAssetRequestSchema).min(1).max(500);

async function resolveProviderPokemonAssets(payloads = []) {
  const parsed = providerAssetBatchSchema.safeParse(payloads);
  if (!parsed.success) {
    throw new ApiError(
      422,
      "La résolution d'assets en lot est invalide.",
      "IDENTITY_ASSET_BATCH_INVALID",
      parsed.error.flatten(),
    );
  }
  const identityResolutions = await identityService.resolveAliasesBatch(parsed.data);
  return identityResolutions.map((identityResolution, index) => {
    const payload = parsed.data[index];
    if (identityResolution.status !== "matched") {
      return {
        request: payload,
        identityResolution,
        assetResolution: null,
        status: identityResolution.status,
        reason: identityResolution.reason || "CANONICAL_ID_NOT_FOUND",
      };
    }
    const assetResolution = resolveCanonicalPokemonAsset(identityResolution.identity, {
      shiny: payload.shiny === true || payload.isShiny === true,
      ...(typeof payload.isFemale === "boolean" ? { isFemale: payload.isFemale } : {}),
    });
    return {
      request: payload,
      identityResolution,
      assetResolution,
      status: assetResolution.status,
      reason: assetResolution.reason,
    };
  });
}

module.exports = {
  invalidateLocalAssetInventory,
  resolveCanonicalPokemonAsset,
  resolveProviderPokemonAsset,
  resolveProviderPokemonAssets,
};
