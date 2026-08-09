const test = require("node:test");
const assert = require("node:assert/strict");

const {
  attachPokemonAssets,
  normalizeAssetFamilies,
} = require("../src/services/pokemon-service");
const { collectAllDocuments } = require("../src/sync/source-reader");

const data = collectAllDocuments();
const bulbasaur = data.pokemon.find((document) => document.formId === "BULBASAUR");
const bulbasaurCore = data.pokemonAssets.find(
  (document) => document.formId === "BULBASAUR",
);
const bulbasaurFamilies = data.pokemonAssetFamilies.filter(
  (document) => document.formId === "BULBASAUR",
);

test("le reader sépare le core et les quatre familles sans collision", () => {
  assert.equal(data.pokemonAssets.length, 1611);
  assert.equal(data.pokemonAssetFamilies.length, 3147);
  assert.equal(new Set(data.pokemonAssets.map((document) => document.formId)).size, 1611);
  assert.equal(
    new Set(data.pokemonAssetFamilies.map((document) => document.key)).size,
    data.pokemonAssetFamilies.length,
  );
  assert.deepEqual(
    Object.fromEntries(
      ["home", "shuffle", "variants", "location-cards"].map((family) => [
        family,
        data.pokemonAssetFamilies.filter((document) => document.family === family).length,
      ]),
    ),
    { home: 1089, shuffle: 1512, variants: 331, "location-cards": 215 },
  );
  assert.ok(data.pokemonAssets.every((document) => /\/core\//.test(document.sourceFile)));
  assert.ok(data.pokemon.every((document) => document.data.assets === undefined));
  assert.ok(data.pokemon.every((document) => /^pokemon-assets\/core\//.test(document.data.assetsRef)));
  assert.ok(data.pokemonAssets.every((document) => document.sourceFile.includes(`/${document.entityCategory === "FORM" ? "forms" : document.entityCategory.toLowerCase()}/`)));
  assert.ok(data.pokemonAssetFamilies.every((document) => document.payload !== null));
});

test("le core reste léger tant qu'aucune famille n'est incluse", () => {
  const hydrated = attachPokemonAssets(bulbasaur, bulbasaurCore);
  assert.equal(hydrated.data.assets.image, bulbasaurCore.assets.image);
  assert.equal(hydrated.data.assets.shinyImage, bulbasaurCore.assets.shinyImage);
  assert.equal(hydrated.data.assetsRef, bulbasaur.data.assetsRef);
  assert.equal(hydrated.data.assets.assetsRef, undefined);
  assert.equal(hydrated.data.assets.home, undefined);
  assert.equal(hydrated.data.assets.shuffle, undefined);
  assert.equal(hydrated.data.assets.locationCards, undefined);
  assert.equal(hydrated.data.assetForms, undefined);
  assert.deepEqual(hydrated.data.assetRefs, bulbasaurCore.assetRefs);
});

test("chaque include hydrate uniquement la famille demandée", () => {
  for (const family of ["home", "shuffle", "variants", "location-cards"]) {
    const document = bulbasaurFamilies.find((candidate) => candidate.family === family);
    const hydrated = attachPokemonAssets(bulbasaur, bulbasaurCore, [document]);
    if (family === "variants") {
      assert.equal(hydrated.data.assetForms.length, 3);
      assert.equal(hydrated.data.assets.home, undefined);
    } else if (family === "location-cards") {
      assert.equal(hydrated.data.assets.locationCards.length, 3);
      assert.equal(hydrated.data.assets.home, undefined);
    } else {
      assert.ok(hydrated.data.assets[family]);
      assert.equal(hydrated.data.assetForms, undefined);
    }
  }
});

test("les aliases d'include restent explicites et dédupliqués", () => {
  assert.deepEqual(
    normalizeAssetFamilies("home,assetForms,backgrounds,home"),
    ["home", "variants", "location-cards"],
  );
  assert.deepEqual(normalizeAssetFamilies("all"), [
    "home",
    "shuffle",
    "variants",
    "location-cards",
  ]);
  assert.deepEqual(normalizeAssetFamilies("data,inconnue"), []);
});
