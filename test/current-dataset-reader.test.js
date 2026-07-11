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

test("une erreur de requete MongoDB produit un 503 explicite", async () => {
  const result = await readCurrentDatasetFromMongo({
    model: {
      findOne() {
        return { lean: async () => { throw new Error("connection interrupted"); } };
      },
    },
    domain: "eggs",
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    body: {
      success: false,
      source: "mongodb",
      error: "MONGODB_UNAVAILABLE",
      message: "MongoDB n'est pas disponible pour le domaine eggs.",
      domain: "eggs",
    },
  });
});

test("un etat de connexion explicitement indisponible evite toute requete", async () => {
  let queried = false;
  const result = await readCurrentDatasetFromMongo({
    model: modelReturning(null, () => { queried = true; }),
    domain: "research",
    isConnected: false,
  });

  assert.equal(queried, false);
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.error, "MONGODB_UNAVAILABLE");
});
