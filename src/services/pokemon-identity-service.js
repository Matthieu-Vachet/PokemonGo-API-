const crypto = require("crypto");
const { z } = require("zod");
const { ApiError } = require("../lib/api-error");
const {
  Pokemon,
  PokemonAsset,
  PokemonIdentity,
  PokemonIdentityDiagnostic,
  PokemonIdentityHistory,
} = require("../models");

const identityStatuses = ["active", "draft", "deprecated", "ignored"];
const aliasStatuses = ["active", "deprecated", "ignored", "conflict"];
const aliasSources = ["manual", "migration", "detected", "rule", "import"];
const diagnosticStatuses = ["open", "resolved", "ignored", "false-positive"];

function normalizeProvider(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  reason: z.enum(["unknown-alias", "unknown-pokemon", "unknown-form", "unknown-costume", "missing-canonical-id", "duplicate", "conflict", "multiple-candidates", "ambiguous-gender", "deprecated-identity", "ignored-alias", "incomplete-source", "missing-local-match"]).default("unknown-alias"),
  confidence: z.coerce.number().min(0).max(1).default(0),
  candidates: z.array(z.unknown()).default([]),
  proposedAction: z.string().trim().default("associate"),
  sourcePayload: z.unknown().optional(),
});

const cache = { expiresAt: 0, aliases: null };
const CACHE_TTL_MS = 30_000;

function invalidateIdentityCache() {
  cache.expiresAt = 0;
  cache.aliases = null;
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
  const value = typeof document.toObject === "function" ? document.toObject({ versionKey: false }) : structuredClone(document);
  if (value._id) value.id = String(value._id);
  delete value.activeAliasKeys;
  return value;
}

function mongoConflict(error) {
  if (error?.code !== 11000) throw error;
  const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "alias";
  throw new ApiError(409, `Conflit d'intégrité Identity Manager sur ${field}.`, "IDENTITY_CONFLICT", error.keyValue || null);
}

async function validateLocalIdentityReference(input) {
  if (input.status === "draft") return;
  const pokemon = await Pokemon.findOne({ dexNr: input.pokemonId }).select({ key: 1, formId: 1, form: 1, id: 1 }).lean();
  if (!pokemon) {
    throw new ApiError(422, `Le Pokémon #${input.pokemonId} n'existe pas dans PokemonGo-Data. Utilisez le statut draft pour préparer cette identité.`, "IDENTITY_LOCAL_POKEMON_MISSING");
  }
  if (input.form) {
    const token = normalizeAlias(input.form);
    const formMatch = await Pokemon.findOne({
      dexNr: input.pokemonId,
      $or: [
        { formId: { $regex: token.replace(/_/g, ".*"), $options: "i" } },
        { form: { $regex: `^${token}$`, $options: "i" } },
      ],
    }).select({ _id: 1 }).lean();
    if (!formMatch && !input.costume) {
      throw new ApiError(422, `La forme ${input.form} n'existe pas pour le Pokémon #${input.pokemonId}.`, "IDENTITY_LOCAL_FORM_MISSING");
    }
  }
  if (input.costume) {
    const asset = await PokemonAsset.findOne({ dexNr: input.pokemonId }).select({ assets: 1, data: 1 }).lean();
    const text = JSON.stringify(asset?.assets || asset?.data?.assets || {}).toLowerCase();
    if (!text.includes(normalizeAlias(input.costume).replace(/_/g, "")) && !text.includes(normalizeAlias(input.costume))) {
      throw new ApiError(422, `Le costume ${input.costume} n'existe pas dans les assets locaux du Pokémon #${input.pokemonId}.`, "IDENTITY_LOCAL_COSTUME_MISSING");
    }
  }
}

function prepareAlias(input, user) {
  const now = new Date();
  return {
    ...input,
    aliasId: input.aliasId || crypto.randomUUID(),
    provider: normalizeProvider(input.provider),
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
  await validateLocalIdentityReference(input);
  const aliases = input.aliases.map((entry) => prepareAlias(entry, user));
  await assertAliasesAvailable(aliases);
  try {
    const identity = await PokemonIdentity.create({ ...input, aliases, createdBy: user, updatedBy: user });
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
  if (query.provider) filter["aliases.provider"] = normalizeProvider(query.provider);
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
      { "aliases.value": { $regex: escaped, $options: "i" } },
      { "aliases.normalizedValue": { $regex: escaped, $options: "i" } },
    ];
  }
  return filter;
}

async function listIdentities(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const sortField = ["canonicalId", "pokemonId", "updatedAt", "status"].includes(query.sort) ? query.sort : "updatedAt";
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
      providers: providerStats.map((entry) => ({ provider: entry._id, count: entry.count })),
      statuses: Object.fromEntries(statusStats.map((entry) => [entry._id, entry.count])),
    },
  };
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
    status: input.status ?? identity.status,
  };
  await validateLocalIdentityReference(localCandidate);
  for (const field of ["canonicalId", "pokemonId", "form", "costume", "status", "genderVariants", "localReference", "metadata"]) {
    if (input[field] !== undefined) identity[field] = input[field];
  }
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

async function addAlias(identifier, payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(aliasInputSchema, payload);
  const identity = await PokemonIdentity.findById(identifier);
  if (!identity) throw new ApiError(404, "Identité canonique introuvable.", "IDENTITY_NOT_FOUND");
  const alias = prepareAlias(input, user);
  await assertAliasesAvailable([alias], identity._id);
  identity.aliases.push(alias);
  identity.updatedBy = user;
  try {
    await identity.save();
    await history(identity, "alias-add", user, { provider: alias.provider, alias: alias.value, reason: alias.reason });
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
  if (parsed.provider !== undefined) alias.provider = normalizeProvider(parsed.provider);
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
  await assertAliasesAvailable(identity.aliases.filter((entry) => entry.status === "active").map((entry) => entry.toObject()), identity._id);
  identity.status = "active";
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
  if (query.provider) filter.provider = normalizeProvider(query.provider);
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

async function aliasCatalog(force = false) {
  if (!force && cache.aliases && cache.expiresAt > Date.now()) return cache.aliases;
  const identities = await PokemonIdentity.find({ status: { $in: ["active", "deprecated"] } }).select({ canonicalId: 1, pokemonId: 1, form: 1, costume: 1, status: 1, aliases: 1, genderVariants: 1, localReference: 1 }).lean();
  const catalog = identities.map((identity) => ({
    identityId: String(identity._id),
    canonicalId: identity.canonicalId,
    pokemonId: identity.pokemonId,
    form: identity.form || null,
    costume: identity.costume || null,
    status: identity.status,
    genderVariants: identity.genderVariants || { male: false, female: false },
    localReference: identity.localReference || null,
    aliases: (identity.aliases || []).map((entry) => ({
      aliasId: entry.aliasId,
      provider: entry.provider,
      rawAlias: entry.value,
      normalizedAlias: entry.normalizedValue,
      status: entry.status,
      confidence: entry.confidence,
    })),
  }));
  cache.aliases = catalog;
  cache.expiresAt = Date.now() + CACHE_TTL_MS;
  return catalog;
}

async function resolveAlias(payload = {}) {
  const provider = normalizeProvider(payload.provider);
  const rawAlias = String(payload.rawAlias || payload.alias || "").trim();
  const normalizedAlias = normalizeAlias(rawAlias);
  if (!provider || !rawAlias) throw new ApiError(422, "Provider et alias sont requis.", "IDENTITY_RESOLVE_INVALID");
  const catalog = await aliasCatalog();
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
    return { status: "matched", strategy: best[0].strategy, confidence: best[0].alias.confidence, identity: best[0].identity, alias: best[0].alias };
  }
  if (best.length > 1) {
    return { status: "ambiguous", strategy: best[0].strategy, confidence: Math.min(...best.map((entry) => entry.alias.confidence)), reason: "multiple-candidates", candidates: best.map((entry) => entry.identity) };
  }
  const suggestions = catalog
    .filter((identity) => identity.aliases.some((alias) => alias.provider === provider && (alias.normalizedAlias.includes(normalizedAlias) || normalizedAlias.includes(alias.normalizedAlias))))
    .slice(0, 10);
  return { status: "unmatched", strategy: suggestions.length === 1 ? "confidence-suggestion" : "none", confidence: suggestions.length === 1 ? 0.65 : 0, reason: "unknown-alias", candidates: suggestions };
}

async function listDiagnostics(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const filter = {};
  for (const field of ["provider", "reason", "status"]) if (query[field]) filter[field] = String(query[field]);
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
  const provider = normalizeProvider(input.provider);
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
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: false },
  ).lean();
}

async function recordDiagnosticsBatch(entries = []) {
  const now = new Date();
  const operations = entries.filter(Boolean).map((payload) => {
    const provider = normalizeProvider(payload.provider || payload.source || "unknown");
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
            reason: payload.reason || "unknown-alias",
            confidence: payload.confidence || 0,
            candidates: payload.candidates || payload.ambiguousCandidates || [],
            proposedAction: payload.proposedAction || "associate",
            lastDetectedAt: now,
            sourcePayload: payload,
          },
          $setOnInsert: { firstDetectedAt: now, status: "open", occurrences: 0 },
          $inc: { occurrences: Number(payload.occurrences) || 1 },
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
  const document = await PokemonIdentityDiagnostic.findByIdAndUpdate(identifier, { $set: update }, { new: true, runValidators: true }).lean();
  if (!document) throw new ApiError(404, "Diagnostic introuvable.", "IDENTITY_DIAGNOSTIC_NOT_FOUND");
  return serialize(document);
}

async function importIdentities(payload, requestedBy) {
  const user = actor(requestedBy);
  const input = parse(importSchema, payload, "IDENTITY_IMPORT_INVALID");
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
  aliasInputSchema,
  conflicts,
  createIdentity,
  deprecateIdentity,
  getIdentity,
  identityInputSchema,
  importIdentities,
  invalidateIdentityCache,
  listDiagnostics,
  listHistory,
  listIdentities,
  mergeIdentities,
  normalizeAlias,
  normalizeCanonicalId,
  normalizeProvider,
  recordDiagnostic,
  recordDiagnosticsBatch,
  resolveAlias,
  restoreIdentity,
  updateAlias,
  updateDiagnostic,
  updateIdentity,
  addAlias,
};
