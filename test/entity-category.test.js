const assert = require("node:assert/strict");
const test = require("node:test");

const { collectAllDocuments } = require("../src/sync/source-reader");
const { classifyEntity, resolveCanonicalReference } = require("../src/lib/entity-category");

const data = collectAllDocuments();

test("l'API indexe les cinq catégories et conserve leurs chemins canoniques", () => {
  const expected = new Map([
    ["BULBASAUR", "NORMAL"],
    ["RATTATA_ALOLA", "FORM"],
    ["VENUSAUR_MEGA", "MEGA"],
    ["BULBASAUR_DYNAMAX", "DYNAMAX"],
    ["VENUSAUR_GIGANTAMAX", "GIGANTAMAX"],
  ]);
  for (const [formId, category] of expected) {
    const pokemon = data.pokemon.find((entry) => entry.formId === formId);
    const core = data.pokemonAssets.find((entry) => entry.formId === formId);
    assert.ok(pokemon, formId);
    assert.ok(core, formId);
    assert.equal(pokemon.entityCategory, category);
    assert.equal(core.entityCategory, category);
    assert.equal(pokemon.data.assets.assetsRef, resolveCanonicalReference(pokemon.data, { family: "core" }));
    assert.equal(pokemon.data.pvpRef, resolveCanonicalReference(pokemon.data, { family: "pvp" }));
  }
});

test("le résolveur API refuse une classification contradictoire", () => {
  const result = classifyEntity({ id: "TEST", formId: "TEST_MEGA", baseFormId: "TEST", form: "dynamax" });
  assert.equal(result.ambiguous, true);
  assert.equal(result.diagnostic, "ENTITY_CLASSIFICATION_AMBIGUOUS");
});
