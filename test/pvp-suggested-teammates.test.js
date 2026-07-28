const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizedAlias, resolveSuggestedTeammates, sourceUrlFor } = require("../src/services/pvp-suggested-teammates-service");

test("l'URL Suggested Teammates est dérivée uniquement du format PvPoke validé", () => {
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 1500, speciesId: "mimikyu" }), "https://pvpoke.com/rankings/all/1500/overall/mimikyu/");
  assert.throws(() => sourceUrlFor({ sourceGroup: "../evil", cp: 1500, speciesId: "mimikyu" }), /invalide/);
});

test("les partenaires PvPoke conservent ordre, Shadow, canonicalId et asset exact", async () => {
  const raw = [
    { rawName: "Kingdra", providerAlias: "kingdra", rankOrOrder: 1 },
    { rawName: "Quagsire (Shadow)", providerAlias: "quagsire_shadow", rankOrOrder: 2 },
  ];
  const resolver = async (requests) => requests.map((request) => ({
    status: "matched",
    identity: {
      canonicalId: request.rawAlias.toUpperCase(),
      pokemonId: request.rawAlias === "kingdra" ? 230 : 195,
      form: "NORMAL",
      costume: null,
      localIdentity: { pokemonKey: request.rawAlias.toUpperCase(), formId: request.rawAlias.toUpperCase(), pokemonName: request.rawAlias, types: ["WATER"], assets: {} },
    },
    selectedAsset: { image: `https://assets.example/${request.rawAlias}.png`, shinyImage: null },
  }));
  const result = await resolveSuggestedTeammates(raw, { league: "great", speciesId: "mimikyu" }, resolver);
  assert.deepEqual(result.items.map((item) => item.rankOrOrder), [1, 2]);
  assert.equal(result.items[1].shadow, true);
  assert.equal(result.items[1].providerAlias, "quagsire_shadow");
  assert.equal(result.items[1].canonicalId, "QUAGSIRE");
  assert.equal(result.items[1].pokemon.assets.image, "https://assets.example/quagsire.png");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(normalizedAlias(raw[1]), { providerAlias: "quagsire_shadow", identityAlias: "quagsire", shadow: true });
});
