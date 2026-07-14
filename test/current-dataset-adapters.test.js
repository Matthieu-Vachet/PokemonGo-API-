const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  getCurrentDatasetAdapter,
  summarizeShinyHistory,
} = require("../src/current-datasets/adapters");
const { computeDatasetHash } = require("../src/lib/current-dataset-hash");
const { dataPathFromRelative } = require("../src/lib/data-repository");

const DOMAINS = ["raids", "eggs", "max-battles", "research", "rocket", "shiny", "pvp-rankings", "best-attackers", "pokemon-identity-mappings"];

function localFixture(adapter) {
  return JSON.parse(fs.readFileSync(dataPathFromRelative(adapter.jsonPath), "utf8"));
}

test("les adaptateurs valident leurs fixtures locales sans en faire une source runtime", () => {
  for (const domain of DOMAINS) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.visibility, ["shiny", "pokemon-identity-mappings"].includes(domain) ? "private" : "public");
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
    "best-attackers": ["best_attackers", "rankings"],
    "pokemon-identity-mappings": ["pokemon_identity_mappings", "mappings"],
  };

  for (const [domain, [collection, rootKey]] of Object.entries(expected)) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.Model.collection.collectionName, collection);
    assert.equal(adapter.rootKey, rootKey);
  }
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
