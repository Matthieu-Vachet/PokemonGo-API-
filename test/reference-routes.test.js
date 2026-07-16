const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { createApp } = require("../src/app");
const { booleanQuery, dateRange, publicArchivedEvent, publicCommunityDay } = require("../src/services/reference-collections-service");

test("les projections publiques excluent payload source, hash et diagnostics internes", () => {
  const community = publicCommunityDay({ id: "cd", sourceId: "1", sourcePayload: { secret: true }, sourceHash: "hash", featuredPokemon: [], exclusiveMoves: [], bonuses: [] });
  const event = publicArchivedEvent({ id: "event", sourceId: "event", canonicalKey: "source:event", sourcePayload: { secret: true }, sourceHash: "hash", revisionHistory: [{ previousValues: { secret: true } }] });
  assert.equal("sourcePayload" in community, false);
  assert.equal("sourceHash" in community, false);
  assert.equal("sourcePayload" in event, false);
  assert.equal("revisionHistory" in event, false);
});

test("pagination et filtres booléens/date sont validés", () => {
  assert.equal(booleanQuery("true", "modified"), true);
  assert.equal(booleanQuery("false", "modified"), false);
  assert.throws(() => booleanQuery("yes", "modified"), /true ou false/);
  const range = dateRange("2024", "1");
  assert.equal(range.$gte.toISOString(), "2024-01-01T00:00:00.000Z");
  assert.equal(range.$lt.toISOString(), "2024-02-01T00:00:00.000Z");
});

test("OpenAPI expose uniquement les lectures Community Days et archive Events", async () => {
  const response = await request(createApp()).get("/api-docs.json");
  assert.equal(response.status, 200);
  for (const route of ["/api/v1/community-days", "/api/v1/community-days/{id}", "/api/v1/events/history", "/api/v1/events/history/{id}"]) {
    assert.ok(response.body.paths[route]?.get, `${route} doit documenter GET`);
    assert.deepEqual(Object.keys(response.body.paths[route]), ["get"]);
  }
  assert.equal(response.body.paths["/api/v1/admin/dynamax-images"], undefined);
});
