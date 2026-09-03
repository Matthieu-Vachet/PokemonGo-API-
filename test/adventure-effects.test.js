const assert = require("node:assert/strict");
const test = require("node:test");
const request = require("supertest");
const { createApp } = require("../src/app");

const app = createApp();

test("la synchronisation exige le secret et conserve les statuts et le rootDir runtime", async (t) => {
  const generator = require("../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateAdventureEffects.js");
  const { dataRoot } = require("../src/lib/data-repository");
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "adventure-effect-test-only";
  t.after(() => { if (previous === undefined) delete process.env.API_ADMIN_SECRET; else process.env.API_ADMIN_SECRET = previous; });
  await request(app).post("/api/v1/admin/adventure-effects/regenerate").expect(401);
  for (const status of ["SUCCESS", "PARTIAL", "FAILED"]) {
    const mock = t.mock.method(generator, "run", async (options) => {
      assert.equal(options.rootDir, dataRoot);
      assert.equal(options.write, false);
      return { status, effectsMapped: 11, effectsFound: 11, added: [], modified: [], removed: [], errors: [], warnings: [] };
    });
    const response = await request(app).post("/api/v1/admin/adventure-effects/regenerate").set("x-api-admin-secret", process.env.API_ADMIN_SECRET).expect(200);
    assert.equal(response.body.data.status, status);
    mock.mock.restore();
  }
});

test("GET /adventure-effects expose les 11 fiches hydratées", async () => {
  const response = await request(app).get("/api/v1/adventure-effects?locale=fr&limit=100").expect(200);
  assert.equal(response.body.meta.total, 11);
  assert.equal(response.body.data.length, 11);
  assert.equal(response.body.data.every((effect) => effect.move && effect.pokemon.length === 1), true);
});

test("GET /adventure-effects/:id résout ID, slug et locale", async () => {
  const byId = await request(app).get("/api/v1/adventure-effects/ADVENTURE_EFFECT_BEHEMOTH_BLADE?locale=fr").expect(200);
  assert.equal(byId.body.data.localized.name, "Gladius Maximus");
  assert.equal(byId.body.data.localized.fallbackUsed, false);
  const bySlug = await request(app).get("/api/v1/adventure-effects/behemoth-blade").expect(200);
  assert.equal(bySlug.body.data.moveRef, "BEHEMOTH_BLADE");
});

test("la locale française Méga-Mewtwo signale son fallback anglais", async () => {
  const response = await request(app).get("/api/v1/adventure-effects/mega-mewtwo-x?locale=fr").expect(200);
  assert.equal(response.body.data.localized.requestedLocale, "fr");
  assert.equal(response.body.data.localized.resolvedLocale, "en");
  assert.equal(response.body.data.localized.fallbackUsed, true);
  assert.equal(response.body.data.bonusEffects.raw, null);
});

test("la relation Pokémon respecte la forme exacte", async () => {
  const response = await request(app).get("/api/v1/pokemon/palkia-origin/adventure-effects?locale=fr&formId=PALKIA_ORIGIN").expect(200);
  assert.equal(response.body.meta.total, 1);
  assert.equal(response.body.data[0].id, "ADVENTURE_EFFECT_SPACIAL_REND");
  assert.equal(response.body.data[0].pokemon[0].formId, "PALKIA_ORIGIN");
});

test("la relation Move hydrate le Pokémon et l’effet", async () => {
  const response = await request(app).get("/api/v1/moves/dynamic-punch-plus/adventure-effect").expect(200);
  assert.equal(response.body.data.id, "ADVENTURE_EFFECT_MEGA_MEWTWO_X");
  assert.equal(response.body.data.pokemon[0].formId, "MEWTWO_MEGA_X");
});

test("les IDs manquants, malformés et Moves sans effet ont des erreurs dédiées", async () => {
  assert.equal((await request(app).get("/api/v1/adventure-effects/missing").expect(404)).body.error.code, "ADVENTURE_EFFECT_NOT_FOUND");
  assert.equal((await request(app).get("/api/v1/adventure-effects/bad%20id").expect(400)).body.error.code, "ADVENTURE_EFFECT_ID_INVALID");
  assert.equal((await request(app).get("/api/v1/moves/tackle-fast/adventure-effect").expect(404)).body.error.code, "MOVE_ADVENTURE_EFFECT_NOT_FOUND");
  assert.equal((await request(app).get("/api/v1/adventure-effects?locale=it").expect(400)).body.error.code, "ADVENTURE_EFFECT_LOCALE_INVALID");
});
