const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveCanonicalPokemonAsset,
  resolveProviderPokemonAssets,
} = require("../src/services/pokemon-canonical-asset-service");
const { PokemonIdentity } = require("../src/models");
const identityService = require("../src/services/pokemon-identity-service");
const {
  loadLocalIdentityInventory,
} = require("../src/services/pokemon-local-identity-inventory-service");
const {
  pokemonResolutionRevision,
} = require("../src/services/pokemon-resolution-cache-service");

function flyingIdentity() {
  const local = loadLocalIdentityInventory().indexes.byCanonicalId.get("PIKACHU_COSTUME_2020");
  assert.ok(local);
  return {
    identityId: "6a5b845a37c48578724ac17d",
    canonicalId: local.canonicalId,
    pokemonId: local.pokemonId,
    form: local.form,
    costume: local.costume,
    localReference: {
      key: local.identityKey,
      formId: local.formId,
      file: local.sourceFile,
      assetsRef: local.assetsRef,
    },
    localIdentity: local,
  };
}

test("le service API résout l'asset shiny canonique sans revenir aux champs provider", () => {
  const result = resolveCanonicalPokemonAsset(flyingIdentity(), { shiny: true });
  assert.equal(result.status, "matched");
  assert.equal(result.canonicalId, "PIKACHU_COSTUME_2020");
  assert.equal(result.assetBundle, "pokemon-assets/normal/0025-pikachu.assets.json");
  assert.match(result.resolvedImage, /pm25\.fCOSTUME_2020\.s\.icon\.png$/);
});

test("l'invalidation du catalogue Identity Manager purge aussi le cache des assets", () => {
  const identity = flyingIdentity();
  const beforeRevision = pokemonResolutionRevision();
  const cached = resolveCanonicalPokemonAsset(identity, { shiny: true });
  assert.equal(resolveCanonicalPokemonAsset(identity, { shiny: true }), cached);
  identityService.invalidateIdentityCache();
  assert.equal(pokemonResolutionRevision(), beforeRevision + 1);
  const refreshed = resolveCanonicalPokemonAsset(identity, { shiny: true });
  assert.notEqual(refreshed, cached);
  assert.equal(refreshed.resolvedImage, cached.resolvedImage);
});

test("la résolution provider en lot charge un catalogue unique et conserve l'ordre", async () => {
  const originalFind = PokemonIdentity.find;
  const identity = flyingIdentity();
  let reads = 0;
  PokemonIdentity.find = () => ({
    select: () => ({
      lean: async () => {
        reads += 1;
        return [{
          _id: identity.identityId,
          ...identity,
          status: "active",
          aliases: [
            { aliasId: "flying-name", provider: "snacknap", value: "Pikachu (Flying)", normalizedValue: "pikachu_flying", status: "active", confidence: 1 },
            { aliasId: "flying-code", provider: "snacknap", value: "FLYING", normalizedValue: "flying", status: "active", confidence: 1 },
          ],
        }];
      },
    }),
  });
  try {
    identityService.invalidateIdentityCache();
    const results = await resolveProviderPokemonAssets([
      { provider: "snacknap", rawAlias: "Pikachu (Flying)", shiny: true },
      { provider: "snacknap", rawAlias: "FLYING", shiny: false },
    ]);
    assert.equal(reads, 1);
    assert.equal(results.length, 2);
    assert.deepEqual(results.map((entry) => entry.status), ["matched", "matched"]);
    assert.equal(results[0].identityResolution.identity.canonicalId, "PIKACHU_COSTUME_2020");
    assert.match(results[0].assetResolution.resolvedImage, /\.s\.icon\.png$/);
    assert.match(results[1].assetResolution.resolvedImage, /pm25\.fCOSTUME_2020\.icon\.png$/);
  } finally {
    PokemonIdentity.find = originalFind;
    identityService.invalidateIdentityCache();
  }
});
