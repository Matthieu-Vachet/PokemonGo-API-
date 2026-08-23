const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizedAlias,
  resolveSuggestedTeammates,
  shouldBlockPvpokeRequest,
  sourceUrlFor,
  suggestedTeammatesFor,
  waitForSuggestedTeammates,
} = require("../src/services/pvp-suggested-teammates-service");
const { teammateContext } = require("../src/routes/pvp-rankings");

test("l'URL Suggested Teammates est dérivée uniquement du format PvPoke validé", () => {
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 1500, speciesId: "mimikyu" }), "https://pvpoke.com/rankings/all/1500/overall/mimikyu/");
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 2500, speciesId: "ninetales_alolan" }), "https://pvpoke.com/rankings/all/2500/overall/ninetales_alolan/");
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 10000, speciesId: "dragonite" }), "https://pvpoke.com/rankings/all/10000/overall/dragonite/");
  assert.throws(() => sourceUrlFor({ sourceGroup: "../evil", cp: 1500, speciesId: "mimikyu" }), /invalide/);
});

test("le navigateur conserve les ressources PvPoke utiles et bloque les tiers lourds", () => {
  assert.equal(shouldBlockPvpokeRequest("https://pvpoke.com/js/RankingMain.js", "script"), false);
  assert.equal(shouldBlockPvpokeRequest("https://pvpoke.com/data/rankings/all/overall/rankings-1500.json", "fetch"), false);
  assert.equal(shouldBlockPvpokeRequest("https://s.nitropay.com/ads.js", "script"), true);
  assert.equal(shouldBlockPvpokeRequest("https://pvpoke.com/img/pokemon.png", "image"), true);
});

test("l'attente PvPoke distingue le résultat vide d'un timeout source réel", async () => {
  const readyPage = { waitForFunction: async () => undefined };
  await waitForSuggestedTeammates(readyPage, { sourceUrl: "https://pvpoke.com/test", timeout: 1 });
  const timeoutPage = { waitForFunction: async () => { throw new Error("selector timeout"); } };
  await assert.rejects(
    waitForSuggestedTeammates(timeoutPage, { sourceUrl: "https://pvpoke.com/test", timeout: 1 }),
    (error) => error.code === "PVP_TEAMMATE_SOURCE_TIMEOUT" && error.status === 504,
  );
});

test("Great, Ultra, Master, forme régionale et non classé utilisent le contexte exact", () => {
  const current = {
    document: { sourceHash: "hash" },
    data: {
      formats: [
        { id: "great", sourceGroup: "all", cp: 1500 },
        { id: "ultra", sourceGroup: "all", cp: 2500 },
        { id: "master", sourceGroup: "all", cp: 10000 },
      ],
      leagues: {
        great: { rankings: [{ sourceIdentity: { speciesId: "lickilicky" } }, { sourceIdentity: { speciesId: "ninetales_alolan" } }] },
        ultra: { rankings: [{ sourceIdentity: { speciesId: "lickilicky" } }] },
        master: { rankings: [{ sourceIdentity: { speciesId: "dragonite" } }] },
      },
    },
  };
  assert.equal(teammateContext(current, "great", "lickilicky").cp, 1500);
  assert.equal(teammateContext(current, "ultra", "lickilicky").cp, 2500);
  assert.equal(teammateContext(current, "master", "dragonite").cp, 10000);
  assert.equal(teammateContext(current, "great", "ninetales_alolan").speciesId, "ninetales_alolan");
  assert.equal(teammateContext(current, "great", "unranked"), null);
  assert.throws(() => teammateContext(current, "missing", "lickilicky"), (error) => error.code === "PVP_FORMAT_NOT_FOUND");
});

test("un échec d'écriture du cache ne transforme pas des suggestions valides en HTTP 500", async () => {
  const cacheModel = {
    findOne: () => ({ lean: async () => null }),
    findOneAndUpdate: async () => { throw new Error("quota cache"); },
  };
  const result = await suggestedTeammatesFor(
    { league: "great", sourceGroup: "all", cp: 1500, speciesId: "lickilicky", sourceHash: "hash" },
    {
      cacheModel,
      scrape: async () => ({
        sourceUrl: "https://pvpoke.com/rankings/all/1500/overall/lickilicky/",
        items: [{ rawName: "Mimikyu", providerAlias: "mimikyu", rankOrOrder: 1 }],
      }),
      resolveAliasesBatch: async () => [{ status: "unmatched", reason: "ALIAS_UNKNOWN" }],
      recordDiagnosticsBatch: async () => undefined,
    },
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.cache, "miss-unpersisted");
  assert.equal(result.persistenceWarnings[0].code, "PVP_TEAMMATE_CACHE_WRITE_FAILED");
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
