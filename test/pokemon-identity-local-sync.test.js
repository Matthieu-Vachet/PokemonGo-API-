const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentity } = require("../src/models");
const identityService = require("../src/services/pokemon-identity-service");
const inventoryService = require("../src/services/pokemon-local-identity-inventory-service");
const syncService = require("../src/services/pokemon-identity-sync-service");

function mongoId(index) {
  return index.toString(16).padStart(24, "0");
}

test("l'API valide l'inventaire local exhaustif et expose Mewtwo Armored", () => {
  const inventory = inventoryService.loadLocalIdentityInventory({ force: true });
  assert.equal(inventory.stats.totalIdentities, inventory.identities.length);
  assert.ok(inventory.stats.totalIdentities > 1_900);
  const armored = inventory.indexes.byCanonicalId.get("MEWTWO_ARMORED");
  const normal = inventory.indexes.byCanonicalId.get("MEWTWO_NORMAL");
  assert.ok(armored);
  assert.ok(normal);
  assert.notEqual(armored.identityKey, normal.identityKey);
  assert.equal(armored.costume, "MEWTWO_ARMORED");
});

test("la synchronisation conserve les types canoniques de PokemonGo-Data", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const bulbasaur = inventory.indexes.byCanonicalId.get("BULBASAUR_NORMAL");
  assert.deepEqual(bulbasaur.types, ["GRASS", "POISON"]);
  const payload = syncService.localIdentityPayload(bulbasaur, inventory.metadata, new Date("2026-07-19T00:00:00.000Z"));
  assert.deepEqual(payload.types, ["GRASS", "POISON"]);
});

test("la liste filtre explicitement les états de synchronisation", () => {
  assert.deepEqual(identityService.listFilter({ syncStatus: "orphaned", status: "draft" }), {
    syncStatus: "orphaned",
    status: "draft",
  });
});

test("la recherche Identity Manager accepte le nom français de PokemonGo-Data", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const gimmighoul = inventory.indexes.byCanonicalId.get("GIMMIGHOUL_NORMAL");
  assert.equal(gimmighoul.pokemonName, "Mordudor");

  const filter = identityService.listFilter({ search: "Mordudor" });
  assert.deepEqual(filter.$or.find((clause) => clause["localIdentity.pokemonName"]), {
    "localIdentity.pokemonName": { $regex: "Mordudor", $options: "i" },
  });
});

test("le plan de synchronisation crée tout le catalogue puis devient idempotent", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const first = syncService.buildIdentitySyncPlan({ inventory, existingIdentities: [], validatedAt: "2026-07-18T00:00:00.000Z" });
  assert.equal(first.summary.create, inventory.stats.totalIdentities);
  assert.equal(first.summary.conflict, 0);
  const synchronized = first.creates.map((entry, index) => ({
    _id: mongoId(index + 1),
    ...entry.payload,
    createdBy: "test",
    updatedBy: "test",
  }));
  const second = syncService.buildIdentitySyncPlan({ inventory, existingIdentities: synchronized, validatedAt: "2026-07-19T00:00:00.000Z" });
  assert.deepEqual(second.summary, {
    create: 0,
    update: 0,
    unchanged: inventory.stats.totalIdentities,
    orphan: 0,
    conflict: 0,
    aliasesPreserved: 0,
  });
});

test("Sneasler et Gimmighoul séparent leur forme précise du document NORMAL historique", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const canonicalIds = ["SNEASLER_HISUIAN", "SNEASLER_NORMAL", "GIMMIGHOUL_CHEST", "GIMMIGHOUL_NORMAL"];
  const identities = canonicalIds.map((canonicalId) => {
    const identity = inventory.indexes.byCanonicalId.get(canonicalId);
    assert.ok(identity, `${canonicalId} doit exister dans PokemonGo-Data`);
    return identity;
  });
  const normalDocuments = ["SNEASLER_NORMAL", "GIMMIGHOUL_NORMAL"].map((canonicalId, index) => {
    const local = inventory.indexes.byCanonicalId.get(canonicalId);
    return {
      _id: mongoId(9000 + index),
      canonicalId,
      pokemonId: local.pokemonId,
      form: "normal",
      costume: null,
      transformation: null,
      status: "active",
      syncStatus: "synchronized",
      aliases: [{ provider: "legacy", value: canonicalId, status: "active" }],
      genderVariants: local.genderVariants,
      localReference: { key: local.identityKey, formId: local.formId, file: local.sourceFile },
      localIdentity: syncService.localIdentityPayload(local, inventory.metadata, new Date("2026-08-05T00:00:00.000Z")),
    };
  });
  const reducedInventory = { ...inventory, identities };

  const first = syncService.buildIdentitySyncPlan({
    inventory: reducedInventory,
    existingIdentities: normalDocuments,
    validatedAt: "2026-08-05T00:00:00.000Z",
  });
  assert.equal(first.summary.conflict, 0);
  assert.deepEqual(first.creates.map((entry) => entry.canonicalId).sort(), ["GIMMIGHOUL_CHEST", "SNEASLER_HISUIAN"]);
  assert.deepEqual(first.unchanged.map((entry) => entry.canonicalId).sort(), ["GIMMIGHOUL_NORMAL", "SNEASLER_NORMAL"]);
  assert.equal(first.summary.aliasesPreserved, 2);

  const afterFirstSync = [
    ...normalDocuments,
    ...first.creates.map((entry, index) => ({ _id: mongoId(9100 + index), ...entry.payload })),
  ];
  const second = syncService.buildIdentitySyncPlan({
    inventory: reducedInventory,
    existingIdentities: afterFirstSync,
    validatedAt: "2026-08-05T00:00:00.000Z",
  });
  assert.equal(second.summary.conflict, 0);
  assert.equal(second.summary.create, 0);
  assert.equal(second.summary.update, 0);
  assert.equal(second.summary.unchanged, 4);
});

test("Corsola normal, Galarian et SPRING_2026 réparent le modèle historique sans perdre les alias", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const identities = ["CORSOLA_NORMAL", "CORSOLA_GALARIAN", "CORSOLA_SPRING_2026"]
    .map((canonicalId) => inventory.indexes.byCanonicalId.get(canonicalId));
  assert.ok(identities.every(Boolean));
  assert.deepEqual(identities.map((identity) => identity.identityKey), [
    "222|CORSOLA|none|none",
    "222|CORSOLA_GALARIAN|none|none",
    "222|SPRING_2026|none|none",
  ]);

  const initial = syncService.buildIdentitySyncPlan({
    inventory: { ...inventory, identities },
    existingIdentities: [],
    validatedAt: "2026-08-09T00:00:00.000Z",
  });
  const documents = initial.creates.map((entry, index) => ({
    _id: mongoId(9250 + index),
    ...entry.payload,
  }));
  const spring = documents.find((document) => document.canonicalId === "CORSOLA_SPRING_2026");
  spring.form = null;
  spring.costume = "CORSOLA_SPRING_2026";
  spring.aliases = [
    { provider: "game-master", value: "corsola_spring_2026", status: "active" },
    { provider: "margxt", value: "corayon_de_galar_lunettes_de_soleil_roses", status: "active" },
  ];
  spring.localReference = {
    key: "222|none|SPRING_2026|none",
    formId: null,
    file: "pokemon-assets/galar/0222-corsola-galarian.assets.json",
    assetsRef: "pokemon-assets/galar/0222-corsola-galarian.assets.json",
  };
  spring.localIdentity = {
    ...spring.localIdentity,
    form: null,
    formId: null,
    costume: "CORSOLA_SPRING_2026",
    identityKey: "222|none|SPRING_2026|none",
    sourceFile: "pokemon-assets/galar/0222-corsola-galarian.assets.json",
    assetsRef: "pokemon-assets/galar/0222-corsola-galarian.assets.json",
  };

  const repaired = syncService.buildIdentitySyncPlan({
    inventory: { ...inventory, identities },
    existingIdentities: documents,
    validatedAt: "2026-08-09T00:00:00.000Z",
  });
  assert.deepEqual(repaired.summary, {
    create: 0,
    update: 1,
    unchanged: 2,
    orphan: 0,
    conflict: 0,
    aliasesPreserved: 2,
  });
  const update = repaired.updates[0];
  assert.equal(update.canonicalId, "CORSOLA_SPRING_2026");
  assert.equal(update.auditedRelink.previousIdentityKey, "222|none|SPRING_2026|none");
  assert.equal(update.payload.formId || update.payload.form, "CORSOLA_SPRING_2026");
  assert.equal(update.payload.costume, null);
  assert.equal(update.payload.localReference.key, "222|SPRING_2026|none|none");
  assert.equal(update.payload.localReference.file, "data/assets/core/galar/0222-corsola-galarian.assets.json");
  assert.equal(Object.hasOwn(update.payload, "aliases"), false);
  assert.deepEqual(update.before.aliases.map((alias) => alias.provider), ["game-master", "margxt"]);

  const synchronized = documents.map((document) => (
    document._id === update.identityId
      ? { ...document, ...update.payload, aliases: document.aliases }
      : document
  ));
  const idempotent = syncService.buildIdentitySyncPlan({
    inventory: { ...inventory, identities },
    existingIdentities: synchronized,
    validatedAt: "2026-08-10T00:00:00.000Z",
  });
  assert.equal(idempotent.summary.conflict, 0);
  assert.equal(idempotent.summary.update, 0);
  assert.equal(idempotent.summary.unchanged, 3);
});

test("une combinaison forme + costume Corsola reste distincte et ne déclenche aucun relink audité", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const spring = inventory.indexes.byCanonicalId.get("CORSOLA_SPRING_2026");
  const combined = {
    ...spring,
    canonicalId: "CORSOLA_GALARIAN_SPRING_2026",
    identityKey: "222|CORSOLA_GALARIAN|SPRING_2026|none",
    form: "CORSOLA_GALARIAN",
    formId: "CORSOLA_GALARIAN",
    costume: "SPRING_2026",
  };
  const oldDocument = {
    _id: mongoId(9299),
    canonicalId: combined.canonicalId,
    pokemonId: 222,
    form: null,
    costume: "SPRING_2026",
    status: "active",
    aliases: [{ provider: "game-master", value: "CORSOLA_SPRING_2026", status: "active" }],
    localReference: { key: "222|none|SPRING_2026|none", file: "legacy/corsola.json" },
  };
  const plan = syncService.buildIdentitySyncPlan({
    inventory: { ...inventory, identities: [combined] },
    existingIdentities: [oldDocument],
  });
  assert.equal(plan.summary.conflict, 1);
  assert.equal(plan.conflicts[0].code, "CANONICAL_ID_LOCAL_CONFLICT");
  assert.equal(plan.conflicts[0].resolution.automaticSelection, false);
  assert.equal(syncService.auditedCanonicalRelink(combined, oldDocument), null);
});

test("la forme NORMAL générique ne capture ni régionale, ni costume, ni Mewtwo Armored", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const candidates = ["SLOWPOKE_GALARIAN", "PIKACHU_ADVENTURE_HAT_2020", "MEWTWO_ARMORED"]
    .map((canonicalId) => inventory.indexes.byCanonicalId.get(canonicalId));
  assert.ok(candidates.every(Boolean));

  for (const [index, candidate] of candidates.entries()) {
    const oldNormalDocument = {
      _id: mongoId(9200 + index),
      canonicalId: `LEGACY_${candidate.pokemonId}_NORMAL`,
      pokemonId: candidate.pokemonId,
      form: "normal",
      costume: null,
      transformation: null,
      status: "draft",
      aliases: [],
    };
    const plan = syncService.buildIdentitySyncPlan({
      inventory: { ...inventory, identities: [candidate] },
      existingIdentities: [oldNormalDocument],
    });
    assert.deepEqual(plan.creates.map((entry) => entry.canonicalId), [candidate.canonicalId]);
    assert.equal(plan.summary.update, 0);
    assert.equal(plan.summary.conflict, 0);
    assert.equal(plan.summary.orphan, 1);
  }
});

test("Mewtwo Normal et Armored restent déterministes et idempotents", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const identities = ["MEWTWO_ARMORED", "MEWTWO_NORMAL"].map((canonicalId) => inventory.indexes.byCanonicalId.get(canonicalId));
  const first = syncService.buildIdentitySyncPlan({ inventory: { ...inventory, identities }, existingIdentities: [], validatedAt: "2026-08-05T00:00:00.000Z" });
  const documents = first.creates.map((entry, index) => ({ _id: mongoId(9300 + index), ...entry.payload }));
  const second = syncService.buildIdentitySyncPlan({ inventory: { ...inventory, identities }, existingIdentities: documents, validatedAt: "2026-08-05T00:00:00.000Z" });
  assert.equal(second.summary.conflict, 0);
  assert.equal(second.summary.unchanged, 2);
  assert.notEqual(identities[0].identityKey, identities[1].identityKey);
});

test("une vraie collision de forme reste bloquée avec candidats, fichiers et résolution non destructive", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const chest = inventory.indexes.byCanonicalId.get("GIMMIGHOUL_CHEST");
  const competing = {
    ...chest,
    canonicalId: "GIMMIGHOUL_CHEST_LEGACY_COLLISION",
    identityKey: `${chest.identityKey}|legacy-collision`,
    sourceFile: "pokemon-forms/normal/0999-gimmighoul-chest-legacy.json",
  };
  const mongoDocument = {
    _id: mongoId(9400),
    canonicalId: competing.canonicalId,
    pokemonId: chest.pokemonId,
    form: "CHEST",
    costume: null,
    transformation: null,
    status: "active",
    aliases: [{ provider: "game-master", value: "GIMMIGHOUL_CHEST", status: "active" }],
    localReference: { formId: chest.formId, file: "legacy/gimmighoul.json" },
  };
  const plan = syncService.buildIdentitySyncPlan({
    inventory: { ...inventory, identities: [chest, competing] },
    existingIdentities: [mongoDocument],
  });
  const conflict = plan.conflicts.find((entry) => entry.code === "EXISTING_IDENTITY_MULTIPLE_LOCAL_MATCHES");
  assert.ok(conflict);
  assert.equal(conflict.cause, "collision-forme-ou-normalisation-trop-large");
  assert.equal(conflict.localCandidate.sourceFile, competing.sourceFile);
  assert.equal(conflict.claimedBy.sourceFile, chest.sourceFile);
  assert.equal(conflict.existingIdentity.aliases[0].provider, "game-master");
  assert.equal(conflict.resolution.automaticSelection, false);
  assert.equal(conflict.resolution.automaticDeletion, false);
  assert.match(conflict.resolution.recommendation, /sans choisir ni supprimer automatiquement/i);
});

test("la synchronisation conserve les alias et marque sans suppression une identité orpheline", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const pikachu = inventory.indexes.byCanonicalId.get("PIKACHU_NORMAL");
  const existing = [{
    _id: mongoId(25),
    canonicalId: "PIKACHU_NORMAL",
    pokemonId: 25,
    form: "PIKACHU",
    costume: null,
    status: "active",
    aliases: [{ provider: "pvpoke", value: "pikachu", normalizedValue: "pikachu", status: "active" }],
  }, {
    _id: mongoId(9999),
    canonicalId: "INVENTED_VARIANT",
    pokemonId: 25,
    form: "INVENTED",
    costume: null,
    status: "active",
    aliases: [],
  }];
  const reducedInventory = { ...inventory, identities: [pikachu] };
  const plan = syncService.buildIdentitySyncPlan({ inventory: reducedInventory, existingIdentities: existing });
  assert.equal(plan.summary.update, 1);
  assert.equal(plan.summary.orphan, 1);
  assert.equal(plan.summary.aliasesPreserved, 1);
  assert.equal(plan.orphans[0].payload.status, "draft");
  assert.equal(plan.orphans[0].payload.syncStatus, "orphaned");
});

test("les canonical IDs officiels MALE/FEMALE restent distincts", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const female = inventory.indexes.byCanonicalId.get("NIDORAN_FEMALE");
  const male = inventory.indexes.byCanonicalId.get("NIDORAN_MALE");
  assert.equal(female.category, "official-gender");
  assert.equal(male.category, "official-gender");
  assert.notEqual(female.identityKey, male.identityKey);
});

test("un même costume mâle/femelle reste une identité et le sexe choisit seulement l'asset", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const costume = inventory.indexes.byCanonicalId.get("PIKACHU_ADVENTURE_HAT_2020");
  assert.equal(costume.genderVariants.male, true);
  assert.equal(costume.genderVariants.female, true);
  assert.equal(inventoryService.selectGenderAsset(costume, false).isFemale, false);
  assert.equal(inventoryService.selectGenderAsset(costume, true).isFemale, true);
  assert.equal(inventoryService.selectGenderAsset(costume).isFemale, false);
});

test("un costume uniquement mâle ne fabrique aucune ambiguïté ni asset femelle", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const costume = inventory.indexes.byCanonicalId.get("BULBASAUR_FALL_2019");
  assert.equal(costume.genderVariants.male, true);
  assert.equal(costume.genderVariants.female, false);
  assert.equal(inventoryService.selectGenderAsset(costume, false).isFemale, false);
  assert.equal(inventoryService.selectGenderAsset(costume, true), null);
});

test("le catalogue PvP charge uniquement les identités portant un alias PvPoke", async () => {
  const originalFind = PokemonIdentity.find;
  let query;
  PokemonIdentity.find = (receivedQuery) => {
    query = receivedQuery;
    return {
      select: () => ({
        lean: async () => [{
          _id: mongoId(25),
          canonicalId: "PIKACHU_NORMAL",
          pokemonId: 25,
          status: "active",
          syncStatus: "synchronized",
          aliases: [
            { aliasId: "pvp", provider: "pvpoke", value: "pikachu", normalizedValue: "pikachu", status: "active", confidence: 1 },
            { aliasId: "shiny", provider: "snacknap", value: "Pikachu", normalizedValue: "pikachu", status: "active", confidence: 1 },
          ],
        }],
      }),
    };
  };
  try {
    identityService.invalidateIdentityCache();
    const catalog = await identityService.aliasCatalogForProviders(["pvpoke", "pvpoke-official-repository"]);
    assert.deepEqual(query.aliases.$elemMatch.provider.$in, ["pvpoke", "pvpoke-official-repository"]);
    assert.deepEqual(catalog[0].aliases.map((alias) => alias.provider), ["pvpoke"]);
  } finally {
    PokemonIdentity.find = originalFind;
    identityService.invalidateIdentityCache();
  }
});

test("un resolver sans alias choisit Mewtwo Armored uniquement par identité locale déterministe", async () => {
  const originalFind = PokemonIdentity.find;
  const inventory = inventoryService.loadLocalIdentityInventory();
  const armored = inventory.indexes.byCanonicalId.get("MEWTWO_ARMORED");
  const normal = inventory.indexes.byCanonicalId.get("MEWTWO_NORMAL");
  const documents = [armored, normal].map((local, index) => ({
    _id: mongoId(index + 150),
    canonicalId: local.canonicalId,
    pokemonId: local.pokemonId,
    form: local.form,
    costume: local.costume,
    transformation: local.transformation,
    status: "active",
    syncStatus: "synchronized",
    aliases: [],
    genderVariants: local.genderVariants,
    localIdentity: syncService.localIdentityPayload(local, inventory.metadata, new Date("2026-07-18T00:00:00.000Z")),
  }));
  PokemonIdentity.find = () => ({ select: () => ({ lean: async () => documents }) });
  try {
    identityService.invalidateIdentityCache();
    const result = await identityService.resolveAlias({ provider: "pvpoke", rawAlias: "mewtwo_armored" });
    assert.equal(result.status, "matched");
    assert.equal(result.strategy, "local-deterministic-unique");
    assert.equal(result.identity.canonicalId, "MEWTWO_ARMORED");
    const unknown = await identityService.resolveAlias({ provider: "pvpoke", rawAlias: "mewtwo_unknown_variant" });
    assert.equal(unknown.status, "unmatched");
    assert.notEqual(unknown.identity?.canonicalId, "MEWTWO_NORMAL");
  } finally {
    PokemonIdentity.find = originalFind;
    identityService.invalidateIdentityCache();
  }
});

test("les noms PogoAPI et leurs qualificatifs régionaux résolvent une identité locale unique", async () => {
  const originalFind = PokemonIdentity.find;
  const inventory = inventoryService.loadLocalIdentityInventory();
  const canonicalIds = ["POPPLIO_NORMAL", "SLOWPOKE_GALARIAN", "WOOPER_PALDEA"];
  const documents = canonicalIds.map((canonicalId, index) => {
    const local = inventory.indexes.byCanonicalId.get(canonicalId);
    assert.ok(local, `${canonicalId} doit exister dans PokemonGo-Data`);
    return {
      _id: mongoId(index + 300),
      canonicalId: local.canonicalId,
      pokemonId: local.pokemonId,
      form: local.form,
      costume: local.costume,
      transformation: local.transformation,
      status: "active",
      syncStatus: "synchronized",
      aliases: [],
      genderVariants: local.genderVariants,
      localIdentity: syncService.localIdentityPayload(local, inventory.metadata, new Date("2026-07-19T00:00:00.000Z")),
    };
  });
  PokemonIdentity.find = () => ({ select: () => ({ lean: async () => documents }) });
  try {
    identityService.invalidateIdentityCache();
    const results = await Promise.all([
      identityService.resolveAlias({ provider: "pogoapi", rawAlias: "Popplio" }),
      identityService.resolveAlias({ provider: "pogoapi", rawAlias: "Galarian:::Slowpoke" }),
      identityService.resolveAlias({ provider: "pogoapi", rawAlias: "Paldean:::Wooper" }),
    ]);
    assert.deepEqual(results.map((result) => result.status), ["matched", "matched", "matched"]);
    assert.deepEqual(results.map((result) => result.strategy), ["local-deterministic-unique", "local-deterministic-unique", "local-deterministic-unique"]);
    assert.deepEqual(results.map((result) => result.identity.canonicalId), canonicalIds);
  } finally {
    PokemonIdentity.find = originalFind;
    identityService.invalidateIdentityCache();
  }
});

test("l'équivalence nominale ne contourne jamais un indice structuré contradictoire", () => {
  const candidates = inventoryService.findDeterministicLocalCandidates({
    rawAlias: "Galarian:::Slowpoke",
    form: "ALOLA",
  });
  assert.deepEqual(candidates, []);
});

test("le modèle refuse une identité active sans référence locale synchronisée", async () => {
  await assert.rejects(new PokemonIdentity({
    canonicalId: "PIKACHU_NORMAL",
    pokemonId: 25,
    status: "active",
    syncStatus: "draft",
    aliases: [],
  }).validate(), /PokemonGo-Data|synchronisée/i);
});
