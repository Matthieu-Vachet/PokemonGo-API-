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
  assert.equal(result.items[1].pokemon.identity.image, "https://assets.example/quagsire.png");
  assert.equal(result.items[1].pokemon.identity.resolutionStatus, "matched");
  assert.deepEqual(result.items[1].pokemon.identity.assetResolution, {
    status: "matched",
    image: "https://assets.example/quagsire.png",
    shinyImage: null,
    reason: null,
  });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(normalizedAlias(raw[1]), { providerAlias: "quagsire_shadow", identityAlias: "quagsire", shadow: true });
});

test("les partenaires actuels de Mimiqui traversent canonicalId vers leur asset exact", async () => {
  const raw = [
    ["Lickilicky", "lickilicky"],
    ["Empoleon", "empoleon"],
    ["Azumarill", "azumarill"],
    ["Tinkaton", "tinkaton"],
    ["Ninetales (Alolan)", "ninetales_alolan"],
  ].map(([rawName, providerAlias], index) => ({ rawName, providerAlias, rankOrOrder: index + 1 }));
  const resolver = async (requests) => requests.map((request) => ({
    status: "matched",
    identity: {
      canonicalId: request.rawAlias.toUpperCase(),
      pokemonId: 1,
      form: request.rawAlias === "ninetales_alolan" ? "ALOLA" : "NORMAL",
      costume: null,
      localIdentity: { formId: request.rawAlias.toUpperCase(), pokemonName: request.rawAlias, types: [], assets: {} },
    },
    selectedAsset: {
      image: `https://raw.githubusercontent.test/pokemon/${request.rawAlias}.png`,
      shinyImage: `https://raw.githubusercontent.test/pokemon/${request.rawAlias}.shiny.png`,
    },
  }));

  const result = await resolveSuggestedTeammates(raw, { league: "great", speciesId: "mimikyu" }, resolver);
  assert.equal(result.items.length, 5);
  assert.deepEqual(result.items.map((item) => item.canonicalId), raw.map((item) => item.providerAlias.toUpperCase()));
  for (const item of result.items) {
    assert.equal(item.pokemon.identity.resolutionStatus, "matched");
    assert.equal(item.pokemon.identity.assetResolution.image, item.pokemon.assets.image);
    assert.match(item.pokemon.identity.image, new RegExp(`${item.providerAlias}\\.png$`));
  }
});
