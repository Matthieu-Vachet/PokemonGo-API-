const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizedAlias,
  resolveSuggestedTeammates,
  selectUniqueResolvedTeammates,
  suggestedTeammatesFromRankings,
  sourceUrlFor,
  suggestedTeammatesFor,
} = require("../src/services/pvp-suggested-teammates-service");
const { teammateContext } = require("../src/routes/pvp-rankings");

test("l'URL Suggested Teammates est dérivée uniquement du format PvPoke validé", () => {
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 1500, speciesId: "mimikyu" }), "https://pvpoke.com/rankings/all/1500/overall/mimikyu/");
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 2500, speciesId: "ninetales_alolan" }), "https://pvpoke.com/rankings/all/2500/overall/ninetales_alolan/");
  assert.equal(sourceUrlFor({ sourceGroup: "all", cp: 10000, speciesId: "dragonite" }), "https://pvpoke.com/rankings/all/10000/overall/dragonite/");
  assert.throws(() => sourceUrlFor({ sourceGroup: "../evil", cp: 1500, speciesId: "mimikyu" }), /invalide/);
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
  assert.equal(teammateContext(current, "great", "lickilicky").rankings.length, 2);
  assert.equal(teammateContext(current, "ultra", "lickilicky").cp, 2500);
  assert.equal(teammateContext(current, "master", "dragonite").cp, 10000);
  assert.equal(teammateContext(current, "great", "ninetales_alolan").speciesId, "ninetales_alolan");
  assert.equal(teammateContext(current, "great", "unranked"), null);
  assert.throws(() => teammateContext(current, "missing", "lickilicky"), (error) => error.code === "PVP_FORMAT_NOT_FOUND");
});

test("le calcul serverless choisit cinq partenaires complémentaires sans Chromium", () => {
  const pokemon = (speciesId, dexNr, rank, score, matchups = [], counters = []) => ({
    rank,
    score,
    sourceIdentity: { speciesId, speciesName: speciesId },
    pokemonRef: speciesId.toUpperCase(),
    variant: speciesId.endsWith("_shadow") ? "shadow" : "normal",
    matchups: matchups.map((sourceId) => ({ sourceId, rating: 700 })),
    counters: counters.map((sourceId) => ({ sourceId, rating: 300 })),
    pokemon: {
      id: speciesId.toUpperCase(),
      formId: speciesId.toUpperCase(),
      dexNr,
      names: { English: speciesId },
      types: ["Normal"],
      assets: { image: `https://assets.example/${speciesId}.png`, shinyImage: null },
      identity: { pokemonId: dexNr, form: speciesId.toUpperCase() },
    },
  });
  const rankings = [
    pokemon("source", 1, 1, 95, [], ["threat_a", "threat_b"]),
    pokemon("partner_a", 2, 2, 90, ["threat_a", "threat_b"]),
    pokemon("partner_a_shadow", 2, 3, 89, ["threat_a", "threat_b"]),
    pokemon("partner_b", 3, 4, 88, ["threat_a"]),
    pokemon("partner_c", 4, 5, 87, ["threat_b"]),
    pokemon("partner_d", 5, 6, 86, ["threat_a"]),
    pokemon("partner_e", 6, 7, 85, ["threat_b"]),
    pokemon("partner_f", 7, 8, 84),
  ];
  const result = suggestedTeammatesFromRankings({ league: "great", speciesId: "source", rankings }, 5);
  assert.equal(result.items.length, 5);
  assert.deepEqual(result.items.map((item) => item.providerAlias), ["partner_a", "partner_b", "partner_c", "partner_d", "partner_e"]);
  assert.equal(result.sourceItem.providerAlias, "source");
  assert.equal(result.emptyReason, null);
});

test("la sélection finale déduplique les formes par numéro Pokédex après résolution", () => {
  const items = [
    { providerAlias: "keldeo_resolute", pokemonId: 647, canonicalId: "KELDEO_RESOLUTE" },
    { providerAlias: "keldeo_ordinary", pokemonId: 647, canonicalId: "KELDEO_ORDINARY" },
    { providerAlias: "dragonite", pokemonId: 149, canonicalId: "DRAGONITE" },
  ];
  assert.deepEqual(
    selectUniqueResolvedTeammates(items, null).map((item) => item.providerAlias),
    ["keldeo_resolute", "dragonite"],
  );
  assert.deepEqual(selectUniqueResolvedTeammates(items, 647).map((item) => item.providerAlias), ["dragonite"]);
});

test("le calcul serverless refuse un snapshot invalide et distingue un classement absent", () => {
  assert.throws(
    () => suggestedTeammatesFromRankings({ league: "great", speciesId: "source" }),
    (error) => error.code === "PVP_TEAMMATE_RANKING_SNAPSHOT_INVALID" && error.status === 502,
  );
  assert.deepEqual(
    suggestedTeammatesFromRankings({ league: "great", speciesId: "source", rankings: [] }),
    { items: [], diagnostics: [], emptyReason: "RANKING_NOT_FOUND" },
  );
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
