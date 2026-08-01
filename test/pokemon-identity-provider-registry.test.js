const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentity, PokemonIdentityDiagnostic } = require("../src/models");
const {
  assertRegisteredProvider,
  listProviders,
  importIdentities,
  providerCatalog,
  recordDiagnosticsBatch,
} = require("../src/services/pokemon-identity-service");

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
