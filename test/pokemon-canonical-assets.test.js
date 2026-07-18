const assert = require("node:assert/strict");
const test = require("node:test");
const {
  resolveCanonicalPokemonAsset,
} = require("../src/services/pokemon-canonical-asset-service");
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
