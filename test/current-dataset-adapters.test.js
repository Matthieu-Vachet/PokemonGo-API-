const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const {
  getCurrentDatasetAdapter,
} = require("../src/current-datasets/adapters");
const { computeDatasetHash } = require("../src/lib/current-dataset-hash");
const { dataPathFromRelative } = require("../src/lib/data-repository");

const DOMAINS = ["raids", "eggs", "max-battles", "research", "rocket"];

function localFixture(adapter) {
  return JSON.parse(fs.readFileSync(dataPathFromRelative(adapter.jsonPath), "utf8"));
}

test("les cinq adaptateurs valident leurs fixtures locales sans en faire une source runtime", () => {
  for (const domain of DOMAINS) {
    const adapter = getCurrentDatasetAdapter(domain);
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
  };

  for (const [domain, [collection, rootKey]] of Object.entries(expected)) {
    const adapter = getCurrentDatasetAdapter(domain);
    assert.equal(adapter.Model.collection.collectionName, collection);
    assert.equal(adapter.rootKey, rootKey);
  }
});

test("l'identité Rocket distingue profil, slot et Pokémon", () => {
  const adapter = getCurrentDatasetAdapter("rocket");
  const data = localFixture(adapter);
  const entries = adapter.extractEntries(data);

  assert.ok(entries.some((entry) => entry.key.endsWith(":profile")));
  assert.ok(entries.some((entry) => /:slot[123]:/.test(entry.key)));
  assert.ok(entries.every((entry) => entry.key && entry.value));
});
