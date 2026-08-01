const test = require("node:test");
const assert = require("node:assert/strict");
const { containsRetiredFeature, isRetiredValue, stripRetiredFeature } = require("../scripts/migrate/retire-ma-collection");

test("la migration reconnaît les anciens identifiants sans faux positif", () => {
  assert.equal(isRetiredValue("ma-collection"), true);
  assert.equal(isRetiredValue("ma_collection"), true);
  assert.equal(isRetiredValue("collection"), false);
  assert.equal(containsRetiredFeature({ identity: { aliases: [{ provider: "ma-collection" }] } }), true);
});

test("le nettoyage retire uniquement la source obsolète et conserve les données utiles", () => {
  const source = {
    name: "Bulbizarre",
    identityProvider: "ma-collection",
    identity: {
      canonicalId: "BULBASAUR_NORMAL",
      aliases: [{ provider: "ma-collection", value: "Bulbizarre" }, { provider: "game-master", value: "BULBASAUR_NORMAL" }],
      activeAliasKeys: ["ma-collection:bulbizarre", "game-master:bulbasaur_normal"],
    },
  };
  const cleaned = stripRetiredFeature(source);
  assert.equal(cleaned.identityProvider, undefined);
  assert.deepEqual(cleaned.identity.aliases, [{ provider: "game-master", value: "BULBASAUR_NORMAL" }]);
  assert.deepEqual(cleaned.identity.activeAliasKeys, ["game-master:bulbasaur_normal"]);
  assert.equal(cleaned.identity.canonicalId, "BULBASAUR_NORMAL");
  assert.equal(containsRetiredFeature(cleaned), false);
});
