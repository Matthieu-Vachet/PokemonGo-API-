const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const { createCurrentDatasetRouter } = require("../src/current-datasets/router");
const {
  buildDiagnostics,
  datasetRunStatus,
  importCurrentDataset,
  serializeDatasetRun,
  sourceMetadata,
  staleDatasetRunUpdate,
  unmatchedEntriesFromReport,
} = require("../src/lib/current-dataset-pipeline");
const { errorHandler } = require("../src/middleware/errors");

function clone(value) {
  return value === null || value === undefined ? value : structuredClone(value);
}

function createMemoryModel(initialDocument = null, options = {}) {
  let storedDocument = clone(initialDocument);
  let readCount = 0;
  const findFilters = [];
  const updateCalls = [];

  return {
    findFilters,
    updateCalls,
    get readCount() {
      return readCount;
    },
    get storedDocument() {
      return clone(storedDocument);
    },
    findOne(filter) {
      findFilters.push(clone(filter));
      return {
        lean: async () => {
          readCount += 1;
          const document = clone(storedDocument);
          return readCount > 1 && options.transformReadback
            ? options.transformReadback(document)
            : document;
        },
      };
    },
    findOneAndUpdate(filter, update, writeOptions) {
      updateCalls.push({
        filter: clone(filter),
        update: clone(update),
        options: clone(writeOptions),
      });

      storedDocument = {
        ...(storedDocument || {}),
        ...clone(update.$set || {}),
      };
      for (const field of Object.keys(update.$unset || {})) {
        delete storedDocument[field];
      }

      return {
        // Le pipeline ne doit pas prendre le résultat de l'upsert pour une relecture.
        lean: async () => ({ key: "decoy-returned-by-findOneAndUpdate" }),
      };
    },
  };
}

function createAdapter(Model) {
  return {
    domain: "test-domain",
    visibility: "public",
    rootKey: "items",
    metaKey: "summary",
    provider: "manual-test",
    sourceUrl: "https://example.test/current",
    Model,
    summarize(data) {
      return { total: Array.isArray(data?.items) ? data.items.length : 0 };
    },
    stats(data) {
      const items = Array.isArray(data?.items) ? data.items : [];
      const matched = items.filter((item) => item.matched !== false).length;
      return {
        itemsParsed: items.length,
        itemsMatched: matched,
        itemsUnmatched: items.length - matched,
      };
    },
    validate(data) {
      assert.ok(Array.isArray(data?.items), "le payload du test doit contenir items[]");
    },
    count(data) {
      return data.items.length;
    },
    extractEntries(data) {
      return data.items.map((item) => ({ key: item.id, value: item }));
    },
  };
}

test("normalise les non-matchés en diagnostics détaillés et dédupliqués", () => {
  const entries = unmatchedEntriesFromReport({
    resolutionReport: {
      details: [
        {
          status: "ambiguous",
          sourceId: "PIKACHU_FALL_2019",
          sourceName: "Pikachu",
          sourceForm: "PIKACHU_NORMAL",
          sourceCostume: "FALL_2019",
          sourceImage: "pikachu.png",
          ambiguousCandidates: [{ costume: "FALL_2019" }, { costume: "WINTER_2020" }],
          localFile: "pokemon/0025-pikachu.json",
        },
        {
          status: "ambiguous",
          sourceId: "PIKACHU_FALL_2019",
          sourceName: "Pikachu",
          sourceForm: "PIKACHU_NORMAL",
          sourceCostume: "FALL_2019",
        },
      ],
    },
    unmatchedItems: ["Rare Candy XL"],
  });

  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], {
    sourceId: "PIKACHU_FALL_2019",
    sourceName: "Pikachu",
    sourceForm: "PIKACHU_NORMAL",
    sourceCostume: "FALL_2019",
    sourceImage: "pikachu.png",
    reason: "ambiguous",
    candidates: [{ costume: "FALL_2019" }, { costume: "WINTER_2020" }],
    localFile: "pokemon/0025-pikachu.json",
    sourcePayload: {
      status: "ambiguous",
      sourceId: "PIKACHU_FALL_2019",
      sourceName: "Pikachu",
      sourceForm: "PIKACHU_NORMAL",
      sourceCostume: "FALL_2019",
      sourceImage: "pikachu.png",
      ambiguousCandidates: [{ costume: "FALL_2019" }, { costume: "WINTER_2020" }],
      localFile: "pokemon/0025-pikachu.json",
    },
  });
  assert.equal(entries[1].sourceName, "Rare Candy XL");
  assert.equal(entries[1].reason, "missing-local-item");
});

test("le rapport PvP expose séparément génération, ignorés, MAPPING_MISSING et WARNING", () => {
  const diagnostics = buildDiagnostics({
    report: {
      mappingMissingCount: 13,
      ignoredCount: 2,
      warnings: ["MOVE_UNMATCHED"],
    },
    stats: { itemsParsed: 120, itemsMatched: 107, itemsUnmatched: 13 },
    diff: { changed: true, added: 4, removed: 0, modified: 1 },
  });

  assert.equal(diagnostics.parsedCount, 120);
  assert.equal(diagnostics.mappingMissingCount, 13);
  assert.equal(diagnostics.ignoredCount, 2);
  assert.equal(diagnostics.warningsCount, 2);

  const run = serializeDatasetRun({
    _id: "run-partial",
    datasetKey: "pvp-rankings",
    status: "partial",
    totalAfter: 120,
    matchedCount: 107,
    unmatchedCount: 13,
    mappingMissingCount: diagnostics.mappingMissingCount,
    ignoredCount: diagnostics.ignoredCount,
    warningsCount: diagnostics.warningsCount,
  });
  assert.deepEqual(
    {
      status: run.status,
      generated: run.totalAfter,
      mappingMissing: run.mappingMissingCount,
      ignored: run.ignoredCount,
      warnings: run.warningsCount,
    },
    { status: "partial", generated: 120, mappingMissing: 13, ignored: 2, warnings: 2 },
  );
  assert.equal(
    datasetRunStatus({ unmatchedCount: 13, warnings: ["MAPPING_MISSING"] }, { changed: false }),
    "partial",
    "un second passage inchangé reste partiel tant que ses diagnostics subsistent",
  );
  assert.equal(datasetRunStatus({ mappingMissingCount: 13, warningsCount: 0 }, { changed: false }), "partial");
  assert.equal(datasetRunStatus({ mappingMissingCount: 0, warningsCount: 2 }, { changed: false }), "partial");
  assert.equal(datasetRunStatus({ unmatchedCount: 0, warnings: [] }, { changed: false }), "unchanged");
});

test("le pipeline upsert current, nettoie sourceFile et relit réellement MongoDB", async () => {
  const Model = createMemoryModel({
    key: "current",
    sourceFile: "data/legacy/current.json",
    data: {
      items: [
        { id: "kept", value: 1 },
        { id: "changed", value: 1 },
        { id: "removed", value: 1 },
      ],
    },
  });
  const adapter = createAdapter(Model);
  const data = {
    items: [
      { id: "kept", value: 1 },
      { id: "changed", value: 2, matched: false },
      { id: "added", value: 1 },
    ],
  };

  const result = await importCurrentDataset(adapter, data);

  assert.equal(Model.updateCalls.length, 1);
  const [write] = Model.updateCalls;
  assert.deepEqual(write.filter, { key: "current" });
  assert.deepEqual(write.update.$unset, { sourceFile: "", compressedData: "" });
  assert.deepEqual(write.options, {
    upsert: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  });

  const written = write.update.$set;
  assert.equal(written.key, "current");
  assert.equal(written.domain, "test-domain");
  assert.deepEqual(
    {
      provider: written.source.provider,
      url: written.source.url,
      mode: written.source.mode,
      event: written.source.event,
    },
    { provider: "manual", url: null, mode: "maintenance", event: null },
  );
  assert.ok(written.source.fetchedAt instanceof Date);
  assert.ok(written.generatedAt instanceof Date);
  assert.ok(written.savedAt instanceof Date);
  assert.equal(written.count, 3);
  assert.match(written.sourceHash, /^[a-f0-9]{64}$/);
  assert.equal(written.status, "success");
  assert.deepEqual(written.data, data);
  assert.deepEqual(
    {
      rawCount: written.diagnostics.rawCount,
      parsedCount: written.diagnostics.parsedCount,
      matchedCount: written.diagnostics.matchedCount,
      unmatchedCount: written.diagnostics.unmatchedCount,
      warnings: written.diagnostics.warnings,
    },
    {
      rawCount: 3,
      parsedCount: 3,
      matchedCount: 2,
      unmatchedCount: 1,
      warnings: ["1 entree(s) non matchee(s) conservee(s)."],
    },
  );
  assert.deepEqual(
    {
      changed: written.diagnostics.diff.changed,
      added: written.diagnostics.diff.added,
      removed: written.diagnostics.diff.removed,
      modified: written.diagnostics.diff.modified,
    },
    { changed: true, added: 1, removed: 1, modified: 1 },
  );
  assert.match(written.diagnostics.diff.previousHash, /^[a-f0-9]{64}$/);
  assert.equal(written.diagnostics.diff.newHash, written.sourceHash);

  assert.equal(Model.readCount, 2, "une lecture avant et une relecture après l'upsert");
  assert.deepEqual(Model.findFilters, [{ key: "current" }, { key: "current" }]);
  assert.equal(Model.storedDocument.sourceFile, undefined);
  assert.equal(result.current.key, "current");
  assert.notEqual(result.current.key, "decoy-returned-by-findOneAndUpdate");
  assert.equal(result.current.sourceHash, written.sourceHash);
  assert.equal(result.current.count, 3);
});

test("un import identique est idempotent et ne fabrique aucun changement", async () => {
  const data = {
    items: [
      { id: "alpha", nested: { name: "Alpha", updatedAt: "old" } },
      { id: "beta", value: 2 },
    ],
  };
  const Model = createMemoryModel({
    key: "current",
    count: 2,
    sourceHash: "legacy-hash",
    data,
  });
  const adapter = createAdapter(Model);

  const result = await importCurrentDataset(adapter, {
    items: [
      { id: "beta", value: 2 },
      { id: "alpha", nested: { updatedAt: "new", name: "Alpha" } },
    ],
  });

  assert.deepEqual(
    {
      changed: result.current.diagnostics.diff.changed,
      added: result.current.diagnostics.diff.added,
      removed: result.current.diagnostics.diff.removed,
      modified: result.current.diagnostics.diff.modified,
    },
    { changed: false, added: 0, removed: 0, modified: 0 },
  );
  assert.equal(
    result.current.diagnostics.diff.previousHash,
    result.current.diagnostics.diff.newHash,
  );
});

test("un dataset volumineux peut être compressé puis vérifié après relecture MongoDB", async () => {
  const Model = createMemoryModel();
  const adapter = { ...createAdapter(Model), compressData: true };
  const data = { items: Array.from({ length: 250 }, (_, index) => ({ id: `entry-${index}`, label: "payload répétitif" })) };

  const result = await importCurrentDataset(adapter, data);
  const stored = Model.storedDocument;

  assert.deepEqual(stored.data, { compressed: true, encoding: "gzip+json", schemaVersion: 1 });
  assert.ok(stored.compressedData, "le payload gzip doit être stocké séparément");
  assert.deepEqual(result.current.data, data, "la relecture doit hydrater le JSON avant le contrôle du hash");
  assert.equal(result.current.compressedData, undefined, "le binaire interne ne doit jamais sortir dans l'API");
});

test("la vérification échoue si le hash de la relecture MongoDB est corrompu", async () => {
  const Model = createMemoryModel(null, {
    transformReadback(document) {
      return { ...document, sourceHash: "corrupted" };
    },
  });

  await assert.rejects(
    () => importCurrentDataset(createAdapter(Model), { items: [{ id: "alpha" }] }),
    (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.code, "TEST_DOMAIN_READBACK_HASH_MISMATCH");
      assert.match(error.message, /hash relu/i);
      return true;
    },
  );
  assert.equal(Model.readCount, 2);
});

test("la vérification échoue si le count de la relecture MongoDB est corrompu", async () => {
  const Model = createMemoryModel(null, {
    transformReadback(document) {
      return { ...document, count: document.count + 1 };
    },
  });

  await assert.rejects(
    () => importCurrentDataset(createAdapter(Model), { items: [{ id: "alpha" }] }),
    (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.code, "TEST_DOMAIN_READBACK_COUNT_MISMATCH");
      assert.match(error.message, /nombre relu/i);
      return true;
    },
  );
  assert.equal(Model.readCount, 2);
});

test("la route d'import refuse un chemin local et n'essaie aucun fallback", async () => {
  const previousSecret = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "pipeline-test-secret";
  const Model = createMemoryModel();
  const app = express();
  app.use(express.json());
  app.use("/datasets", createCurrentDatasetRouter(createAdapter(Model)));
  app.use(errorHandler);

  try {
    const response = await request(app)
      .post("/datasets/import")
      .set("x-api-admin-secret", "pipeline-test-secret")
      .send({ sourceFile: "data/test-domain/current.json" });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "CURRENT_IMPORT_PAYLOAD_REQUIRED");
    assert.match(response.body.error.message, /payload explicite/i);
    assert.equal(Model.readCount, 0);
    assert.equal(Model.updateCalls.length, 0);
  } finally {
    if (previousSecret === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previousSecret;
  }
});

test("une régénération longue répond 202 puis expose son statut persistant", async () => {
  const previousSecret = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "pipeline-test-secret";
  const adapter = { ...createAdapter(createMemoryModel()), asyncRegeneration: true };
  const scheduled = [];
  const run = {
    id: "run-pvp-1",
    datasetKey: adapter.domain,
    status: "running",
    startedAt: "2026-07-22T00:00:00.000Z",
  };
  const app = express();
  app.use(express.json());
  app.use("/datasets", createCurrentDatasetRouter(adapter, {
    enqueueRegeneration: async () => ({ alreadyRunning: false, run, task: Promise.resolve() }),
    readRegeneration: async (_adapter, runId) => ({
      run: { ...run, id: runId, status: "success", phase: "completed", durationMs: 72_000 },
      task: Promise.resolve(),
    }),
    scheduleTask: (task) => scheduled.push(task),
  }));
  app.use(errorHandler);

  try {
    const accepted = await request(app)
      .post("/datasets/regenerate")
      .set("x-api-admin-secret", "pipeline-test-secret");
    assert.equal(accepted.status, 202);
    assert.equal(accepted.body.data.accepted, true);
    assert.equal(accepted.body.data.run.id, "run-pvp-1");
    assert.equal(accepted.body.data.statusPath, "/api/v1/admin/test-domain/regenerate/run-pvp-1");
    assert.equal(scheduled.length, 1);

    const completed = await request(app)
      .get("/datasets/regenerate/run-pvp-1")
      .set("x-api-admin-secret", "pipeline-test-secret");
    assert.equal(completed.status, 200);
    assert.equal(completed.body.data.status, "success");
    assert.equal(completed.body.data.phase, "completed");
    assert.equal(completed.body.data.durationMs, 72_000);
    assert.equal(scheduled.length, 2);
  } finally {
    if (previousSecret === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previousSecret;
  }
});

test("une exécution interrompue par la limite Vercel devient un échec terminal", () => {
  const update = staleDatasetRunUpdate({
    status: "running",
    startedAt: "2026-07-22T00:00:00.000Z",
  }, new Date("2026-07-22T00:01:16.000Z").getTime());

  assert.equal(update.status, "failed");
  assert.equal(update.durationMs, 76_000);
  assert.equal(update.errorsCount, 1);
  assert.equal(update.errors[0].code, "DATASET_REGENERATION_TIMEOUT");
  assert.equal(staleDatasetRunUpdate({
    status: "running",
    startedAt: "2026-07-22T00:00:01.000Z",
  }, new Date("2026-07-22T00:01:16.000Z").getTime()), null);
  assert.equal(staleDatasetRunUpdate({
    status: "running",
    phase: "generated",
    startedAt: "2026-07-22T00:00:00.000Z",
  }, new Date("2026-07-22T00:10:00.000Z").getTime()), null);
});

test("les raids refusent toute URL événementielle secondaire", () => {
  const adapter = {
    domain: "raids",
    provider: "leekduck",
    sourceUrl: "https://leekduck.com/raid-bosses/",
    strictSourceUrl: true,
  };

  const source = sourceMetadata(adapter, {
    source: "https://leekduck.com/raid-bosses/",
    sourceMode: "event",
    event: { name: "Fixture Event" },
  }, new Date("2026-07-11T00:00:00.000Z"));
  assert.equal(source.url, "https://leekduck.com/raid-bosses/");
  assert.equal(source.mode, "event");
  assert.equal(source.event.name, "Fixture Event");

  assert.throws(
    () => sourceMetadata(adapter, { source: "https://leekduck.com/gofest/raids/" }),
    (error) => error.code === "RAIDS_SOURCE_URL_MISMATCH" && error.status === 502,
  );
});
