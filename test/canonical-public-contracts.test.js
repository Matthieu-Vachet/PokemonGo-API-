const test = require("node:test");
const assert = require("node:assert/strict");

const packageJson = require("../package.json");
const { createOpenApi } = require("../src/docs/openapi");
const { presentPokemon } = require("../src/services/pokemon-presenter");
const { collectAllDocuments } = require("../src/sync/source-reader");

const categoryDirectories = Object.freeze({
  NORMAL: "normal",
  FORM: "forms",
  MEGA: "mega",
  DYNAMAX: "dynamax",
  GIGANTAMAX: "gigantamax",
});

test("OpenAPI est versionné avec le package et ne publie aucun contrat privé", () => {
  const specification = createOpenApi();
  const serialized = JSON.stringify(specification);
  assert.equal(specification.info.version, packageJson.version);
  assert.ok(specification.paths["/api/v1/pokemon"]);
  assert.ok(specification.paths["/api/v1/pokemon/{identifier}/assets/{family}"]);
  assert.ok(specification.paths["/api/v1/pvp/{league}/{identifier}"]);
  assert.equal(specification.paths["/api/v1/admin/pokemon-identities"], undefined);
  assert.equal(specification.paths["/api/v1/admin/game-master/summary"], undefined);
  assert.ok(serialized.includes("pokemon-assets/core/normal/0006-charizard.assets.json"));
  assert.ok(serialized.includes("pvp/pokemon/normal/0006-charizard.pvp.json"));
  assert.match(serialized, /entityCategory/);
});

test("les cinq catégories conservent leur identité et leurs références publiques", () => {
  const data = collectAllDocuments();
  const pokemonByFormId = new Map(data.pokemon.map((entry) => [entry.formId, entry]));
  const coreByFormId = new Map(data.pokemonAssets.map((entry) => [entry.formId, entry]));
  const keys = new Set();
  const assetReferences = new Set();
  const pvpReferences = new Set();

  assert.equal(data.pokemon.length, 1611);
  assert.equal(data.pokemonAssets.length, data.pokemon.length);

  for (const pokemon of data.pokemon) {
    const directory = categoryDirectories[pokemon.entityCategory];
    assert.ok(directory, `${pokemon.formId}: catégorie publique invalide`);
    assert.equal(keys.has(pokemon.key), false, `${pokemon.key}: collision d'identité`);
    keys.add(pokemon.key);
    assert.match(pokemon.dexId, /^\d{4}$/);
    assert.ok(pokemon.slug);
    assert.ok(pokemon.formId);
    assert.equal(pokemon.data.assets, undefined);
    assert.match(pokemon.data.assetsRef, new RegExp(`^pokemon-assets/core/${directory}/`));
    assert.match(pokemon.data.pvpRef, new RegExp(`^pvp/pokemon/${directory}/`));
    assert.equal(assetReferences.has(pokemon.data.assetsRef), false, `${pokemon.formId}: collision assetsRef`);
    assert.equal(pvpReferences.has(pokemon.data.pvpRef), false, `${pokemon.formId}: collision pvpRef`);
    assetReferences.add(pokemon.data.assetsRef);
    pvpReferences.add(pokemon.data.pvpRef);

    const core = coreByFormId.get(pokemon.formId);
    assert.ok(core, `${pokemon.formId}: Core absent`);
    assert.equal(core.entityCategory, pokemon.entityCategory);
    for (const reference of Object.values(core.assetRefs || {})) {
      assert.match(reference, new RegExp(`^pokemon-assets/(?:home|shuffle|location-cards|variants)/${directory}/`));
    }

    const presented = presentPokemon(pokemon);
    assert.equal(presented.entityCategory, pokemon.entityCategory);
    assert.equal(presented.data.assetsRef, pokemon.data.assetsRef);
    assert.equal(presented.data.pvpRef, pokemon.data.pvpRef);
  }

  for (const family of data.pokemonAssetFamilies) {
    const pokemon = pokemonByFormId.get(family.formId);
    assert.ok(pokemon, `${family.key}: famille orpheline`);
    assert.equal(family.entityCategory, pokemon.entityCategory);
  }

  for (const [formId, expectedCategory] of [
    ["BULBASAUR", "NORMAL"],
    ["VENUSAUR", "NORMAL"],
    ["RATTATA_ALOLA", "FORM"],
    ["VENUSAUR_MEGA", "MEGA"],
    ["CHARIZARD_MEGA_X", "MEGA"],
    ["CHARIZARD_MEGA_Y", "MEGA"],
    ["BULBASAUR_DYNAMAX", "DYNAMAX"],
    ["VENUSAUR_GIGANTAMAX", "GIGANTAMAX"],
  ]) {
    assert.equal(pokemonByFormId.get(formId)?.entityCategory, expectedCategory, formId);
  }
});
