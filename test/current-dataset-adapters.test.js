const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  getCurrentDatasetAdapter,
  summarizeShinyHistory,
} = require("../src/current-datasets/adapters");
const { computeDatasetHash } = require("../src/lib/current-dataset-hash");
const { dataPathFromRelative } = require("../src/lib/data-repository");

const DOMAINS = ["raids", "eggs", "max-battles", "research", "rocket", "shiny", "pvp-rankings"];

function localFixture(adapter) {
  return JSON.parse(fs.readFileSync(dataPathFromRelative(adapter.jsonPath), "utf8"));
}

test("les adaptateurs valident leurs fixtures locales sans en faire une source runtime", () => {
  for (const domain of DOMAINS) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.visibility, domain === "shiny" ? "private" : "public");
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
  };

  for (const [domain, [collection, rootKey]] of Object.entries(expected)) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.Model.collection.collectionName, collection);
    assert.equal(adapter.rootKey, rootKey);
  }
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
