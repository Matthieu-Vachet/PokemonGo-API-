const crypto = require("crypto");
const { z } = require("zod");
const { ApiError } = require("../lib/api-error");
const {
  PokemonIdentity,
  PokemonIdentityDiagnostic,
  PokemonIdentityHistory,
} = require("../models");
const {
  findDeterministicLocalCandidates,
  loadLocalIdentityInventory,
  selectGenderAsset,
} = require("./pokemon-local-identity-inventory-service");
const { localIdentityPayload } = require("./pokemon-identity-sync-service");
const { invalidatePokemonResolutionCaches } = require("./pokemon-resolution-cache-service");

const identityStatuses = ["active", "draft", "deprecated", "ignored"];
const aliasStatuses = ["active", "deprecated", "ignored", "conflict"];
const aliasSources = ["manual", "migration", "detected", "rule", "import"];
const diagnosticStatuses = ["open", "resolved", "ignored", "false-positive"];
const diagnosticReasons = [
  "unknown-alias", "unknown-pokemon", "unknown-form", "unknown-costume", "missing-canonical-id", "duplicate", "conflict", "multiple-candidates", "ambiguous-gender", "deprecated-identity", "ignored-alias", "incomplete-source", "missing-local-match",
  "ALIAS_UNKNOWN", "POKEMON_UNKNOWN", "FORM_UNKNOWN", "COSTUME_UNKNOWN", "CANONICAL_ID_MISSING", "CANONICAL_ID_NOT_SYNCHRONIZED", "DUPLICATE_ALIAS", "ALIAS_CONFLICT", "MULTIPLE_FUNCTIONAL_IDENTITIES", "GENDER_ASSET_UNAVAILABLE", "IDENTITY_DEPRECATED", "ALIAS_IGNORED", "SOURCE_DATA_INCOMPLETE", "LOCAL_IDENTITY_MISSING", "VARIANT_NOT_FOUND",
];

const providerCatalog = Object.freeze([
  { id: "game-master", label: "Game Master · PokeMiners", domains: ["pokemon-identity-mappings"], visibility: "private" },
  { id: "pokeminers-game-masters", label: "PokeMiners Game Masters", domains: ["game-master"], visibility: "private" },
  {
    id: "leekduck",
    label: "LeekDuck",
    domains: ["raids", "eggs", "research", "rocket", "events"],
    visibility: "public",
    aliases: ["leekduck-eggs", "leekduck-research", "leekduck-rocket", "leekduck-rocket-lineups"],
  },
  { id: "leekduck-raids", label: "LeekDuck · Raids", domains: ["raids"], visibility: "private" },
  { id: "snacknap", label: "Snacknap", domains: ["max-battles", "shiny"], visibility: "mixed" },
  { id: "snacknap-max-battles", label: "Snacknap · Combats Dynamax", domains: ["max-battles"], visibility: "private" },
  { id: "pvpoke", label: "PvPoke", domains: ["pvp-rankings"], visibility: "public" },
  { id: "pvpoke-official-repository", label: "PvPoke · dépôt officiel", domains: ["pvp-rankings"], visibility: "private" },
  { id: "battleflow", label: "Battleflow", domains: ["gbl-calendar"], visibility: "public" },
  { id: "dialgadex-official-repository", label: "DialgaDex · dépôt officiel", domains: ["pve"], visibility: "private" },
  { id: "pokemon-go-hub", label: "Pokémon GO Hub", domains: ["best-defenders"], visibility: "public" },
  { id: "margxt", label: "Margxt", domains: ["pokemon-availability", "pokemon-shiny-availability", "pokemon-costumes", "pokemon-shadow-availability"], visibility: "private" },
  { id: "pogoapi", label: "Pokémon GO API", domains: ["catalogs"], visibility: "public" },
]);

function normalizeProviderToken(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const registeredProviders = new Set(providerCatalog.map((provider) => provider.id));
const providerCanonicalByToken = new Map();
const providerTokensByCanonical = new Map();

for (const definition of providerCatalog) {
  const tokens = [definition.id, ...(definition.aliases || [])].map(normalizeProviderToken);
  providerTokensByCanonical.set(definition.id, tokens);
  for (const token of tokens) {
    const existing = providerCanonicalByToken.get(token);
    if (existing && existing !== definition.id) {
      throw new Error(`Alias de fournisseur Identity Manager dupliqué : ${token}`);
    }
    providerCanonicalByToken.set(token, definition.id);
  }
}

function normalizeProvider(value) {
  const token = normalizeProviderToken(value);
  return providerCanonicalByToken.get(token) || token;
}

function providerStorageTokens(value) {
  const provider = normalizeProvider(value);
  return providerTokensByCanonical.get(provider) || [provider];
}

function providerStorageFilter(value) {
  const tokens = providerStorageTokens(value);
  return tokens.length === 1 ? tokens[0] : { $in: tokens };
}

function assertRegisteredProvider(value) {
  const provider = normalizeProvider(value);
  if (!provider || !registeredProviders.has(provider)) {
    throw new ApiError(422, `La source Identity Manager « ${provider || "vide"} » n’est pas enregistrée ou a été retirée.`, "IDENTITY_PROVIDER_NOT_REGISTERED", { provider });
  }
  return provider;
}

function normalizeAlias(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeCanonicalId(value) {
  return normalizeAlias(value).toUpperCase();
}

const nullableToken = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.string().trim().min(1).nullable(),
);

const aliasInputSchema = z.object({
  aliasId: z.string().uuid().optional(),
  provider: z.string().trim().min(1).max(80).transform(normalizeProvider),
  value: z.string().trim().min(1).max(300),
  status: z.enum(aliasStatuses).default("active"),
  confidence: z.coerce.number().min(0).max(1).default(1),
  source: z.enum(aliasSources).default("manual"),
  reason: z.string().trim().max(1000).nullable().optional(),
  firstDetectedAt: z.coerce.date().nullable().optional(),
  lastDetectedAt: z.coerce.date().nullable().optional(),
  occurrences: z.coerce.number().int().min(0).default(0),
});

const identityInputSchema = z.object({
  canonicalId: z.string().trim().min(1).max(160).transform(normalizeCanonicalId),
  pokemonId: z.coerce.number().int().min(1).max(99999),
  form: nullableToken.default(null),
  costume: nullableToken.default(null),
  transformation: nullableToken.default(null),
  status: z.enum(identityStatuses).default("active"),
  aliases: z.array(aliasInputSchema).default([]),
  genderVariants: z.object({ male: z.boolean().default(false), female: z.boolean().default(false) }).default({ male: false, female: false }),
  localReference: z.object({
    key: nullableToken.default(null),
    formId: nullableToken.default(null),
    file: nullableToken.default(null),
    assetsRef: nullableToken.default(null),
  }).optional(),
  metadata: z.object({
    notes: z.string().trim().max(5000).nullable().optional(),
    tags: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  }).optional(),
});

const identityPatchSchema = identityInputSchema.omit({ aliases: true }).partial().extend({
  reason: z.string().trim().max(1000).nullable().optional(),
});

const importSchema = z.object({
  identities: z.array(identityInputSchema).max(10000),
  mode: z.enum(["preview", "apply"]).default("preview"),
});

const diagnosticInputSchema = z.object({
  provider: z.string().trim().min(1).transform(normalizeProvider),
  sourceId: z.string().trim().nullable().optional(),
  rawAlias: z.string().trim().min(1),
  pokemonId: z.coerce.number().int().min(1).nullable().optional(),
  pokemon: z.string().trim().nullable().optional(),
  form: z.string().trim().nullable().optional(),
  costume: z.string().trim().nullable().optional(),
  reason: z.enum(diagnosticReasons).default("ALIAS_UNKNOWN"),
  confidence: z.coerce.number().min(0).max(1).default(0),
  candidates: z.array(z.unknown()).default([]),
  proposedAction: z.string().trim().default("associate"),
  sourcePayload: z.unknown().optional(),
});

const cache = { expiresAt: 0, aliases: null, providerAliases: new Map() };
const CACHE_TTL_MS = 30_000;

function invalidateIdentityCache() {
  cache.expiresAt = 0;
  cache.aliases = null;
  cache.providerAliases.clear();
  invalidatePokemonResolutionCaches("identity-catalog-invalidated");
}

function parse(schema, payload, code = "IDENTITY_VALIDATION_FAILED") {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError(422, "Données Identity Manager invalides.", code, result.error.issues);
  }
  return result.data;
}

function actor(value) {
  return String(value || "dashboard-admin").trim() || "dashboard-admin";
}

function serialize(document) {
  if (!document) return null;
  const source = typeof document.toObject === "function" ? document.toObject({ versionKey: false }) : document;
  const identifier = source?._id && typeof source._id.toHexString === "function"
    ? source._id.toHexString()
    : source?._id == null
      ? null
      : String(source._id);
  // JSON.stringify delegates BSON values such as ObjectId to their toJSON()
  // implementation. structuredClone() would instead expose their internal
  // buffer, which previously turned every lean Mongo identifier into
  // "[object Object]" and made CRUD URLs as well as React keys unusable.
  const value = JSON.parse(JSON.stringify(source));
  if (identifier) {
    value._id = identifier;
    value.id = identifier;
  }
  delete value.activeAliasKeys;
  return value;
}

function mongoConflict(error) {
  if (error?.code !== 11000) throw error;
  const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "alias";
  throw new ApiError(409, `Conflit d'intégrité Identity Manager sur ${field}.`, "IDENTITY_CONFLICT", error.keyValue || null);
}

async function validateLocalIdentityReference(input) {
  if (input.status !== "active") return null;
  const inventory = loadLocalIdentityInventory();
  const canonicalId = normalizeCanonicalId(input.canonicalId);
  const exact = inventory.indexes.byCanonicalId.get(canonicalId);
  const candidates = exact
    ? [exact]
    : findDeterministicLocalCandidates({
      pokemonId: input.pokemonId,
      form: input.form,
      costume: input.costume,
      transformation: input.transformation,
    });
  if (!candidates.length) {
    throw new ApiError(422, `L'identité ${canonicalId || `#${input.pokemonId}`} n'existe pas dans l'inventaire PokemonGo-Data. Utilisez le statut draft pour la préparer.`, "IDENTITY_LOCAL_MATCH_MISSING");
  }
  if (candidates.length > 1) {
    throw new ApiError(409, `Plusieurs identités locales correspondent à ${canonicalId}.`, "IDENTITY_LOCAL_MATCH_AMBIGUOUS", candidates.map((candidate) => candidate.canonicalId));
  }
  if (candidates[0].canonicalId !== canonicalId) {
    throw new ApiError(422, `Le canonicalId attendu pour cette référence locale est ${candidates[0].canonicalId}.`, "IDENTITY_CANONICAL_ID_MISMATCH", { expected: candidates[0].canonicalId });
  }
  return candidates[0];
}

function synchronizedLocalFields(local, inventory = loadLocalIdentityInventory()) {
  if (!local) return {};
  const validatedAt = new Date();
  return {
    pokemonId: local.pokemonId,
    form: local.form,
    costume: local.costume,
    transformation: local.transformation,
    syncStatus: "synchronized",
    genderVariants: local.genderVariants,
    localReference: {
      key: local.identityKey,
      formId: local.formId,
      file: local.sourceFile,
      assetsRef: local.assetsRef,
    },
    localIdentity: localIdentityPayload(local, inventory.metadata, validatedAt),
  };
}

function prepareAlias(input, user) {
  const now = new Date();
  return {
    ...input,
    aliasId: input.aliasId || crypto.randomUUID(),
    provider: assertRegisteredProvider(input.provider),
    value: String(input.value).trim(),
    normalizedValue: normalizeAlias(input.value),
    reason: input.reason || null,
    createdAt: now,
    updatedAt: now,
    createdBy: user,
    updatedBy: user,
  };
}

async function assertAliasesAvailable(aliases, excludeIdentityId = null) {
  const activeKeys = aliases.filter((alias) => alias.status === "active").map((alias) => `${alias.provider}:${alias.normalizedValue}`);
  if (!activeKeys.length) return;
  const filter = { activeAliasKeys: { $in: activeKeys } };
  if (Array.isArray(excludeIdentityId) && excludeIdentityId.length) filter._id = { $nin: excludeIdentityId };
  else if (excludeIdentityId) filter._id = { $ne: excludeIdentityId };
  const conflict = await PokemonIdentity.findOne(filter).select({ canonicalId: 1, activeAliasKeys: 1 }).lean();
  if (conflict) {
    const duplicate = activeKeys.find((key) => conflict.activeAliasKeys?.includes(key));
    throw new ApiError(409, `L'alias actif ${duplicate} est déjà associé à ${conflict.canonicalId}.`, "IDENTITY_ALIAS_CONFLICT", { key: duplicate, canonicalId: conflict.canonicalId });
  }
}

async function history(identity, action, user, options = {}) {
  return PokemonIdentityHistory.create({
    identityId: identity._id,
    canonicalId: identity.canonicalId,
    action,
    user,
    before: options.before || null,
    after: options.after || serialize(identity),
    provider: options.provider || null,
    alias: options.alias || null,
    normalizedAlias: options.alias ? normalizeAlias(options.alias) : null,
    reason: options.reason || null,
  });
}

async function createIdentity(payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(identityInputSchema, payload);
  const local = await validateLocalIdentityReference(input);
  const aliases = input.aliases.map((entry) => prepareAlias(entry, user));
  await assertAliasesAvailable(aliases);
  try {
    const identity = await PokemonIdentity.create({
      ...input,
      ...(local ? synchronizedLocalFields(local) : { syncStatus: "draft" }),
      aliases,
      createdBy: user,
      updatedBy: user,
    });
    await history(identity, "create", user);
    invalidateIdentityCache();
    return serialize(identity);
  } catch (error) {
    mongoConflict(error);
  }
}

function listFilter(query = {}) {
  const filter = {};
  if (query.status) filter.status = String(query.status);
  if (query.syncStatus) filter.syncStatus = String(query.syncStatus);
  if (query.provider) filter["aliases.provider"] = providerStorageFilter(query.provider);
  if (query.pokemonId) filter.pokemonId = Number(query.pokemonId);
  if (query.form) filter.form = { $regex: String(query.form), $options: "i" };
  if (query.costume) filter.costume = { $regex: String(query.costume), $options: "i" };
  if (String(query.conflict) === "true") filter["aliases.status"] = "conflict";
  if (String(query.withoutGameMaster) === "true") filter.aliases = { $not: { $elemMatch: { provider: "game-master", status: "active" } } };
  if (String(query.stale) === "true") filter["metadata.lastUsedAt"] = { $lt: new Date(Date.now() - 90 * 86400000) };
  if (query.search) {
    const escaped = String(query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { canonicalId: { $regex: escaped, $options: "i" } },
      { "localIdentity.pokemonName": { $regex: escaped, $options: "i" } },
      { "aliases.value": { $regex: escaped, $options: "i" } },
      { "aliases.normalizedValue": { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
}

async function listIdentities(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const sortField = ["canonicalId", "pokemonId", "updatedAt", "status", "syncStatus"].includes(query.sort) ? query.sort : "updatedAt";
  const sortOrder = String(query.order).toLowerCase() === "asc" ? 1 : -1;
  const filter = listFilter(query);
  const [documents, total, providerStats, statusStats] = await Promise.all([
    PokemonIdentity.find(filter).sort({ [sortField]: sortOrder }).skip((page - 1) * limit).limit(limit).lean(),
    PokemonIdentity.countDocuments(filter),
    PokemonIdentity.aggregate([{ $unwind: "$aliases" }, { $match: { "aliases.status": "active" } }, { $group: { _id: "$aliases.provider", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    PokemonIdentity.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return {
    items: documents.map(serialize),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    stats: {
      providers: aggregateProviderStats(providerStats, "count"),
      statuses: Object.fromEntries(statusStats.map((entry) => [entry._id, entry.count])),
    },
  };
}

async function listProviders() {
  const [aliasCounts, diagnosticCounts] = await Promise.all([
    PokemonIdentity.aggregate([{ $unwind: "$aliases" }, { $group: { _id: "$aliases.provider", aliases: { $sum: 1 }, activeAliases: { $sum: { $cond: [{ $eq: ["$aliases.status", "active"] }, 1, 0] } } } }]),
    PokemonIdentityDiagnostic.aggregate([{ $match: { status: "open" } }, { $group: { _id: "$provider", openDiagnostics: { $sum: 1 }, occurrences: { $sum: "$occurrences" } } }]),
  ]);
  const aliasesByProvider = aggregateProviderEntries(aliasCounts, ["aliases", "activeAliases"]);
  const diagnosticsByProvider = aggregateProviderEntries(diagnosticCounts, ["openDiagnostics", "occurrences"]);
  return providerCatalog.map((definition) => {
    const id = definition.id;
    const aliases = aliasesByProvider.get(id) || {};
    const diagnostics = diagnosticsByProvider.get(id) || {};
    return {
      ...definition,
      status: "active",
      aliases: Number(aliases.aliases || 0),
      activeAliases: Number(aliases.activeAliases || 0),
      openDiagnostics: Number(diagnostics.openDiagnostics || 0),
      occurrences: Number(diagnostics.occurrences || 0),
    };
  }).sort((left, right) => left.label.localeCompare(right.label, "fr"));
}

function aggregateProviderEntries(entries, fields) {
  const result = new Map();
  for (const entry of entries) {
    const provider = normalizeProvider(entry._id);
    if (!registeredProviders.has(provider)) continue;
    const aggregate = result.get(provider) || {};
    for (const field of fields) aggregate[field] = Number(aggregate[field] || 0) + Number(entry[field] || 0);
    result.set(provider, aggregate);
  }
  return result;
}

function aggregateProviderStats(entries, field) {
  return [...aggregateProviderEntries(entries, [field]).entries()]
    .map(([provider, values]) => ({ provider, [field]: values[field] }))
    .sort((left, right) => right[field] - left[field] || left.provider.localeCompare(right.provider));
}

async function getIdentity(identifier) {
  const filter = /^[a-f\d]{24}$/i.test(String(identifier)) ? { _id: identifier } : { canonicalId: normalizeCanonicalId(identifier) };
  const document = await PokemonIdentity.findOne(filter).lean();
  if (!document) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  return serialize(document);
}

async function updateIdentity(identifier, payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(identityPatchSchema, payload);
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const before = serialize(identity);
  const localCandidate = {
    pokemonId: input.pokemonId ?? identity.pokemonId,
    form: input.form !== undefined ? input.form : identity.form,
    costume: input.costume !== undefined ? input.costume : identity.costume,
    transformation: input.transformation !== undefined ? input.transformation : identity.transformation,
    canonicalId: input.canonicalId ?? identity.canonicalId,
    status: input.status ?? identity.status,
  };
  const local = await validateLocalIdentityReference(localCandidate);
  for (const field of ["canonicalId", "pokemonId", "form", "costume", "transformation", "status", "genderVariants", "localReference", "metadata"]) {
    if (input[field] !== undefined) identity[field] = input[field];
  }
  if (local) Object.assign(identity, synchronizedLocalFields(local));
  else if (identity.status === "draft") identity.syncStatus = identity.localIdentity ? identity.syncStatus : "draft";
  identity.updatedBy = user;
  try {
    await identity.save();
    await history(identity, before.canonicalId !== identity.canonicalId ? "canonical-change" : "update", user, { before, reason: input.reason });
    invalidateIdentityCache();
    return serialize(identity);
  } catch (error) {
    mongoConflict(error);
  }
}

async function resolveDiagnosticsForAlias(identity, alias, requestedBy) {
  if (alias.status !== "active") return { matchedCount: 0, modifiedCount: 0 };
  const now = new Date();
  const result = await PokemonIdentityDiagnostic.updateMany(
    {
      provider: providerStorageFilter(alias.provider),
      normalizedAlias: alias.normalizedValue,
      status: "open",
    },
    {
      $set: {
        status: "resolved",
        resolvedIdentityId: identity._id,
        resolvedAt: now,
        resolvedBy: actor(requestedBy),
      },
    },
  );
  return {
    matchedCount: Number(result.matchedCount || 0),
    modifiedCount: Number(result.modifiedCount || 0),
  };
}

async function addAlias(identifier, payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(aliasInputSchema, payload);
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const alias = prepareAlias(input, user);
  await assertAliasesAvailable([alias], identity._id);
  const existing = identity.aliases.find((entry) => (
    normalizeProvider(entry.provider) === alias.provider
    && normalizeAlias(entry.normalizedValue || entry.value) === alias.normalizedValue
  ));
  if (existing?.status === alias.status) {
    await resolveDiagnosticsForAlias(identity, alias, user);
    invalidateIdentityCache();
    return serialize(identity);
  }
  if (existing) {
    const before = serialize(identity);
    for (const field of ["provider", "value", "normalizedValue", "status", "confidence", "source", "reason", "firstDetectedAt", "lastDetectedAt", "occurrences", "updatedAt", "updatedBy"]) {
      if (alias[field] !== undefined) existing[field] = alias[field];
    }
    identity.updatedBy = user;
    try {
      await identity.save();
      await history(identity, "alias-update", user, { before, provider: alias.provider, alias: alias.value, reason: alias.reason });
      await resolveDiagnosticsForAlias(identity, alias, user);
      invalidateIdentityCache();
      return serialize(identity);
    } catch (error) {
      mongoConflict(error);
    }
  }
  identity.aliases.push(alias);
  identity.updatedBy = user;
  try {
    await identity.save();
    await history(identity, "alias-add", user, { provider: alias.provider, alias: alias.value, reason: alias.reason });
    await resolveDiagnosticsForAlias(identity, alias, user);
    invalidateIdentityCache();
    return serialize(identity);
  } catch (error) {
    mongoConflict(error);
  }
}

async function updateAlias(identifier, aliasId, payload, requestedBy) {
  const user = actor(requestedBy);
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const alias = identity.aliases.find((entry) => entry.aliasId === aliasId);
  if (!alias) throw new ApiError(404, "Alias introuvable.", "IDENTITY_ALIAS_NOT_FOUND");
  const before = serialize(identity);
  const parsed = parse(aliasInputSchema.partial(), payload);
  if (parsed.provider !== undefined) alias.provider = assertRegisteredProvider(parsed.provider);
  if (parsed.value !== undefined) {
    alias.value = parsed.value;
    alias.normalizedValue = normalizeAlias(parsed.value);
  }
  for (const field of ["status", "confidence", "source", "reason", "occurrences", "firstDetectedAt", "lastDetectedAt"]) {
    if (parsed[field] !== undefined) alias[field] = parsed[field];
  }
  alias.updatedAt = new Date();
  alias.updatedBy = user;
  await assertAliasesAvailable([{ ...alias.toObject() }], identity._id);
  identity.updatedBy = user;
  try {
    await identity.save();
    const action = alias.status === "deprecated" ? "alias-deprecate" : "alias-update";
    await history(identity, action, user, { before, provider: alias.provider, alias: alias.value, reason: alias.reason });
    invalidateIdentityCache();
    return serialize(identity);
  } catch (error) {
    mongoConflict(error);
  }
}

async function deprecateIdentity(identifier, reason, requestedBy) {
  const user = actor(requestedBy);
  if (!String(reason || "").trim()) throw new ApiError(422, "Un motif est requis pour déprécier une identité.", "IDENTITY_REASON_REQUIRED");
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const before = serialize(identity);
  identity.status = "deprecated";
  identity.deprecatedAt = new Date();
  identity.deprecatedBy = user;
  identity.deprecationReason = String(reason).trim();
  identity.updatedBy = user;
  await identity.save();
  await history(identity, "deprecate", user, { before, reason });
  invalidateIdentityCache();
  return serialize(identity);
}

async function restoreIdentity(identifier, requestedBy) {
  const user = actor(requestedBy);
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const before = serialize(identity);
  const local = await validateLocalIdentityReference({
    canonicalId: identity.canonicalId,
    pokemonId: identity.pokemonId,
    form: identity.form,
    costume: identity.costume,
    transformation: identity.transformation,
    status: "active",
  });
  await assertAliasesAvailable(identity.aliases.filter((entry) => entry.status === "active").map((entry) => entry.toObject()), identity._id);
  identity.status = "active";
  Object.assign(identity, synchronizedLocalFields(local));
  identity.deprecatedAt = null;
  identity.deprecatedBy = null;
  identity.deprecationReason = null;
  identity.updatedBy = user;
  await identity.save();
  await history(identity, "restore", user, { before });
  invalidateIdentityCache();
  return serialize(identity);
}

async function mergeIdentities(sourceId, targetId, reason, requestedBy) {
  const user = actor(requestedBy);
  if (!/^[a-f\d]{24}$/i.test(String(sourceId)) || !/^[a-f\d]{24}$/i.test(String(targetId))) throw new ApiError(422, "Les identifiants source et cible de fusion sont invalides.", "IDENTITY_MERGE_INVALID");
  if (sourceId === targetId) throw new ApiError(422, "Une identité ne peut pas être fusionnée avec elle-même.", "IDENTITY_MERGE_SELF");
  const [source, target] = await Promise.all([PokemonIdentity.findById(sourceId), PokemonIdentity.findById(targetId)]);
  if (!source || !target) throw new ApiError(404, "Identité source ou cible introuvable.", "IDENTITY_NOT_FOUND");
  const existing = new Set(target.aliases.map((entry) => `${entry.provider}:${entry.normalizedValue}`));
  const additions = source.aliases.filter((entry) => !existing.has(`${entry.provider}:${entry.normalizedValue}`)).map((entry) => ({ ...entry.toObject(), aliasId: crypto.randomUUID(), updatedAt: new Date(), updatedBy: user }));
  await assertAliasesAvailable(additions, [target._id, source._id]);
  const targetBefore = serialize(target);
  const sourceBefore = serialize(source);
  target.aliases.push(...additions);
  target.updatedBy = user;
  source.status = "deprecated";
  source.deprecatedAt = new Date();
  source.deprecatedBy = user;
  source.deprecationReason = `Fusionnée dans ${target.canonicalId}${reason ? ` : ${reason}` : ""}`;
  source.aliases.forEach((entry) => { if (entry.status === "active") entry.status = "deprecated"; });
  source.updatedBy = user;
  await target.save();
  await source.save();
  await Promise.all([
    history(target, "merge", user, { before: targetBefore, reason: `Fusion depuis ${source.canonicalId}${reason ? ` : ${reason}` : ""}` }),
    history(source, "merge", user, { before: sourceBefore, reason: source.deprecationReason }),
  ]);
  invalidateIdentityCache();
  return { source: serialize(source), target: serialize(target) };
}

async function listHistory(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const filter = {};
  if (query.identityId) filter.identityId = query.identityId;
  if (query.canonicalId) filter.canonicalId = normalizeCanonicalId(query.canonicalId);
  if (query.action) filter.action = String(query.action);
  if (query.provider) filter.provider = providerStorageFilter(query.provider);
  const [items, total] = await Promise.all([
    PokemonIdentityHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PokemonIdentityHistory.countDocuments(filter),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function conflicts() {
  const [aliasConflicts, explicitConflicts, incomplete] = await Promise.all([
    PokemonIdentity.aggregate([
      { $unwind: "$aliases" },
      { $match: { "aliases.status": "active" } },
      { $group: { _id: { provider: "$aliases.provider", value: "$aliases.normalizedValue" }, identities: { $addToSet: "$canonicalId" }, count: { $sum: 1 } } },
      { $match: { "identities.1": { $exists: true } } },
    ]),
    PokemonIdentity.countDocuments({ "aliases.status": "conflict" }),
    PokemonIdentity.countDocuments({ status: "active", aliases: { $not: { $elemMatch: { provider: "game-master", status: "active" } } } }),
  ]);
  return { aliasConflicts, explicitConflicts, incomplete };
}

function identityCatalogEntries(identities, allowedProviders = null) {
  return identities.map((identity) => ({
    identityId: String(identity._id),
    canonicalId: identity.canonicalId,
    pokemonId: identity.pokemonId,
    form: identity.form || null,
    costume: identity.costume || null,
    transformation: identity.transformation || null,
    status: identity.status,
    genderVariants: identity.genderVariants || { male: false, female: false },
    localReference: identity.localReference || null,
    localIdentity: identity.localIdentity || null,
    aliases: (identity.aliases || [])
      .filter((entry) => !allowedProviders || (
        allowedProviders.has(entry.provider)
        && ["active", "deprecated"].includes(entry.status)
      ))
      .map((entry) => ({
        aliasId: entry.aliasId,
        provider: entry.provider,
        rawAlias: entry.value,
        normalizedAlias: entry.normalizedValue,
        status: entry.status,
        confidence: entry.confidence,
      })),
  }));
}

async function aliasCatalog(force = false) {
  if (!force && cache.aliases && cache.expiresAt > Date.now()) return cache.aliases;
  const identities = await PokemonIdentity.find({ status: { $in: ["active", "deprecated"] }, syncStatus: "synchronized" }).select({ canonicalId: 1, pokemonId: 1, form: 1, costume: 1, transformation: 1, status: 1, aliases: 1, genderVariants: 1, localReference: 1, localIdentity: 1 }).lean();
  const catalog = identityCatalogEntries(identities);
  cache.aliases = catalog;
  cache.expiresAt = Date.now() + CACHE_TTL_MS;
  return catalog;
}

async function aliasCatalogForProviders(providers, force = false) {
  const allowedProviders = new Set((providers || []).map((provider) => String(provider || "").trim()).filter(Boolean));
  if (!allowedProviders.size) return [];
  const cacheKey = [...allowedProviders].sort().join("|");
  const cached = cache.providerAliases.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.catalog;
  const identities = await PokemonIdentity.find({
    status: { $in: ["active", "deprecated"] },
    syncStatus: "synchronized",
    aliases: {
      $elemMatch: {
        provider: { $in: [...allowedProviders] },
        status: { $in: ["active", "deprecated"] },
      },
    },
  }).select({ canonicalId: 1, pokemonId: 1, form: 1, costume: 1, transformation: 1, status: 1, aliases: 1, genderVariants: 1, localReference: 1, localIdentity: 1 }).lean();
  const catalog = identityCatalogEntries(identities, allowedProviders);
  cache.providerAliases.set(cacheKey, { catalog, expiresAt: Date.now() + CACHE_TTL_MS });
  return catalog;
}

function resolveAliasAgainstCatalog(payload = {}, catalog = []) {
  const provider = assertRegisteredProvider(payload.provider);
  const rawAlias = String(payload.rawAlias || payload.alias || "").trim();
  const normalizedAlias = normalizeAlias(rawAlias);
  if (!provider || !rawAlias) throw new ApiError(422, "Provider et alias sont requis.", "IDENTITY_RESOLVE_INVALID");
  const matches = [];
  for (const identity of catalog) {
    for (const alias of identity.aliases) {
      if (alias.provider !== provider) continue;
      let order = null;
      let strategy = null;
      if (alias.rawAlias === rawAlias && alias.status === "active") { order = 1; strategy = "provider-exact"; }
      else if (alias.normalizedAlias === normalizedAlias && alias.status === "active") { order = 2; strategy = "provider-normalized"; }
      else if (alias.normalizedAlias === normalizedAlias && alias.status === "deprecated") { order = 3; strategy = "known-deprecated-alias"; }
      if (order) matches.push({ identity, alias, order, strategy });
    }
  }
  matches.sort((left, right) => left.order - right.order);
  const bestOrder = matches[0]?.order;
  const best = matches.filter((entry) => entry.order === bestOrder);
  if (best.length === 1) {
    const selectedAsset = selectGenderAsset(best[0].identity.localIdentity, payload.isFemale);
    return { status: "matched", strategy: best[0].strategy, confidence: best[0].alias.confidence, identity: best[0].identity, alias: best[0].alias, selectedAsset };
  }
  if (best.length > 1) {
    return { status: "ambiguous", strategy: best[0].strategy, confidence: Math.min(...best.map((entry) => entry.alias.confidence)), reason: "MULTIPLE_FUNCTIONAL_IDENTITIES", reasonDetails: "Plusieurs identités fonctionnelles distinctes portent le même alias fournisseur.", candidates: best.map((entry) => entry.identity) };
  }
  const deterministic = findDeterministicLocalCandidates({ ...payload, rawAlias, normalizedAlias });
  if (deterministic.length === 1) {
    const identity = catalog.find((entry) => entry.canonicalId === deterministic[0].canonicalId && entry.status === "active");
    if (identity) {
      return {
        status: "matched",
        strategy: "local-deterministic-unique",
        confidence: 1,
        identity,
        alias: null,
        selectedAsset: selectGenderAsset(identity.localIdentity, payload.isFemale),
      };
    }
    return {
      status: "unmatched",
      strategy: "local-identity-not-synchronized",
      confidence: 1,
      reason: "CANONICAL_ID_NOT_SYNCHRONIZED",
      reasonDetails: `L'identité locale ${deterministic[0].canonicalId} existe mais n'est pas active dans Identity Manager.`,
      candidates: deterministic,
    };
  }
  if (deterministic.length > 1) {
    return { status: "ambiguous", strategy: "local-deterministic", confidence: 1, reason: "MULTIPLE_FUNCTIONAL_IDENTITIES", reasonDetails: "Plusieurs formes, costumes ou transformations locales distinctes restent possibles.", candidates: deterministic };
  }
  const suggestions = catalog
    .filter((identity) => identity.aliases.some((alias) => alias.provider === provider && (alias.normalizedAlias.includes(normalizedAlias) || normalizedAlias.includes(alias.normalizedAlias))))
    .slice(0, 10);
  return { status: "unmatched", strategy: suggestions.length === 1 ? "confidence-suggestion" : "none", confidence: suggestions.length === 1 ? 0.65 : 0, reason: "ALIAS_UNKNOWN", reasonDetails: `Aucun alias ${provider}:${normalizedAlias} ni aucune identité locale déterministe ne correspond.`, candidates: suggestions };
}

async function resolveAlias(payload = {}) {
  return resolveAliasAgainstCatalog(payload, await aliasCatalog());
}

async function resolveAliasesBatch(payloads = []) {
  if (!Array.isArray(payloads)) {
    throw new ApiError(422, "La liste d'alias est invalide.", "IDENTITY_RESOLVE_BATCH_INVALID");
  }
  const catalog = await aliasCatalog();
  return payloads.map((payload) => resolveAliasAgainstCatalog(payload, catalog));
}

async function listDiagnostics(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const filter = {};
  if (query.provider) filter.provider = providerStorageFilter(query.provider);
  for (const field of ["reason", "status"]) if (query[field]) filter[field] = String(query[field]);
  for (const field of ["pokemonId", "form", "costume"]) if (query[field]) filter[field] = field === "pokemonId" ? Number(query[field]) : { $regex: String(query[field]), $options: "i" };
  if (query.confidence) filter.confidence = { $gte: Number(query.confidence) };
  const [items, total] = await Promise.all([
    PokemonIdentityDiagnostic.find(filter).sort({ lastDetectedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PokemonIdentityDiagnostic.countDocuments(filter),
  ]);
  return { items: items.map(serialize), pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function recordDiagnostic(payload = {}) {
  const input = parse(diagnosticInputSchema, payload, "IDENTITY_DIAGNOSTIC_INVALID");
  const provider = assertRegisteredProvider(input.provider);
  const rawAlias = String(input.rawAlias || input.sourceId || "").trim();
  const normalizedAlias = normalizeAlias(rawAlias);
  const sourceId = String(input.sourceId || rawAlias).trim();
  const diagnosticKey = `${provider}:${normalizedAlias}:${normalizeAlias(sourceId)}`;
  return PokemonIdentityDiagnostic.findOneAndUpdate(
    { diagnosticKey },
    {
      $set: {
        provider,
        sourceId,
        rawAlias,
        normalizedAlias,
        pokemonId: input.pokemonId || null,
        pokemon: input.pokemon || null,
        form: input.form || null,
        costume: input.costume || null,
        reason: input.reason,
        confidence: input.confidence,
        candidates: input.candidates,
        proposedAction: input.proposedAction,
        lastDetectedAt: new Date(),
        sourcePayload: input.sourcePayload || payload,
      },
      $setOnInsert: { firstDetectedAt: new Date(), status: "open" },
      $inc: { occurrences: 1 },
    },
    { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: false },
  ).lean();
}

async function recordDiagnosticsBatch(entries = []) {
  const now = new Date();
  const operations = entries.filter(Boolean).map((payload) => {
    const provider = assertRegisteredProvider(payload.provider || payload.source);
    const rawAlias = String(payload.rawAlias || payload.sourceForm || payload.sourceCostume || payload.sourceId || "unknown").trim();
    const normalizedAlias = normalizeAlias(payload.normalizedAlias || rawAlias);
    const sourceId = String(payload.sourceId || rawAlias).trim();
    const diagnosticKey = `${provider}:${normalizedAlias}:${normalizeAlias(sourceId)}`;
    return {
      updateOne: {
        filter: { diagnosticKey },
        update: {
          $set: {
            provider,
            sourceId,
            rawAlias,
            normalizedAlias,
            pokemonId: payload.pokemonId || null,
            pokemon: payload.sourceName || payload.pokemon || null,
            form: payload.sourceForm || payload.form || null,
            costume: payload.sourceCostume || payload.costume || null,
            reason: payload.reason || "ALIAS_UNKNOWN",
            confidence: payload.confidence || 0,
            candidates: payload.candidates || payload.ambiguousCandidates || [],
            proposedAction: payload.proposedAction || "associate",
            lastDetectedAt: now,
            sourcePayload: payload,
            occurrences: Number(payload.occurrences) || 1,
          },
          $setOnInsert: { firstDetectedAt: now, status: "open" },
        },
        upsert: true,
      },
    };
  });
  if (!operations.length) return { detected: 0, upserted: 0, modified: 0 };
  const result = await PokemonIdentityDiagnostic.bulkWrite(operations, { ordered: false });
  return { detected: operations.length, upserted: result.upsertedCount || 0, modified: result.modifiedCount || 0 };
}

async function updateDiagnostic(identifier, payload, requestedBy) {
  const user = actor(requestedBy);
  const status = parse(z.object({ status: z.enum(diagnosticStatuses) }), payload, "IDENTITY_DIAGNOSTIC_INVALID").status;
  const update = { status };
  if (status === "resolved") Object.assign(update, { resolvedIdentityId: payload.identityId || null, resolvedAt: new Date(), resolvedBy: user });
  const document = await PokemonIdentityDiagnostic.findByIdAndUpdate(identifier, { $set: update }, { returnDocument: "after", runValidators: true }).lean();
  if (!document) throw new ApiError(404, "Diagnostic introuvable.", "IDENTITY_DIAGNOSTIC_NOT_FOUND");
  return serialize(document);
}

async function importIdentities(payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(importSchema, payload, "IDENTITY_IMPORT_INVALID");
  for (const identity of input.identities) {
    for (const alias of identity.aliases) assertRegisteredProvider(alias.provider);
  }
  const seenCanonical = new Set();
  const seenAliases = new Map();
  const report = { mode: input.mode, total: input.identities.length, create: 0, update: 0, duplicates: [], conflicts: [], invalid: [] };
  const existingCanonicalIds = new Set((await PokemonIdentity.find({
    canonicalId: { $in: input.identities.map((identity) => identity.canonicalId) },
  }).select({ canonicalId: 1 }).lean()).map((identity) => identity.canonicalId));
  for (const identity of input.identities) {
    if (seenCanonical.has(identity.canonicalId)) report.duplicates.push({ type: "canonicalId", value: identity.canonicalId });
    seenCanonical.add(identity.canonicalId);
    for (const alias of identity.aliases) {
      const key = `${normalizeProvider(alias.provider)}:${normalizeAlias(alias.value)}`;
      if (seenAliases.has(key) && seenAliases.get(key) !== identity.canonicalId) report.conflicts.push({ key, canonicalIds: [seenAliases.get(key), identity.canonicalId] });
      seenAliases.set(key, identity.canonicalId);
    }
    if (existingCanonicalIds.has(identity.canonicalId)) report.update += 1; else report.create += 1;
  }
  if (report.duplicates.length || report.conflicts.length || input.mode === "preview") return report;
  for (const identity of input.identities) {
    const existing = await PokemonIdentity.findOne({ canonicalId: identity.canonicalId });
    if (!existing) await createIdentity({ ...identity, aliases: identity.aliases.map((entry) => ({ ...entry, source: "import" })) }, user);
    else {
      for (const alias of identity.aliases) {
        const normalized = normalizeAlias(alias.value);
        if (!existing.aliases.some((entry) => entry.provider === normalizeProvider(alias.provider) && entry.normalizedValue === normalized)) {
          await addAlias(existing._id, { ...alias, source: "import" }, user);
        }
      }
    }
  }
  return report;
}

module.exports = {
  aliasCatalog,
  aliasCatalogForProviders,
  aliasInputSchema,
  assertRegisteredProvider,
  conflicts,
  createIdentity,
  deprecateIdentity,
  getIdentity,
  identityInputSchema,
  importIdentities,
  invalidateIdentityCache,
  listFilter,
  listDiagnostics,
  listHistory,
  listIdentities,
  listProviders,
  mergeIdentities,
  normalizeAlias,
  normalizeCanonicalId,
  normalizeProvider,
  providerCatalog,
  recordDiagnostic,
  recordDiagnosticsBatch,
  resolveDiagnosticsForAlias,
  resolveAlias,
  resolveAliasesBatch,
  restoreIdentity,
  serialize,
  updateAlias,
  updateDiagnostic,
  updateIdentity,
  addAlias,
};
