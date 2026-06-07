const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { normalizeLeague } = require("../src/lib/pvp");
const { buildPokemonFilter } = require("../src/services/pokemon-service");
const { collectAllDocuments } = require("../src/sync/source-reader");

const app = createApp();

test("GET / présente l'API", async () => {
  const response = await request(app).get("/").expect(200);
  assert.equal(response.body.data.name, "Pokémon GO API");
  assert.equal(response.body.data.api, "/api/v1");
});

test("GET /api/v1 présente les routes v1", async () => {
  const response = await request(app).get("/api/v1").expect(200);
  assert.equal(response.body.data.version, "v1");
  assert.match(response.body.data.routes.pokemon, /pokemon/);
});

test("GET /api-docs.json fournit OpenAPI 3", async () => {
  const response = await request(app).get("/api-docs.json").expect(200);
  assert.equal(response.body.openapi, "3.0.3");
  assert.ok(response.body.paths["/api/v1/pokemon"]);
  assert.ok(response.body.paths["/api/v1/pvp/{league}/{identifier}"]);
});

test("GET /api-docs fournit la documentation Redoc", async () => {
  const response = await request(app).get("/api-docs").expect(200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.text, /<redoc/);
  assert.match(response.text, /cdn\.redoc\.ly/);
  assert.match(response.text, /scroll-y-offset="\.topbar"/);
});

test("GET /swagger fournit Swagger UI", async () => {
  const response = await request(app).get("/swagger/").expect(200);
  assert.match(response.text, /SwaggerUIBundle/);
  assert.match(response.text, /unpkg\.com\/swagger-ui-dist/);
});

test("GET /health indique un état dégradé sans MongoDB", async () => {
  const response = await request(app).get("/health").expect(503);
  assert.equal(response.body.data.status, "degraded");
});

test("une route inconnue retourne une erreur structurée", async () => {
  const response = await request(app).get("/inconnue").expect(404);
  assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
  assert.ok(response.body.error.requestId);
});

test("les sources JSON sont lisibles et dédupliquées", () => {
  const data = collectAllDocuments();
  assert.ok(data.pokemon.length >= 1000);
  assert.ok(data.moves.length >= 250);
  assert.equal(data.types.length, 18);
  assert.equal(new Set(data.pokemon.map((pokemon) => pokemon.key)).size, data.pokemon.length);
});

test("les alias de ligue PvP sont normalisés", () => {
  assert.equal(normalizeLeague("great"), "greatLeague");
  assert.equal(normalizeLeague("MASTERLEAGUE"), "masterLeague");
  assert.throws(() => normalizeLeague("inconnue"), /Ligue PvP invalide/);
});

test("les filtres numériques invalides sont refusés", () => {
  assert.throws(() => buildPokemonFilter({ maxCpMin: "abc" }), /Valeur numérique invalide/);
  assert.throws(
    () => buildPokemonFilter({ catchRateMin: "10", catchRateMax: "5" }),
    /inférieur ou égal/,
  );
});
