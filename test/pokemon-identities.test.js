const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const { PokemonIdentity, PokemonIdentityHistory } = require("../src/models");
const service = require("../src/services/pokemon-identity-service");

function validIdentity(overrides = {}) {
  return new PokemonIdentity({
    canonicalId: "PIKACHU_WORLD_CAP",
    pokemonId: 25,
    costume: "WORLD_CAP",
    status: "draft",
    aliases: [{ provider: "game-master", value: "PIKACHU_WORLD_CAP", normalizedValue: "pikachu_world_cap", status: "active", source: "manual" }],
    createdBy: "test",
    updatedBy: "test",
    ...overrides,
  });
}

test("le modèle Identity Manager expose les collections et index d'intégrité attendus", () => {
  assert.equal(PokemonIdentity.collection.collectionName, "pokemon_identities");
  assert.equal(PokemonIdentity.schema.path("canonicalId").options.unique, true);
  assert.deepEqual(PokemonIdentity.schema.path("status").enumValues, ["active", "draft", "deprecated", "ignored"]);
  const indexes = PokemonIdentity.schema.indexes();
  assert.ok(indexes.some(([fields, options]) => fields.canonicalId === 1 && options.unique));
  assert.ok(indexes.some(([fields, options]) => fields.activeAliasKeys === 1 && options.unique && options.partialFilterExpression));
  assert.ok(indexes.some(([fields, options]) => fields["localIdentity.identityKey"] === 1 && options.unique));
  assert.ok(indexes.some(([fields]) => fields["aliases.provider"] === 1 && fields["aliases.normalizedValue"] === 1));
});

test("un brouillon valide peut contenir plusieurs alias fournisseurs", async () => {
  const identity = validIdentity({
    aliases: [
      { provider: "game-master", value: "PIKACHU_WORLD_CAP", normalizedValue: "pikachu_world_cap", status: "active", source: "manual" },
      { provider: "leekduck", value: "pikachu-world-cap", normalizedValue: "pikachu_world_cap", status: "active", source: "manual" },
    ],
  });
  await identity.validate();
  assert.deepEqual(identity.activeAliasKeys.sort(), ["game-master:pikachu_world_cap", "leekduck:pikachu_world_cap"]);
});

test("le modèle refuse un alias vide et un doublon provider + valeur normalisée", async () => {
  await assert.rejects(validIdentity({ aliases: [{ provider: "", value: "", normalizedValue: "", status: "active", source: "manual" }] }).validate(), /alias/i);
  await assert.rejects(validIdentity({
    aliases: [
      { provider: "leekduck", value: "pikachu-world-cap", normalizedValue: "pikachu_world_cap", status: "active", source: "manual" },
      { provider: "leekduck", value: "PIKACHU WORLD CAP", normalizedValue: "pikachu_world_cap", status: "deprecated", source: "manual" },
    ],
  }).validate(), /dupliqué/i);
});

test("la normalisation conserve la valeur brute séparée de la clé de recherche", () => {
  const parsed = service.aliasInputSchema.parse({ provider: "Pokémon GO Hub", value: "Pikachu – World Cap" });
  assert.equal(parsed.value, "Pikachu – World Cap");
  assert.equal(parsed.provider, "pokemon-go-hub");
  assert.equal(service.normalizeAlias(parsed.value), "pikachu_world_cap");
});

test("la sérialisation expose un ObjectId MongoDB stable pour le CRUD et les clés UI", () => {
  const identifier = new mongoose.Types.ObjectId("6a59cba6cfe1e218e1356f3b");
  const serialized = service.serialize({
    _id: identifier,
    canonicalId: "MEWTWO_ARMORED",
    createdAt: new Date("2026-07-18T12:00:00.000Z"),
  });

  assert.equal(serialized._id, "6a59cba6cfe1e218e1356f3b");
  assert.equal(serialized.id, "6a59cba6cfe1e218e1356f3b");
  assert.equal(serialized.createdAt, "2026-07-18T12:00:00.000Z");
});

test("le resolver respecte exact, normalisé, déprécié, ambigu et inconnu", async () => {
  const originalFind = PokemonIdentity.find;
  const catalog = [
    {
      _id: "000000000000000000000001",
      canonicalId: "PIKACHU_WORLD_CAP",
      pokemonId: 25,
      status: "active",
      aliases: [
        { aliasId: "a", provider: "leekduck", value: "pikachu-world-cap", normalizedValue: "pikachu_world_cap", status: "active", confidence: 1 },
        { aliasId: "b", provider: "pvpoke", value: "old_cap", normalizedValue: "old_cap", status: "deprecated", confidence: 0.9 },
      ],
    },
  ];
  PokemonIdentity.find = () => ({ select: () => ({ lean: async () => catalog }) });
  try {
    service.invalidateIdentityCache();
    assert.equal((await service.resolveAlias({ provider: "leekduck", rawAlias: "pikachu-world-cap" })).strategy, "provider-exact");
    assert.equal((await service.resolveAlias({ provider: "leekduck", rawAlias: "PIKACHU WORLD CAP" })).strategy, "provider-normalized");
    assert.equal((await service.resolveAlias({ provider: "pvpoke", rawAlias: "old-cap" })).strategy, "known-deprecated-alias");
    assert.equal((await service.resolveAlias({ provider: "leekduck", rawAlias: "missing" })).status, "unmatched");
    catalog.push({ ...catalog[0], _id: "000000000000000000000002", canonicalId: "PIKACHU_OTHER_CAP" });
    service.invalidateIdentityCache();
    assert.equal((await service.resolveAlias({ provider: "leekduck", rawAlias: "pikachu-world-cap" })).status, "ambiguous");
  } finally {
    PokemonIdentity.find = originalFind;
    service.invalidateIdentityCache();
  }
});

test("la dépréciation et la restauration sont logiques, motivées et historisées", async () => {
  const identity = validIdentity({
    _id: "000000000000000000000025",
    canonicalId: "PIKACHU_NORMAL",
    pokemonId: 25,
    costume: null,
    status: "active",
  });
  identity.save = async () => identity;
  const originalFindById = PokemonIdentity.findById;
  const originalFindOne = PokemonIdentity.findOne;
  const originalHistoryCreate = PokemonIdentityHistory.create;
  const actions = [];
  PokemonIdentity.findById = async () => identity;
  PokemonIdentity.findOne = () => ({ select: () => ({ lean: async () => null }) });
  PokemonIdentityHistory.create = async (event) => { actions.push(event.action); return event; };
  try {
    await assert.rejects(service.deprecateIdentity(identity._id, "", "test"), /motif/i);
    const deprecated = await service.deprecateIdentity(identity._id, "Alias remplacé", "test");
    assert.equal(deprecated.status, "deprecated");
    assert.equal(deprecated.deprecationReason, "Alias remplacé");
    const restored = await service.restoreIdentity(identity._id, "test");
    assert.equal(restored.status, "active");
    assert.equal(restored.deprecationReason, null);
    assert.deepEqual(actions, ["deprecate", "restore"]);
  } finally {
    PokemonIdentity.findById = originalFindById;
    PokemonIdentity.findOne = originalFindOne;
    PokemonIdentityHistory.create = originalHistoryCreate;
  }
});

test("les routes Identity Manager sont privées et valident le serveur avant MongoDB", async () => {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "identity-test-secret";
  const { createApp } = require("../src/app");
  const app = createApp();
  try {
    await request(app).get("/api/v1/admin/pokemon-identities").expect(401);
    await request(app).get("/api/v1/admin/pokemon-identities/providers").expect(401);
    await request(app).get("/api/v1/admin/pokemon-identities/inventory").expect(401);
    await request(app).get("/api/v1/admin/pokemon-identities/sync/preview").expect(401);
    await request(app).post("/api/v1/admin/pokemon-identities/sync/apply").expect(401);
    await request(app).get("/api/v1/admin/pokemon-identities/diagnostics/summary").expect(401);
    await request(app).post("/api/v1/admin/pokemon-identities/diagnostics/reconcile").expect(401);
    await request(app).post("/api/v1/admin/pokemon-identities/resolve-assets").expect(401);
    await request(app)
      .post("/api/v1/admin/pokemon-identities")
      .set("x-api-admin-secret", "identity-test-secret")
      .send({ canonicalId: "", pokemonId: 0 })
      .expect(422);
    await request(app)
      .post("/api/v1/admin/pokemon-identities/resolve-assets")
      .set("x-api-admin-secret", "identity-test-secret")
      .send({ requests: [] })
      .expect(422);
    await request(app)
      .post("/api/v1/admin/pokemon-identities/diagnostics/batch")
      .set("x-api-admin-secret", "identity-test-secret")
      .send({ entries: [] })
      .expect(422);
  } finally {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  }
});
