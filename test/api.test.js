const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { normalizeLeague } = require("../src/lib/pvp");
const { buildPokemonFilter } = require("../src/services/pokemon-service");
const { presentPokemon } = require("../src/services/pokemon-presenter");
const { collectAllDocuments } = require("../src/sync/source-reader");
const {
  buildChecklist,
  detailForKey,
} = require("../apps/checklist/server/engine");

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
  assert.doesNotMatch(response.text, /native-scrollbars/);
  assert.match(response.text, /redoc\/v2\.5\.0/);
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
  assert.ok(data.pokemon.every((pokemon) => Array.isArray(pokemon.data.quickMoves)));
});

test("les types, PvP null et formes Max sont normalisés", () => {
  const data = collectAllDocuments();
  const caterpie = data.pokemon.find((pokemon) => pokemon.key === "CATERPIE");
  const dynamax = data.pokemon.find((pokemon) => pokemon.key === "BULBASAUR_DYNAMAX");
  const gmax = data.pokemon.find((pokemon) => pokemon.key === "VENUSAUR_GIGANTAMAX");
  assert.equal(caterpie.data.primaryType, "BUG");
  assert.equal(caterpie.data.secondaryType, null);
  assert.deepEqual(caterpie.pvpLeagues, []);
  assert.equal(dynamax.kind, "dynamax");
  assert.deepEqual(dynamax.maxMoveIds, ["MAX_OVERGROWTH", "MAX_STRIKE"]);
  assert.deepEqual(Object.keys(dynamax.maxCp).sort(), [
    "maxBattlesLevel20",
    "maxLevel40",
    "maxLevel50",
  ]);
  assert.equal(dynamax.maxCp.raidLevel20, undefined);
  assert.deepEqual(dynamax.moveIds, []);
  assert.deepEqual(dynamax.pvpLeagues, []);
  assert.equal(gmax.kind, "gigantamax");
  assert.deepEqual(gmax.maxMoveIds, ["GMAX_VINE_LASH"]);
  assert.deepEqual(Object.keys(gmax.maxCp).sort(), [
    "maxBattlesLevel20",
    "maxLevel40",
    "maxLevel50",
  ]);
  assert.ok(data.moves.some((move) => move.kind === "max"));
  assert.ok(data.moves.some((move) => move.kind === "gmax"));
});

test("la checklist affiche les formes Max héritées sans dupliquer leur source", () => {
  const checklist = buildChecklist();
  const dynamax = checklist.find((entry) => entry.kind === "dynamax");
  assert.equal(dynamax.name, "Bulbizarre");
  assert.equal(dynamax.primaryType, "GRASS");
  assert.ok(dynamax.image);
  assert.equal(dynamax.maxMoveCount, 2);
  assert.equal(dynamax.complete, true);

  const detail = detailForKey(dynamax.key);
  assert.equal(detail.names.French, "Bulbizarre");
  assert.equal(detail.sourceData.inherits, "BULBASAUR");
  assert.equal(detail.sourceData.slug, undefined);
  assert.deepEqual(detail.maxCp, detail.sourceData.maxCp);
  assert.equal(detail.maxCp.raidLevel20, undefined);
  assert.deepEqual(detail.quickMoves, []);
  assert.deepEqual(detail.cinematicMoves, []);
  assert.equal(detail.pvp, null);
  assert.deepEqual(
    Object.values(detail.moveDetails.maxMoves).map((move) => move.id),
    ["MAX_OVERGROWTH", "MAX_STRIKE"],
  );
});

test("les anciennes attaques embarquées sont présentées comme références", () => {
  const pokemon = presentPokemon({
    data: {
      quickMoves: {
        VINE_WHIP_FAST: { id: "VINE_WHIP_FAST", power: 6 },
      },
      cinematicMoves: ["POWER_WHIP"],
    },
  });
  assert.deepEqual(pokemon.data.quickMoves, ["VINE_WHIP_FAST"]);
  assert.deepEqual(pokemon.data.cinematicMoves, ["POWER_WHIP"]);
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
