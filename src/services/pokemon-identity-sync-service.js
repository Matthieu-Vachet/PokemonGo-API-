const crypto = require("node:crypto");
const { PokemonIdentity, PokemonIdentityHistory } = require("../models");
const { loadLocalIdentityInventory } = require("./pokemon-local-identity-inventory-service");

function normalized(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function serializable(value) {
  if (value == null) return value;
  const plain = typeof value.toObject === "function" ? value.toObject({ versionKey: false }) : value;
  // JSON conserve les ObjectId sous leur représentation hexadécimale, contrairement à structuredClone.
  return JSON.parse(JSON.stringify(plain));
}

function localIdentityPayload(identity, metadata, validatedAt) {
  return {
    pokemonKey: identity.pokemonKey,
    pokemonName: identity.pokemonName,
    types: identity.types,
    form: identity.form,
    formId: identity.formId,
    parentFormId: identity.parentFormId,
    costume: identity.costume,
    transformation: identity.transformation,
    category: identity.category,
    identityKey: identity.identityKey,
    sourceType: identity.sourceType,
    sourceFile: identity.sourceFile,
    pokemonSourceFile: identity.pokemonSourceFile,
    assetsRef: identity.assetsRef,
    assets: identity.assets,
    genderAssets: identity.genderAssets,
    localReferences: identity.localReferences,
    fingerprint: identity.fingerprint,
    inventoryFingerprint: metadata.fingerprint,
    schemaVersion: metadata.schemaVersion,
    lastValidatedAt: validatedAt,
    issues: identity.issues,
  };
}

function synchronizedPayload(identity, metadata, validatedAt) {
  return {
    canonicalId: identity.canonicalId,
    pokemonId: identity.pokemonId,
    form: identity.form,
    costume: identity.costume,
    transformation: identity.transformation,
    syncStatus: "synchronized",
    genderVariants: identity.genderVariants,
    localReference: {
      key: identity.identityKey,
      formId: identity.formId,
      file: identity.sourceFile,
      assetsRef: identity.assetsRef,
    },
    localIdentity: localIdentityPayload(identity, metadata, validatedAt),
  };
}

function sameSynchronizedData(existing, payload) {
  return existing.canonicalId === payload.canonicalId
    && existing.pokemonId === payload.pokemonId
    && (existing.form || null) === (payload.form || null)
    && (existing.costume || null) === (payload.costume || null)
    && (existing.transformation || null) === (payload.transformation || null)
    && existing.syncStatus === "synchronized"
    && existing.localIdentity?.identityKey === payload.localIdentity.identityKey
    && existing.localIdentity?.fingerprint === payload.localIdentity.fingerprint
    && existing.localIdentity?.inventoryFingerprint === payload.localIdentity.inventoryFingerprint
    && existing.localIdentity?.schemaVersion === payload.localIdentity.schemaVersion
    && existing.genderVariants?.male === payload.genderVariants.male
    && existing.genderVariants?.female === payload.genderVariants.female;
}

function legacyIdentityKey(document) {
  return document.localIdentity?.identityKey || document.localReference?.key || null;
}

function candidateMatchesDocument(candidate, document) {
  if (Number(document.pokemonId) !== candidate.pokemonId) return false;
  if (document.canonicalId === candidate.canonicalId) return true;
  const documentCostume = normalized(document.costume);
  const documentForm = normalized(document.form);
  return Boolean(documentCostume || documentForm)
    && (!documentCostume || normalized(candidate.costume) === documentCostume)
    && (!documentForm || [candidate.form, candidate.formId].some((value) => normalized(value) === documentForm));
}

function buildIdentitySyncPlan({ inventory, existingIdentities, validatedAt = new Date().toISOString() }) {
  const existing = existingIdentities.map(serializable);
  const byCanonical = new Map(existing.map((identity) => [identity.canonicalId, identity]));
  const byIdentityKey = new Map(existing.filter((identity) => legacyIdentityKey(identity)).map((identity) => [legacyIdentityKey(identity), identity]));
  const byPokemonId = new Map();
  for (const identity of existing) {
    if (!byPokemonId.has(Number(identity.pokemonId))) byPokemonId.set(Number(identity.pokemonId), []);
    byPokemonId.get(Number(identity.pokemonId)).push(identity);
  }
  const matchedExistingIds = new Set();
  const creates = [];
  const updates = [];
  const unchanged = [];
  const conflicts = [];
  const seenCanonical = new Set();
  const seenIdentityKey = new Set();
  const date = new Date(validatedAt);

  for (const local of inventory.identities) {
    if (seenCanonical.has(local.canonicalId) || seenIdentityKey.has(local.identityKey)) {
      conflicts.push({
        code: "LOCAL_INVENTORY_DUPLICATE",
        canonicalId: local.canonicalId,
        identityKey: local.identityKey,
      });
      continue;
    }
    seenCanonical.add(local.canonicalId);
    seenIdentityKey.add(local.identityKey);
    let current = byIdentityKey.get(local.identityKey) || null;
    if (!current) {
      const canonicalMatch = byCanonical.get(local.canonicalId);
      if (canonicalMatch && candidateMatchesDocument(local, canonicalMatch)) current = canonicalMatch;
      else if (canonicalMatch) {
        conflicts.push({
          code: "CANONICAL_ID_LOCAL_CONFLICT",
          canonicalId: local.canonicalId,
          identityKey: local.identityKey,
          existingIdentityId: String(canonicalMatch._id || canonicalMatch.id),
          existingPokemonId: canonicalMatch.pokemonId,
        });
        continue;
      }
    }
    if (!current) {
      const safeLegacyMatches = (byPokemonId.get(local.pokemonId) || []).filter((identity) => (
        !matchedExistingIds.has(String(identity._id || identity.id))
        && candidateMatchesDocument(local, identity)
      ));
      if (safeLegacyMatches.length === 1) current = safeLegacyMatches[0];
      else if (safeLegacyMatches.length > 1) {
        conflicts.push({
          code: "LEGACY_IDENTITY_MULTIPLE_LOCAL_MATCHES",
          canonicalId: local.canonicalId,
          identityKey: local.identityKey,
          existingCanonicalIds: safeLegacyMatches.map((identity) => identity.canonicalId),
        });
        continue;
      }
    }
    const payload = synchronizedPayload(local, inventory.metadata, date);
    if (!current) {
      creates.push({
        canonicalId: local.canonicalId,
        payload: {
          ...payload,
          status: "active",
          aliases: [],
          activeAliasKeys: [],
          previousCanonicalIds: [],
          metadata: { notes: null, tags: ["local-inventory"], lastResolvedAt: null, lastUsedAt: null, usageCount: 0 },
        },
      });
      continue;
    }
    const currentId = String(current._id || current.id);
    if (matchedExistingIds.has(currentId)) {
      conflicts.push({
        code: "EXISTING_IDENTITY_MULTIPLE_LOCAL_MATCHES",
        canonicalId: local.canonicalId,
        identityKey: local.identityKey,
        existingIdentityId: currentId,
      });
      continue;
    }
    matchedExistingIds.add(currentId);
    const renamed = current.canonicalId !== local.canonicalId;
    const nextPayload = {
      ...payload,
      status: ["deprecated", "ignored"].includes(current.status) ? current.status : "active",
      previousCanonicalIds: renamed
        ? [...new Set([...(current.previousCanonicalIds || []), current.canonicalId])]
        : current.previousCanonicalIds || [],
    };
    if (sameSynchronizedData(current, nextPayload) && !renamed && current.status === nextPayload.status) {
      unchanged.push({ identityId: currentId, canonicalId: current.canonicalId });
    } else {
      updates.push({
        identityId: currentId,
        canonicalId: local.canonicalId,
        previousCanonicalId: renamed ? current.canonicalId : null,
        before: current,
        payload: nextPayload,
      });
    }
  }

  const orphans = existing
    .filter((identity) => !matchedExistingIds.has(String(identity._id || identity.id)))
    .map((identity) => ({
      identityId: String(identity._id || identity.id),
      canonicalId: identity.canonicalId,
      before: identity,
      payload: {
        syncStatus: "orphaned",
        status: identity.status === "active" ? "draft" : identity.status,
      },
    }));

  const aliasesPreserved = existing.reduce((sum, identity) => sum + (identity.aliases || []).length, 0);
  return {
    inventory: {
      schemaVersion: inventory.metadata.schemaVersion,
      fingerprint: inventory.metadata.fingerprint,
      total: inventory.identities.length,
      issues: inventory.issues.length,
    },
    before: { identities: existing.length, aliases: aliasesPreserved },
    after: { identities: existing.length + creates.length, aliases: aliasesPreserved },
    creates,
    updates,
    unchanged,
    orphans,
    conflicts,
    summary: {
      create: creates.length,
      update: updates.length,
      unchanged: unchanged.length,
      orphan: orphans.length,
      conflict: conflicts.length,
      aliasesPreserved,
    },
  };
}

async function previewIdentitySync({ forceInventory = false } = {}) {
  const [inventory, existingIdentities] = await Promise.all([
    Promise.resolve(loadLocalIdentityInventory({ force: forceInventory })),
    PokemonIdentity.find({}).select("+activeAliasKeys").lean(),
  ]);
  return buildIdentitySyncPlan({ inventory, existingIdentities });
}

function reportFromPlan(plan, mode) {
  const mewtwoArmored = plan.creates.find((entry) => entry.canonicalId === "MEWTWO_ARMORED")
    || plan.updates.find((entry) => entry.canonicalId === "MEWTWO_ARMORED")
    || plan.unchanged.find((entry) => entry.canonicalId === "MEWTWO_ARMORED");
  return {
    mode,
    inventory: plan.inventory,
    before: plan.before,
    after: plan.after,
    ...plan.summary,
    conflicts: plan.conflicts,
    mewtwoArmored: mewtwoArmored ? "present" : "missing",
  };
}

async function applyIdentitySync({ requestedBy = "sync:pokemon-identities", forceInventory = true } = {}) {
  const plan = await previewIdentitySync({ forceInventory });
  if (plan.conflicts.length) {
    const error = new Error("La synchronisation est bloquée par des conflits d'identité locale.");
    error.code = "IDENTITY_SYNC_CONFLICT";
    error.details = plan.conflicts;
    throw error;
  }
  // Remplace notamment l'ancien index sparse qui indexait les tableaux vides comme undefined.
  await PokemonIdentity.syncIndexes();
  const now = new Date();
  const operations = [];
  for (const entry of plan.creates) {
    operations.push({ insertOne: { document: { ...entry.payload, createdBy: requestedBy, updatedBy: requestedBy, createdAt: now, updatedAt: now } } });
  }
  for (const entry of plan.updates) {
    operations.push({ updateOne: { filter: { _id: entry.identityId }, update: { $set: { ...entry.payload, updatedBy: requestedBy, updatedAt: now } } } });
  }
  for (const entry of plan.orphans) {
    operations.push({ updateOne: { filter: { _id: entry.identityId }, update: { $set: { ...entry.payload, updatedBy: requestedBy, updatedAt: now } } } });
  }
  if (operations.length) await PokemonIdentity.bulkWrite(operations, { ordered: false });

  const affectedCanonicalIds = [...new Set([
    ...plan.creates.map((entry) => entry.canonicalId),
    ...plan.updates.map((entry) => entry.canonicalId),
    ...plan.orphans.map((entry) => entry.canonicalId),
  ])];
  const affected = affectedCanonicalIds.length
    ? await PokemonIdentity.find({ canonicalId: { $in: affectedCanonicalIds } }).lean()
    : [];
  const byCanonical = new Map(affected.map((identity) => [identity.canonicalId, identity]));
  const history = [];
  for (const entry of plan.creates) {
    const identity = byCanonical.get(entry.canonicalId);
    if (identity) history.push({ identityId: identity._id, canonicalId: identity.canonicalId, action: "sync-create", before: null, after: identity, user: requestedBy, reason: `Inventaire local ${plan.inventory.fingerprint}` });
  }
  for (const entry of plan.updates) {
    const identity = byCanonical.get(entry.canonicalId);
    if (identity) history.push({ identityId: identity._id, canonicalId: identity.canonicalId, action: entry.previousCanonicalId ? "sync-relink" : "sync-update", before: entry.before, after: identity, user: requestedBy, reason: `Inventaire local ${plan.inventory.fingerprint}` });
  }
  for (const entry of plan.orphans) {
    const identity = byCanonical.get(entry.canonicalId);
    if (identity) history.push({ identityId: identity._id, canonicalId: identity.canonicalId, action: "sync-orphan", before: entry.before, after: identity, user: requestedBy, reason: "Identité absente de l'inventaire PokemonGo-Data; conservation en brouillon orphelin." });
  }
  if (history.length) await PokemonIdentityHistory.insertMany(history, { ordered: false });
  return reportFromPlan(plan, "write");
}

function syncPlanDigest(plan) {
  return crypto.createHash("sha256").update(JSON.stringify({
    fingerprint: plan.inventory.fingerprint,
    creates: plan.creates.map((entry) => entry.canonicalId),
    updates: plan.updates.map((entry) => [entry.identityId, entry.canonicalId]),
    orphans: plan.orphans.map((entry) => entry.identityId),
    conflicts: plan.conflicts,
  })).digest("hex");
}

module.exports = {
  applyIdentitySync,
  buildIdentitySyncPlan,
  localIdentityPayload,
  previewIdentitySync,
  reportFromPlan,
  syncPlanDigest,
};
