const test = require("node:test");
const assert = require("node:assert/strict");
const { createCurrentDatasetModel } = require("../src/models/current-dataset");

const MODEL_CONFIGS = [
  {
    model: require("../src/models/raid"),
    modelName: "Raid",
    collectionName: "raids",
    domain: "raids",
  },
  {
    model: require("../src/models/egg"),
    modelName: "Egg",
    collectionName: "eggs",
    domain: "eggs",
  },
  {
    model: require("../src/models/max-battle"),
    modelName: "MaxBattle",
    collectionName: "maxbattles",
    domain: "max-battles",
  },
  {
    model: require("../src/models/research"),
    modelName: "Research",
    collectionName: "researches",
    domain: "research",
  },
  {
    model: require("../src/models/rocket"),
    modelName: "Rocket",
    collectionName: "rockets",
    domain: "rocket",
  },
  {
    model: require("../src/models/shiny-ranking"),
    modelName: "ShinyRanking",
    collectionName: "shiny_rankings",
    domain: "shiny",
  },
  {
    model: require("../src/models/pvp-ranking"),
    modelName: "PvpRanking",
    collectionName: "pvp_rankings",
    domain: "pvp-rankings",
  },
];

const REQUIRED_FIELDS = [
  "key",
  "domain",
  "source",
  "generatedAt",
  "savedAt",
  "count",
  "sourceHash",
  "status",
  "data",
  "diagnostics",
];

test("les datasets current partagent le même contrat MongoDB", () => {
  for (const { model, collectionName, domain } of MODEL_CONFIGS) {
    assert.equal(model.collection.collectionName, collectionName);
    assert.equal(model.schema.options.timestamps, true);
    assert.equal(model.schema.options.strict, false);
    assert.equal(model.schema.options.minimize, false);
    assert.equal(model.schema.options.versionKey, false);
    assert.equal(model.schema.path("key").options.unique, true);
    assert.equal(model.schema.path("source").instance, "Mixed");
    assert.equal(model.schema.path("data").instance, "Mixed");
    assert.equal(model.schema.path("diagnostics").instance, "Mixed");
    assert.deepEqual(model.schema.path("domain").enumValues, [domain]);
    assert.deepEqual(model.schema.path("status").enumValues, ["success", "error"]);

    for (const field of REQUIRED_FIELDS) {
      assert.equal(model.schema.path(field).isRequired, true, `${domain}.${field}`);
    }

    assert.notEqual(model.schema.path("sourceFile").isRequired, true);

    const document = new model({
      key: "current",
      source: { provider: "test", url: "https://example.test" },
      generatedAt: new Date("2026-07-11T00:00:00.000Z"),
      savedAt: new Date("2026-07-11T00:00:01.000Z"),
      count: 0,
      sourceHash: "hash",
      status: "success",
      data: { items: [] },
      diagnostics: { warnings: [] },
    });

    assert.equal(document.domain, domain);
    assert.equal(document.validateSync(), undefined);
  }
});

test("le factory réutilise les modèles Mongoose déjà compilés", () => {
  for (const config of MODEL_CONFIGS) {
    assert.equal(
      createCurrentDatasetModel(config),
      config.model,
      config.modelName,
    );
  }
});

test("le statut current refuse les valeurs hors contrat", () => {
  const document = new MODEL_CONFIGS[0].model({
    key: "current",
    source: { provider: "test" },
    generatedAt: new Date(),
    savedAt: new Date(),
    count: 1,
    sourceHash: "hash",
    status: "failed",
    data: { items: [{}] },
    diagnostics: { warnings: [] },
  });

  const validation = document.validateSync();
  assert.equal(validation.errors.status.kind, "enum");
});
