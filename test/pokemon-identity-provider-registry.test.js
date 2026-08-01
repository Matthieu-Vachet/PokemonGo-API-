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
  let saves = 0;
  let histories = 0;
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
  } finally {
    PokemonIdentity.findById = originalFindById;
    PokemonIdentity.findOne = originalFindOne;
    PokemonIdentityHistory.create = originalHistoryCreate;
  }
});

test("le registre refuse une source inconnue ou retirée", async () => {
  assert.throws(() => assertRegisteredProvider("source-inconnue"), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  assert.throws(() => assertRegisteredProvider("ma-collection"), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  await assert.rejects(() => recordDiagnosticsBatch([{ provider: "ma-collection", rawAlias: "Bulbizarre" }]), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
  await assert.rejects(() => importIdentities({ mode: "preview", identities: [{ canonicalId: "TEST_NORMAL", pokemonId: 1, aliases: [{ provider: "ma-collection", value: "test" }] }] }), (error) => error.code === "IDENTITY_PROVIDER_NOT_REGISTERED");
});

test("les fournisseurs encore utilisés sont enregistrés explicitement", () => {
  for (const provider of ["game-master", "pokeminers-game-masters", "leekduck", "leekduck-raids", "snacknap", "snacknap-max-battles", "margxt", "pvpoke", "pogoapi"]) {
    assert.equal(assertRegisteredProvider(provider), provider);
  }
  assert.equal(providerCatalog.some((provider) => provider.id === "ma-collection"), false);
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
