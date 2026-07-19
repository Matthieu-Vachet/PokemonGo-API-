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
  assert.equal(inventory.stats.totalIdentities, 1911);
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

test("le plan de synchronisation crée tout le catalogue puis devient idempotent", () => {
  const inventory = inventoryService.loadLocalIdentityInventory();
  const first = syncService.buildIdentitySyncPlan({ inventory, existingIdentities: [], validatedAt: "2026-07-18T00:00:00.000Z" });
  assert.equal(first.summary.create, 1911);
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
    unchanged: 1911,
    orphan: 0,
    conflict: 0,
    aliasesPreserved: 0,
  });
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

test("le modèle refuse une identité active sans référence locale synchronisée", async () => {
  await assert.rejects(new PokemonIdentity({
    canonicalId: "PIKACHU_NORMAL",
    pokemonId: 25,
    status: "active",
    syncStatus: "draft",
    aliases: [],
  }).validate(), /PokemonGo-Data|synchronisée/i);
});
