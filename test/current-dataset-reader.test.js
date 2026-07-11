const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MONGODB_SOURCE,
  readCurrentDatasetFromMongo,
} = require("../src/lib/current-dataset-reader");

function modelReturning(document, onFilter = () => {}) {
  return {
    findOne(filter) {
      onFilter(filter);
      return { lean: async () => document };
    },
  };
}

test("la lecture current cible toujours { key: current } et retourne MongoDB", async () => {
  const expected = { currentList: { mega: [] } };
  const result = await readCurrentDatasetFromMongo({
    model: modelReturning({ key: "current", data: expected }, (filter) => {
      assert.deepEqual(filter, { key: "current" });
    }),
    domain: "raids",
    isConnected: true,
  });

  assert.equal(MONGODB_SOURCE, "mongodb");
  assert.deepEqual(result, {
    ok: true,
    data: expected,
    document: { key: "current", data: expected },
  });
});

test("un document current absent produit une erreur explicite sans fallback", async () => {
  const result = await readCurrentDatasetFromMongo({
    model: modelReturning(null),
    domain: "max-battles",
    isConnected: true,
  });

  assert.deepEqual(result, {
    ok: false,
    status: 404,
    body: {
      success: false,
      source: "mongodb",
      error: "CURRENT_DATASET_NOT_FOUND",
      message: "Aucun dataset courant n'est disponible dans MongoDB pour le domaine max-battles.",
      domain: "max-battles",
    },
  });
});
