const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  getCurrentDatasetAdapter,
  summarizeShinyHistory,
} = require("../src/current-datasets/adapters");
const { computeDatasetHash } = require("../src/lib/current-dataset-hash");
const { dataPathFromRelative } = require("../src/lib/data-repository");

const DOMAINS = ["raids", "eggs", "max-battles", "research", "rocket", "shiny", "pvp-rankings", "gbl-calendar", "best-attackers", "best-defenders", "costume-audit", "pokemon-identity-mappings"];

function localFixture(adapter) {
  return JSON.parse(fs.readFileSync(dataPathFromRelative(adapter.jsonPath), "utf8"));
}

test("les adaptateurs valident leurs fixtures locales sans en faire une source runtime", () => {
  for (const domain of DOMAINS) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.visibility, ["shiny", "costume-audit", "pokemon-identity-mappings"].includes(domain) ? "private" : "public");
    const data = localFixture(adapter);
    const summary = adapter.summarize(data);
    adapter.validate(data, {}, summary);
    assert.ok(adapter.count(data, summary) > 0, domain);
    assert.ok(adapter.extractEntries(data).length > 0, domain);
    assert.match(
      computeDatasetHash(data, { extractEntries: adapter.extractEntries }),
      /^[a-f0-9]{64}$/,
      domain,
    );
  }
});

test("chaque adaptateur cible la collection et la racine de données attendues", () => {
  const expected = {
    raids: ["raids", "currentList"],
    eggs: ["eggs", "currentEggsList"],
    "max-battles": ["maxbattles", "currentMaxBattle"],
    research: ["researches", "currentResearchList"],
    rocket: ["rockets", "currentRocketList"],
    shiny: ["shiny_rankings", "rankings"],
    "pvp-rankings": ["pvp_rankings", "leagues"],
    "gbl-calendar": ["gbl_calendar", "periods"],
    "best-attackers": ["best_attackers", "rankings"],
    "best-defenders": ["best_defenders", "tiers"],
    "costume-audit": ["costume_audits", "items"],
    "pokemon-identity-mappings": ["pokemon_identity_mappings", "mappings"],
  };

  for (const [domain, [collection, rootKey]] of Object.entries(expected)) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.Model.collection.collectionName, collection);
    assert.equal(adapter.rootKey, rootKey);
  }
});

test("les générateurs qui résolvent des identités reçoivent le catalogue Identity Manager", () => {
  for (const domain of ["shiny", "pvp-rankings", "raids", "eggs", "max-battles", "research", "rocket", "best-defenders", "costume-audit", "pokemon-identity-mappings"]) {
    assert.equal(typeof getCurrentDatasetAdapter(domain).generatorOptions, "function", domain);
  }
});

test("Best Defenders filtre par tier et hydrate uniquement l'asset canonique", () => {
  const adapter = getCurrentDatasetAdapter("best-defenders");
  const data = localFixture(adapter);
  const presented = adapter.present(data, { tier: "S", limit: "100" });
  assert.equal(presented.data.rankings.length, 2);
  assert.ok(presented.data.rankings.every((entry) => entry.tier === "S"));
  assert.ok(presented.data.rankings.every((entry) => !String(entry.pokemon.assets.image || "").includes("pokemongohub.net")));
});

test("Costume Audit reste privé et paginé", async () => {
  const adapter = getCurrentDatasetAdapter("costume-audit");
  const data = localFixture(adapter);
  const presented = await adapter.present(data, { status: "missing", limit: "5" }, {
    resolveAliasesBatch: async (entries) => entries.map(() => ({ status: "unmatched", reason: "ALIAS_UNKNOWN" })),
  });
  assert.equal(presented.data.items.length, 5);
  assert.ok(presented.data.items.every((entry) => entry.pokemonGoData.status !== "present"));
});

test("Costume Audit résout une variante avec sa forme contextuelle quand elle existe", async () => {
  const adapter = getCurrentDatasetAdapter("costume-audit");
  const data = {
    metadata: { visibility: "private", statusCounts: {} },
    items: [{
      id: "dedenne-holidays",
      sourceIndex: 1,
      source: { pokemonName: "Dedenne", costumeName: "Tenue des fêtes", title: "Dedenne – Tenue des fêtes" },
      events: [],
      shinyAvailable: true,
      identity: { pokemonId: 702, form: "DEDENNE_TENUE_DES_FETES", costume: "TENUE_DES_FETES" },
      pokemonGoData: { status: "unresolved", exactNormalAsset: null, exactShinyAsset: null },
    }],
  };
  let requests = [];
  await adapter.present(data, {}, {
    resolveAliasesBatch: async (entries) => {
      requests = entries;
      return entries.map(() => ({ status: "unmatched", reason: "ALIAS_UNKNOWN" }));
    },
  });

  assert.equal(requests[0].rawAlias, "DEDENNE_TENUE_DES_FETES");
  assert.equal(requests[0].costume, "TENUE_DES_FETES");
});

test("Costume Audit réhydrate immédiatement un alias Margxt résolu et applique les tris", async () => {
  const adapter = getCurrentDatasetAdapter("costume-audit");
  const data = {
    metadata: { visibility: "private", statusCounts: {} },
    items: [{
      id: "willow",
      sourceIndex: 1,
      source: { pokemonName: "Pikachu", costumeName: "Assistant du Professeur Willow", title: "Pikachu – Assistant du Professeur Willow" },
      events: ["Ultra Bonus (21 au 27 juillet 2026)"],
      shinyAvailable: true,
      identity: { pokemonId: 25, costume: "ASSISTANT_DU_PROFESSEUR_WILLOW" },
      pokemonGoData: { status: "unresolved", exactNormalAsset: null, exactShinyAsset: null },
    }],
  };
  const presented = await adapter.present(data, { sort: "pokemonId", order: "asc", type: "ELECTRIC" }, {
    resolveAliasesBatch: async () => [{
      status: "matched",
      strategy: "provider-exact",
      confidence: 1,
      selectedAsset: { gender: "MALE", image: "https://assets.example/pm25.willow.png", shinyImage: "https://assets.example/pm25.willow.s.png" },
      identity: {
        identityId: "identity-willow",
        canonicalId: "PIKACHU_ANNIVERSARY_2026",
        pokemonId: 25,
        form: "normal",
        costume: "ANNIVERSARY_2026",
        localIdentity: { pokemonKey: "PIKACHU", pokemonName: "Pikachu", types: ["ELECTRIC"], sourceFile: "pokemon/0025-pikachu.json", assetsRef: "pokemon-assets/core/normal/0025-pikachu.assets.json", assets: {} },
      },
    }],
  });
  const item = presented.data.items[0];
  assert.equal(item.pokemonGoData.status, "present");
  assert.equal(item.pokemonGoData.canonicalId, "PIKACHU_ANNIVERSARY_2026");
  assert.equal(item.pokemonGoData.exactNormalAsset, "https://assets.example/pm25.willow.png");
  assert.deepEqual(item.types, ["ELECTRIC"]);
  assert.equal(presented.data.metadata.statusCounts.present, 1);
  assert.deepEqual(presented.data.metadata.availableTypes, ["ELECTRIC"]);
  assert.equal(presented.meta.filters.sort, "pokemonId");
});

test("les mappings Game Master filtrent les variantes non résolues", () => {
  const adapter = getCurrentDatasetAdapter("pokemon-identity-mappings");
  const data = localFixture(adapter);
  const presented = adapter.present(data, { status: "missing-local-form", limit: "20" });
  assert.ok(presented.data.mappings.length > 0);
  assert.ok(presented.data.mappings.every((mapping) => mapping.mappingStatus === "missing-local-form"));
});

test("le presenter Best Attackers hydrate Pokémon et attaques puis trie la métrique demandée", () => {
  const adapter = getCurrentDatasetAdapter("best-attackers");
  const data = localFixture(adapter);
  const presented = adapter.present(data, { type: "FIRE", level: "40", metric: "dps", limit: "3" });
  assert.equal(presented.data.rankings.length, 3);
  assert.equal(presented.meta.metric, "dps");
  assert.ok(presented.data.rankings.every((entry) => entry.pokemon && entry.fastMove && entry.chargedMove));
  assert.ok(presented.data.rankings[0].dps >= presented.data.rankings[1].dps);
  assert.ok(presented.data.rankings.every((entry) => entry.rank >= 1 && entry.percentage > 0 && entry.tier));
});

test("les filtres Best Attackers obscur, Méga, élite et classe de moveset sont appliqués serveur", () => {
  const adapter = getCurrentDatasetAdapter("best-attackers");
  const data = localFixture(adapter);
  const shadow = adapter.present(data, { shadow: "true", limit: "10" });
  assert.ok(shadow.data.rankings.every((entry) => entry.pokemon.shadow));
  const mega = adapter.present(data, { mega: "true", limit: "10" });
  assert.ok(mega.data.rankings.every((entry) => entry.pokemon.mega));
  const elite = adapter.present(data, { elite: "true", limit: "10" });
  assert.ok(elite.data.rankings.every((entry) => entry.eliteFast || entry.eliteCharged));
  const mixed = adapter.present(data, { movesetClass: "mixed", limit: "10" });
  assert.ok(mixed.data.rankings.every((entry) => entry.movesetClass === "mixed"));
});

test("le presenter PvP hydrate la fiche Pokémon centralisée sans dupliquer les matchups", () => {
  const adapter = getCurrentDatasetAdapter("pvp-rankings");
  const data = localFixture(adapter);
  const presented = adapter.present(data, { league: "great", limit: "1" });
  const entry = presented.data.rankings[0];

  assert.equal(entry.pokemon.formId, entry.pokemonRef);
  assert.ok(presented.data.references.pokemon[entry.pokemonRef]);
  assert.equal(entry.matchups[0].pokemon, undefined);
  assert.ok(entry.matchups[0].pokemonRef);
});

test("le catalogue PvP complet et le calendrier GBL conservent leurs contrats publics", () => {
  const pvp = getCurrentDatasetAdapter("pvp-rankings");
  const pvpData = localFixture(pvp);
  const full = pvp.present(pvpData, { league: "great", full: "true" });
  assert.equal(full.data.rankings.length, pvpData.leagues.great.rankings.length);

  const calendar = getCurrentDatasetAdapter("gbl-calendar");
  const data = localFixture(calendar);
  const current = calendar.present(data, { status: "current" });
  assert.equal(current.data.periods.length, 1);
  assert.equal(current.data.periods[0].status, "current");
});

test("l'identité Rocket distingue profil, slot et Pokémon", () => {
  const adapter = getCurrentDatasetAdapter("rocket");
  const data = localFixture(adapter);
  const entries = adapter.extractEntries(data);

  assert.ok(entries.some((entry) => entry.key.endsWith(":profile")));
  assert.ok(entries.some((entry) => /:slot[123]:/.test(entry.key)));
  assert.ok(entries.every((entry) => entry.key && entry.value));
});

test("les statistiques Shiny proviennent exclusivement des snapshots observés", () => {
  const statistics = summarizeShinyHistory([
    { snapshotAt: "2026-07-01T00:00:00.000Z", odds: { denominator: 500 } },
    { snapshotAt: "2026-07-05T00:00:00.000Z", odds: { denominator: 400 } },
    { snapshotAt: "2026-07-10T00:00:00.000Z", odds: { denominator: 600 } },
  ]);

  assert.equal(statistics.allTime.average, 500);
  assert.deepEqual(statistics.allTime.best, { snapshotAt: "2026-07-05T00:00:00.000Z", value: 400 });
  assert.deepEqual(statistics.allTime.worst, { snapshotAt: "2026-07-10T00:00:00.000Z", value: 600 });
  assert.deepEqual(statistics.allTime.variation, { absolute: 100, percent: 20 });
  assert.equal(statistics.windows.sevenDays.observations, 2);
  assert.deepEqual(statistics.dailyEvolution.map((point) => point.change), [null, -100, 200]);
});

test("le presenter Shiny conserve l'identité et la résolution d'asset canoniques", () => {
  const adapter = getCurrentDatasetAdapter("shiny");
  const flyingPikachu = {
    rank: 3,
    sourceIdentity: { id: "25", variantKey: "25_f2332_s", name: "Pikachu (Flying)" },
    pokemon: {
      id: "PIKACHU",
      dexNr: 25,
      formId: "PIKACHU_COSTUME_2020",
      names: { French: "Pikachu (Flying)", English: "Pikachu (Flying)" },
      identity: {
        canonicalId: "PIKACHU_COSTUME_2020",
        provider: "snacknap",
        rawAlias: "Pikachu (Flying)",
        assetResolution: {
          status: "matched",
          reason: null,
          assetBundle: "pokemon-assets/core/normal/0025-pikachu.assets.json",
          shinyImage: "https://assets.example/pm25.fCOSTUME_2020.s.icon.png",
          trace: {
            canonicalId: "PIKACHU_COSTUME_2020",
            selection: "canonical-costume-base:male",
          },
        },
      },
    },
    shiny: { odds: { numerator: 1, denominator: 133 } },
  };
  const base = {
    meta: { schemaVersion: 3 },
    summary: { today: 1, total: 1, rare: 1 },
    rankings: { today: [flyingPikachu], total: [flyingPikachu], rare: [flyingPikachu] },
  };

  const presented = adapter.present(base, { board: "today", search: "Flying", limit: "50" });

  assert.equal(presented.data.podium[0].pokemon.identity.canonicalId, "PIKACHU_COSTUME_2020");
  assert.equal(presented.data.rankings[0].pokemon.identity.assetResolution.status, "matched");
  assert.equal(
    presented.data.rankings[0].pokemon.identity.assetResolution.shinyImage,
    "https://assets.example/pm25.fCOSTUME_2020.s.icon.png",
  );
  assert.equal(
    presented.data.rankings[0].pokemon.identity.assetResolution.trace.selection,
    "canonical-costume-base:male",
  );
});

test("les snapshots Shiny historiques ne dupliquent que les métriques nécessaires", () => {
  const adapter = getCurrentDatasetAdapter("shiny");
  const compact = adapter.snapshotData({
    meta: { schemaVersion: 3 },
    rankings: {
      today: [{
        rank: 4,
        sourceIdentity: { id: "25", variantKey: "25_c28", name: "Pikachu" },
        pokemon: { id: "PIKACHU", formId: "PIKACHU_NORMAL", names: { French: "Pikachu" }, assets: { image: "large" } },
        stats: { daily: 4050000, monthly: 6550000 },
        shiny: { odds: { numerator: 1, denominator: 167 }, ratePercent: 0.6, seen: 1000 },
        diagnostics: ["large-field"],
      }],
    },
  });

  assert.deepEqual(compact.rankings.today[0], {
    rank: 4,
    sourceIdentity: { id: "25", variantKey: "25_c28" },
    pokemon: { id: "PIKACHU", formId: "PIKACHU_NORMAL" },
    stats: { daily: 4050000 },
    shiny: { odds: { numerator: 1, denominator: 167 }, ratePercent: 0.6 },
  });
  assert.equal(adapter.compressData, true);
  assert.equal(JSON.stringify(compact).includes("large-field"), false);
});
