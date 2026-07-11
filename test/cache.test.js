const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const request = require("supertest");
const {
  cacheMiddleware,
  clearCache,
  clearCacheByPrefix,
  invalidateDatasetCache,
} = require("../src/lib/cache");

test.afterEach(() => clearCache());

test("les GET current dynamiques contournent toujours le cache interne", async () => {
  const app = express();
  let reads = 0;
  app.use(cacheMiddleware({ ttlSeconds: 60 }));
  app.get("/api/v1/raids", (_request, response) => response.json({ reads: ++reads }));

  const first = await request(app).get("/api/v1/raids").expect(200);
  const second = await request(app).get("/api/v1/raids").expect(200);

  assert.equal(first.headers["x-cache"], "BYPASS");
  assert.equal(second.headers["x-cache"], "BYPASS");
  assert.match(first.headers["cache-control"], /no-store/);
  assert.equal(first.body.reads, 1);
  assert.equal(second.body.reads, 2);
});

test("l'invalidation cible une famille de clés sans supprimer les autres", async () => {
  const app = express();
  let raidReads = 0;
  let catalogReads = 0;
  app.use(cacheMiddleware({ ttlSeconds: 60 }));
  app.get("/api/v1/catalog-test", (_request, response) => response.json({ reads: ++catalogReads }));
  app.get("/api/v1/admin/raids/report", (_request, response) => response.json({ reads: ++raidReads }));

  await request(app).get("/api/v1/catalog-test").expect(200);
  await request(app).get("/api/v1/admin/raids/report").expect(200);
  assert.equal((await request(app).get("/api/v1/catalog-test")).headers["x-cache"], "HIT");
  assert.equal((await request(app).get("/api/v1/admin/raids/report")).headers["x-cache"], "HIT");

  assert.equal(invalidateDatasetCache("raids"), 1);
  assert.equal((await request(app).get("/api/v1/catalog-test")).headers["x-cache"], "HIT");
  assert.equal((await request(app).get("/api/v1/admin/raids/report")).headers["x-cache"], "MISS");
  assert.equal(clearCacheByPrefix("/api/v1/catalog-test"), 1);
});
