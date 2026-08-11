const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("../src/app");
const { dataPath } = require("../src/lib/data-repository");
const {
  changeRows,
  compactTemplateDocument,
  comparisonDocument,
  escapedRegex,
  isExpiredOrphan,
  pageOptions,
  snapshotIdFor,
  storageError,
} = require("../src/services/game-master-explorer-service");
const { structuredDiff } = require(dataPath("tooling", "lib", "game-master-explorer.js"));

test("échappe les recherches Game Master avant toute regex MongoDB", () => {
  assert.equal(escapedRegex("PIKACHU.*(COPY)"), "PIKACHU\\.\\*\\(COPY\\)");
  assert.throws(() => escapedRegex("x".repeat(121)), /limitée/);
});

test("borne la pagination serveur", () => {
  assert.deepEqual(pageOptions({ page: "0", limit: "10000" }), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(pageOptions({ page: "3", limit: "25" }), { page: 3, limit: 25, skip: 50 });
});

test("crée un identifiant de snapshot stable et lisible", () => {
  assert.equal(snapshotIdFor("abcdef0123456789", new Date("2026-07-15T01:02:03.000Z")), "gm-20260715010203-abcdef012345");
});

test("compacte les templates MongoDB sans dupliquer l’index de propriétés", () => {
  const compact = compactTemplateDocument({
    templateId: "V0001_POKEMON_BULBASAUR",
    category: "pokemon/pokemon-settings",
    categorySlug: "pokemon-settings",
    categoryLabel: "Pokémon Settings",
    categoryGroup: "pokemon",
    categoryGroupLabel: "Pokémon",
    settingType: "pokemonSettings",
    pokemonId: { accidental: "object" },
    numericPokemonId: 1,
    form: "BULBASAUR_NORMAL",
    costume: null,
    itemId: null,
    moveId: null,
    assetBundleValue: null,
    assetBundleSuffix: null,
    searchTokens: Array.from({ length: 2_000 }, (_, index) => `token-${index}`),
    flattenedPaths: [{ path: "data.value", value: "duplicated" }],
    flattenedText: "duplicated",
    propertyCount: 2,
    sizeBytes: 100,
    sourceHash: "hash",
    sourceUpdatedAt: null,
    indexSchemaVersion: 1,
    raw: { templateId: "V0001_POKEMON_BULBASAUR", data: { value: true } },
  });
  assert.equal(compact.pokemonId, null);
  assert.equal(compact.numericPokemonId, 1);
  assert.equal(compact.form, "BULBASAUR_NORMAL");
  assert.ok(compact.searchText.length <= 16_000);
  assert.equal(Object.hasOwn(compact, "searchTokens"), false);
  assert.equal(Object.hasOwn(compact, "flattenedPaths"), false);
  assert.equal(Object.hasOwn(compact, "flattenedText"), false);
});

test("ne purge que les snapshots orphelins arrivés à expiration", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");
  assert.equal(isExpiredOrphan("gm-20260715020000-abcdef", now), true);
  assert.equal(isExpiredOrphan("gm-20260715025000-abcdef", now), false);
  assert.equal(isExpiredOrphan("snapshot-externe", now), false);
});

test("transforme le quota Atlas en erreur explicite et actionnable", () => {
  const mapped = storageError({ code: 8000, message: "you are over your space quota, writes are blocked" });
  assert.equal(mapped.status, 507);
  assert.equal(mapped.code, "GAME_MASTER_STORAGE_QUOTA_EXCEEDED");
  assert.equal(mapped.details.retryable, true);
});

test("calcule les ajouts, retraits et modifications entre deux snapshots", () => {
  const changes = changeRows(
    [
      { templateId: "A", category: "systems/global", settingType: "settings", sourceHash: "a1", raw: { value: 1 } },
      { templateId: "B", category: "systems/global", settingType: "settings", sourceHash: "b1", raw: { value: 1 } },
    ],
    [
      { templateId: "B", category: "systems/global", settingType: "settings", sourceHash: "b2", raw: { value: 2 } },
      { templateId: "C", category: "items/item", settingType: "itemSettings", sourceHash: "c1", raw: { value: 1 } },
    ],
    structuredDiff,
  );
  assert.deepEqual(changes.map((change) => [change.templateId, change.changeType]), [["A", "removed"], ["B", "modified"], ["C", "added"]]);
  assert.equal(changes[1].changes[0].path, "value");
});

test("conserve dans la comparaison l’asset local exact et sa provenance", () => {
  const document = comparisonDocument({
    templateId: "V0001_POKEMON_BULBASAUR",
    pokemonId: 1,
    pokemon: "BULBASAUR",
    form: "BULBASAUR_NORMAL",
    localForm: "BULBASAUR",
    localFormSource: "pokemon.formId",
    resolutionSource: "pokemon.formId",
    localAsset: { image: "bulbasaur.png", source: "pokemon.formId" },
    localFile: "pokemon/0001-bulbasaur.json",
    localAssetsRef: "data/assets/core/normal/0001-bulbasaur.assets.json",
    gameAvailability: { released: false },
    assetAvailability: { normal: true, shiny: false, independentFromGameRelease: true },
    assetBundleSource: "pokemonSettings",
    assetBundleResolved: true,
    assetBundlePaths: { value: "data.pokemonSettings.assetBundleValue", suffix: null },
    genderVariants: [{ isFemale: false, image: "bulbasaur.png" }],
    candidateCount: 1,
    localIdentityKey: "1|BULBASAUR|none",
    variantCategory: "normal",
    mappingStatus: "matched",
  }, "gm-test", 0);
  assert.equal(document.localAsset.image, "bulbasaur.png");
  assert.equal(document.mappingStatus, "matched");
  assert.equal(document.gameAvailability.released, false);
  assert.equal(document.assetAvailability.normal, true);
  assert.equal(document.localFile, "pokemon/0001-bulbasaur.json");
  assert.equal(document.assetBundleResolved, true);
  assert.equal(document.assetBundleSource, "pokemonSettings");
  assert.equal(document.genderVariants.length, 1);
  assert.equal(document.variantCategory, "normal");
  assert.match(document.searchText, /bulbasaur/);
});

test("active le snapshot par pointeur après le staging et traite un hash identique sans snapshot", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/services/game-master-explorer-service.js"), "utf8");
  const insertOffset = source.indexOf("GameMasterTemplate.insertMany");
  const activateOffset = source.indexOf("GameMasterState.findOneAndUpdate", insertOffset);
  assert.ok(insertOffset > 0 && activateOffset > insertOffset);
  assert.match(source, /existingState\?\.sourceHash === payload\.metadata\.sourceHash/);
  assert.match(source, /\$inc: \{ checkCount: 1 \}/);
  assert.doesNotMatch(source, /\$setOnInsert: \{ checkCount: 0 \}/);
  assert.match(source, /cleanupStaging\(snapshotId\)/);
  assert.match(source, /const diffs = existingState\s*\? changeRows/);
  assert.match(source, /compactTemplateDocument\(template\)/);
  assert.match(source, /explorer\.flattenObject\(template\.raw\)/);
});

test("toutes les lectures Game Master exigent le secret Admin", async () => {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "game-master-test-secret";
  try {
    const app = createApp();
    await request(app).get("/api/v1/admin/game-master/summary").expect(401);
    await request(app).get("/api/v1/admin/game-master/templates").expect(401);
    await request(app).get("/api/v1/admin/game-master/runs").expect(401);
    await request(app).get("/api/v1/admin/game-master/export").expect(401);
    const openApi = await request(app).get("/api-docs.json").expect(200);
    assert.equal(Object.keys(openApi.body.paths).some((route) => route.includes("/admin/game-master")), false);
  } finally {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  }
});
