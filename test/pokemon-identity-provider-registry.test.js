const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentity, PokemonIdentityDiagnostic, PokemonIdentityHistory } = require("../src/models");
const {
  addAlias,
  assertRegisteredProvider,
  listProviders,
  importIdentities,
  providerCatalog,
  recordDiagnosticsBatch,
} = require("../src/services/pokemon-identity-service");

test("l'ajout répétitif du même alias actif est idempotent", async () => {
  const originalFindById = PokemonIdentity.findById;
  const originalFindOne = PokemonIdentity.findOne;
  const originalHistoryCreate = PokemonIdentityHistory.create;
  const originalDiagnosticUpdateMany = PokemonIdentityDiagnostic.updateMany;
  let saves = 0;
  let histories = 0;
  let diagnosticsResolved = 0;
  const identity = {
    _id: "6a5b845a37c48578724ac21f",
    canonicalId: "EEVEE_GOFEST_2024_STIARA",
    aliases: [{
      aliasId: "8d827a24-5503-4b9e-8d7b-7503bc7f797b",
      provider: "game-master",
      value: "EEVEE_GOFEST_2024_STIARA",
      normalizedValue: "eevee_gofest_2024_stiara",
      status: "active",
      confidence: 1,
      source: "detected",
    }],
    save: async () => { saves += 1; },
  };
  PokemonIdentity.findById = async () => identity;
  PokemonIdentity.findOne = () => ({ select: () => ({ lean: async () => null }) });
  PokemonIdentityHistory.create = async () => { histories += 1; };
  PokemonIdentityDiagnostic.updateMany = async () => {
    diagnosticsResolved += 1;
    return { matchedCount: 0, modifiedCount: 0 };
  };
  try {
    const result = await addAlias(identity._id, {
      provider: "game-master",
      value: "EEVEE_GOFEST_2024_STIARA",
      status: "active",
      confidence: 1,
      source: "manual",
    }, "dashboard-admin");
    assert.equal(result.aliases.length, 1);
    assert.equal(saves, 0);
    assert.equal(histories, 0);
    assert.equal(diagnosticsResolved, 1);
  } finally {
    PokemonIdentity.findById = originalFindById;
    PokemonIdentity.findOne = originalFindOne;
    PokemonIdentityHistory.create = originalHistoryCreate;
    PokemonIdentityDiagnostic.updateMany = originalDiagnosticUpdateMany;
  }
});

test("le registre refuse une source inconnue ou retirée", async () => {
  assert.throws(() => assertRegisteredProvider("source-inconnue"), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  assert.throws(() => assertRegisteredProvider("ma-collection"), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  await assert.rejects(() => recordDiagnosticsBatch([{ provider: "ma-collection", rawAlias: "Bulbizarre" }]), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  await assert.rejects(() => importIdentities({ mode: "preview", identities: [{ canonicalId: "TEST_NORMAL", pokemonId: 1, aliases: [{ provider: "ma-collection", value: "test" }] }] }), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
});

test("les fournisseurs encore utilisés sont enregistrés explicitement", () => {
  for (const provider of ["pokemongo-data", "game-master", "pokeminers-game-masters", "leekduck", "leekduck-raids", "snacknap", "snacknap-max-battles", "margxt", "pvpoke", "pogoapi"]) {
    assert.equal(assertRegisteredProvider(provider), provider);
  }
  assert.equal(providerCatalog.some((provider) => provider.id === "ma-collection"), false);
});

test("les identifiants de jeux de données LeekDuck convergent vers le fournisseur canonique", () => {
  for (const provider of ["leekduck-eggs", "leekduck-research", "leekduck-rocket", "leekduck-rocket-lineups"]) {
    assert.equal(assertRegisteredProvider(provider), "leekduck");
  }
  assert.equal(providerCatalog.filter((provider) => provider.id === "leekduck").length, 1);
  assert.equal(providerCatalog.some((provider) => provider.id.startsWith("leekduck-") && provider.id !== "leekduck-raids"), false);
});

test("les diagnostics LeekDuck sont toujours persistés sous le fournisseur canonique", async () => {
  const originalBulkWrite = PokemonIdentityDiagnostic.bulkWrite;
  let operations = [];
  PokemonIdentityDiagnostic.bulkWrite = async (entries) => {
    operations = entries;
    return { upsertedCount: entries.length, modifiedCount: 0 };
  };
  try {
    const result = await recordDiagnosticsBatch([
      { provider: "leekduck-eggs", rawAlias: "Bulbasaur" },
      { provider: "leekduck-research", rawAlias: "Charmander" },
      { provider: "leekduck-rocket-lineups", rawAlias: "Squirtle" },
    ]);
    assert.equal(result.detected, 3);
    for (const operation of operations) {
      assert.equal(operation.updateOne.update.$set.provider, "leekduck");
      assert.match(operation.updateOne.filter.diagnosticKey, /^leekduck:/);
    }
  } finally {
    PokemonIdentityDiagnostic.bulkWrite = originalBulkWrite;
  }
});

test("les statistiques historiques LeekDuck sont agrégées sans créer de fournisseur", async () => {
  const originalIdentityAggregate = PokemonIdentity.aggregate;
  const originalDiagnosticAggregate = PokemonIdentityDiagnostic.aggregate;
  PokemonIdentity.aggregate = async () => [
    { _id: "leekduck", aliases: 2, activeAliases: 2 },
    { _id: "leekduck-eggs", aliases: 3, activeAliases: 1 },
  ];
  PokemonIdentityDiagnostic.aggregate = async () => [
    { _id: "leekduck-research", openDiagnostics: 4, occurrences: 7 },
  ];
  try {
    const providers = await listProviders();
    const leekduck = providers.find((provider) => provider.id === "leekduck");
    assert.equal(leekduck.aliases, 5);
    assert.equal(leekduck.activeAliases, 3);
    assert.equal(leekduck.openDiagnostics, 4);
    assert.equal(leekduck.occurrences, 7);
    assert.equal(providers.some((provider) => provider.id === "leekduck-eggs"), false);
  } finally {
    PokemonIdentity.aggregate = originalIdentityAggregate;
    PokemonIdentityDiagnostic.aggregate = originalDiagnosticAggregate;
  }
});

test("un fournisseur historique inconnu n’est pas réinjecté comme source active", async () => {
  const originalIdentityAggregate = PokemonIdentity.aggregate;
  const originalDiagnosticAggregate = PokemonIdentityDiagnostic.aggregate;
  PokemonIdentity.aggregate = async () => [{ _id: "ma-collection", aliases: 74, activeAliases: 74 }];
  PokemonIdentityDiagnostic.aggregate = async () => [{ _id: "ma-collection", openDiagnostics: 191, occurrences: 343 }];
  try {
    const providers = await listProviders();
    assert.equal(providers.some((provider) => provider.id === "ma-collection"), false);
    assert.ok(providers.every((provider) => provider.status === "active"));
  } finally {
    PokemonIdentity.aggregate = originalIdentityAggregate;
    PokemonIdentityDiagnostic.aggregate = originalDiagnosticAggregate;
  }
});
