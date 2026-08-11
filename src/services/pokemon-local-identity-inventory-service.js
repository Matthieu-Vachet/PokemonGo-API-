const { z } = require("zod");
const { dataPath, dataRoot } = require("../lib/data-repository");

const nullableString = z.string().nullable();
const localAssetSchema = z.object({
  isFemale: z.boolean().nullable(),
  gender: z.string(),
  image: nullableString,
  shinyImage: nullableString,
  sourcePath: nullableString,
  source: nullableString,
});
const localReferenceSchema = z.object({
  type: z.string().min(1),
  sourceFile: z.string().min(1),
  sourcePath: nullableString,
  assetsRef: nullableString,
});
const localIdentitySchema = z.object({
  canonicalId: z.string().min(1),
  pokemonId: z.number().int().positive(),
  pokemonKey: nullableString,
  pokemonName: nullableString,
  types: z.array(z.string().min(1)).max(2),
  form: nullableString,
  formId: nullableString,
  parentFormId: nullableString,
  costume: nullableString,
  transformation: nullableString,
  category: z.string().min(1),
  identityKey: z.string().min(1),
  sourceType: z.string().min(1),
  sourceFile: z.string().min(1),
  pokemonSourceFile: nullableString,
  assetsRef: nullableString,
  assets: z.object({
    image: nullableString,
    shinyImage: nullableString,
    imageSource: nullableString,
    shinyImageSource: nullableString,
  }),
  genderAssets: z.array(localAssetSchema),
  genderVariants: z.object({ male: z.boolean(), female: z.boolean() }),
  localReferences: z.array(localReferenceSchema),
  fingerprint: z.string().length(64),
  issues: z.array(z.string()),
});
const inventorySchema = z.object({
  metadata: z.object({
    schemaVersion: z.number().int().positive(),
    source: z.literal("PokemonGo-Data"),
    generatedAt: z.string(),
    fingerprint: z.string().length(64),
  }),
  stats: z.object({ totalIdentities: z.number().int().nonnegative() }).passthrough(),
  identities: z.array(localIdentitySchema),
  issues: z.array(z.unknown()),
});

let cache = null;

function inventoryModule() {
  const modulePath = dataPath("tooling", "lib", "pokemon-local-identity-inventory.js");
  // Le module partagé vit dans PokemonGo-Data afin que l'API et les audits appliquent le même contrat.
  return require(modulePath);
}

function normalizeToken(value) {
  return inventoryModule().normalizeIdentityToken(value);
}

const regionalTokenRoots = new Map([
  ["ALOLAN", "ALOLA"],
  ["GALARIAN", "GALAR"],
  ["HISUIAN", "HISUI"],
  ["PALDEAN", "PALDEA"],
]);

function comparableIdentityToken(value) {
  return normalizeToken(value)
    .split("_")
    .filter((token) => token && token !== "NORMAL")
    .map((token) => regionalTokenRoots.get(token) || token)
    .sort()
    .join("|");
}

function loadLocalIdentityInventory({ force = false } = {}) {
  if (!force && cache) return cache;
  const raw = inventoryModule().loadPokemonLocalIdentityInventory(dataRoot);
  const parsed = inventorySchema.safeParse(raw);
  if (!parsed.success) {
    const error = new Error("Le contrat d'inventaire PokemonGo-Data est invalide.");
    error.code = "LOCAL_IDENTITY_INVENTORY_INVALID";
    error.details = parsed.error.issues;
    throw error;
  }
  const byCanonicalId = new Map();
  const byIdentityKey = new Map();
  const byPokemonId = new Map();
  for (const identity of parsed.data.identities) {
    byCanonicalId.set(identity.canonicalId, identity);
    byIdentityKey.set(identity.identityKey, identity);
    if (!byPokemonId.has(identity.pokemonId)) byPokemonId.set(identity.pokemonId, []);
    byPokemonId.get(identity.pokemonId).push(identity);
  }
  cache = { ...parsed.data, indexes: { byCanonicalId, byIdentityKey, byPokemonId } };
  return cache;
}

function invalidateLocalIdentityInventory() {
  cache = null;
}

function searchLocalIdentities(query = {}) {
  const inventory = loadLocalIdentityInventory();
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const search = normalizeToken(query.search);
  const pokemonId = Number(query.pokemonId) || null;
  const items = inventory.identities.filter((identity) => {
    if (pokemonId && identity.pokemonId !== pokemonId) return false;
    if (query.category && identity.category !== query.category) return false;
    if (query.form && !normalizeToken(identity.form || identity.formId).includes(normalizeToken(query.form))) return false;
    if (query.costume && !normalizeToken(identity.costume).includes(normalizeToken(query.costume))) return false;
    if (!search) return true;
    return [identity.canonicalId, identity.pokemonName, identity.form, identity.formId, identity.costume, identity.transformation]
      .some((value) => normalizeToken(value).includes(search));
  });
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: { page, limit, total: items.length, pages: Math.ceil(items.length / limit) },
    stats: inventory.stats,
    metadata: inventory.metadata,
  };
}

function findDeterministicLocalCandidates(payload = {}) {
  const inventory = loadLocalIdentityInventory();
  const token = normalizeToken(payload.normalizedAlias || payload.rawAlias || payload.alias);
  const pokemonId = Number(payload.pokemonId) || null;
  if (!token && !pokemonId) return [];
  const pool = pokemonId ? inventory.indexes.byPokemonId.get(pokemonId) || [] : inventory.identities;
  const exact = pool.filter((identity) => normalizeToken(identity.canonicalId) === token);
  if (exact.length) return exact;
  const hasStructuredHint = [payload.form, payload.costume, payload.transformation]
    .some((value) => Boolean(normalizeToken(value)));
  if (!hasStructuredHint) {
    const comparable = comparableIdentityToken(token);
    const equivalent = comparable
      ? pool.filter((identity) => [identity.canonicalId, identity.formId]
        .some((value) => comparableIdentityToken(value) === comparable))
      : [];
    if (equivalent.length) return equivalent;
  }
  if (!pokemonId) return [];
  const form = normalizeToken(payload.form);
  const costume = normalizeToken(payload.costume);
  const transformation = normalizeToken(payload.transformation);
  if (!form && !costume && !transformation) return [];
  return pool.filter((identity) => (
    (!form || [identity.form, identity.formId].some((value) => normalizeToken(value) === form))
    && (!costume || normalizeToken(identity.costume) === costume)
    && (!transformation || normalizeToken(identity.transformation) === transformation)
  ));
}

function selectGenderAsset(identity, requestedIsFemale) {
  const assets = identity?.genderAssets || [];
  if (typeof requestedIsFemale === "boolean") {
    return assets.find((asset) => asset.isFemale === requestedIsFemale)
      || assets.find((asset) => asset.isFemale === null)
      || null;
  }
  return assets.find((asset) => asset.isFemale === false)
    || assets.find((asset) => asset.isFemale === null)
    || assets[0]
    || null;
}

module.exports = {
  findDeterministicLocalCandidates,
  invalidateLocalIdentityInventory,
  inventorySchema,
  loadLocalIdentityInventory,
  localIdentitySchema,
  comparableIdentityToken,
  searchLocalIdentities,
  selectGenderAsset,
};
