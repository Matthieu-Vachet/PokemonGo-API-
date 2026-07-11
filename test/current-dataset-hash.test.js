const test = require("node:test");
const assert = require("node:assert/strict");
const {
  canonicalize,
  computeDatasetHash,
  diffDatasets,
} = require("../src/lib/current-dataset-hash");

const extractItems = (dataset) => dataset.items;
const getId = (entry) => entry.id;

test("canonicalize trie les cles, exclut les dates techniques recursivement et preserve les tableaux", () => {
  const value = {
    z: 3,
    generatedAt: "2026-07-11T01:00:00.000Z",
    nested: [
      { updatedAt: "2026-07-11T01:00:00.000Z", b: 2, a: 1 },
      ["rotation-2", "rotation-1"],
    ],
    a: {
      savedAt: "2026-07-11T01:00:00.000Z",
      fetchedAt: "2026-07-11T01:00:00.000Z",
      createdAt: "2026-07-11T01:00:00.000Z",
      value: true,
    },
  };

  const result = canonicalize(value);

  assert.equal(
    JSON.stringify(result),
    '{"a":{"value":true},"nested":[{"a":1,"b":2},["rotation-2","rotation-1"]],"z":3}',
  );
  assert.equal(value.generatedAt, "2026-07-11T01:00:00.000Z");
  assert.equal(value.nested[0].updatedAt, "2026-07-11T01:00:00.000Z");
});

test("computeDatasetHash est stable malgre l'ordre des entrees, des cles et les dates techniques", () => {
  const first = {
    items: [
      { id: "beta", stats: { attack: 8, defense: 7 }, generatedAt: "old" },
      { id: "alpha", types: ["grass", "poison"], savedAt: "old" },
    ],
  };
  const reordered = {
    items: [
      { savedAt: "new", types: ["grass", "poison"], id: "alpha" },
      { fetchedAt: "new", stats: { defense: 7, attack: 8 }, id: "beta" },
    ],
  };

  const firstHash = computeDatasetHash(first, { extractEntries: extractItems, getIdentity: getId });
  const reorderedHash = computeDatasetHash(reordered, { extractEntries: extractItems, getIdentity: getId });

  assert.match(firstHash, /^[a-f0-9]{64}$/);
  assert.equal(reorderedHash, firstHash);
});

test("computeDatasetHash accepte des entrees { key, value } sans getIdentity", () => {
  const extractKeyedEntries = (dataset) => dataset.groups.flatMap((group) => (
    group.entries.map((entry) => ({ key: `${group.tier}:${entry.id}`, value: entry }))
  ));
  const dataset = {
    groups: [
      { tier: "mega", entries: [{ id: 6, form: "mega_x" }] },
      { tier: "lvl5", entries: [{ id: 150, form: "normal" }] },
    ],
  };
  const reversed = { groups: [...dataset.groups].reverse() };

  assert.equal(
    computeDatasetHash(dataset, { extractEntries: extractKeyedEntries }),
    computeDatasetHash(reversed, { extractEntries: extractKeyedEntries }),
  );
});

test("l'ordre des tableaux imbriques reste significatif par defaut", () => {
  const first = { items: [{ id: "raid", rotations: ["morning", "afternoon"] }] };
  const reversed = { items: [{ id: "raid", rotations: ["afternoon", "morning"] }] };

  assert.notEqual(
    computeDatasetHash(first, extractItems, getId),
    computeDatasetHash(reversed, extractItems, getId),
  );
});

test("les identites dupliquees sont conservees sans rendre l'ordre top-level significatif", () => {
  const first = {
    items: [
      { id: "same", rotation: "morning" },
      { id: "same", rotation: "afternoon" },
      { id: "same", rotation: "afternoon" },
    ],
  };
  const reordered = { items: [...first.items].reverse() };
  const oneDuplicateRemoved = { items: first.items.slice(0, 2) };
  const options = { extractEntries: extractItems, getIdentity: getId };

  assert.equal(computeDatasetHash(first, options), computeDatasetHash(reordered, options));
  assert.notEqual(computeDatasetHash(first, options), computeDatasetHash(oneDuplicateRemoved, options));

  const diff = diffDatasets(first, oneDuplicateRemoved, options);
  assert.equal(diff.added, 0);
  assert.equal(diff.removed, 1);
  assert.equal(diff.modified, 0);
});

test("diffDatasets detecte les ajouts, retraits et modifications avec des hashes coherents", () => {
  const previous = {
    items: [
      { id: "kept", cp: [10, 20] },
      { id: "changed", cp: [30, 40] },
      { id: "removed", cp: [50, 60] },
    ],
  };
  const next = {
    items: [
      { id: "added", cp: [70, 80] },
      { id: "changed", cp: [31, 41] },
      { id: "kept", cp: [10, 20] },
    ],
  };
  const options = { extractEntries: extractItems, getIdentity: getId };

  const diff = diffDatasets(previous, next, options);

  assert.equal(diff.changed, true);
  assert.equal(diff.previousHash, computeDatasetHash(previous, options));
  assert.equal(diff.newHash, computeDatasetHash(next, options));
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.equal(diff.modified, 1);
});

test("une modification limitee aux dates techniques ne produit aucun changement", () => {
  const previous = {
    items: [{ id: 1, nested: { createdAt: "old", name: "Bulbasaur" } }],
  };
  const next = {
    items: [{ id: 1, nested: { createdAt: "new", name: "Bulbasaur" }, updatedAt: "new" }],
  };

  const diff = diffDatasets(previous, next, { extractEntries: extractItems, getIdentity: getId });

  assert.equal(diff.changed, false);
  assert.equal(diff.previousHash, diff.newHash);
  assert.equal(diff.added, 0);
  assert.equal(diff.removed, 0);
  assert.equal(diff.modified, 0);
});
