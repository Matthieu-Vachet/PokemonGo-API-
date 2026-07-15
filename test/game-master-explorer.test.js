const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("../src/app");
const {
  changeRows,
  comparisonDocument,
  escapedRegex,
  pageOptions,
  snapshotIdFor,
} = require("../src/services/game-master-explorer-service");
const { structuredDiff } = require(path.join(process.env.POKEMON_GO_DATA_DIR || path.resolve(__dirname, "../../PokemonGo-Data"), "scripts/lib/game-master-explorer.js"));

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
    localAssetsRef: "pokemon-assets/normal/0001-bulbasaur.assets.json",
    gameAvailability: { released: false },
    assetAvailability: { normal: true, shiny: false, independentFromGameRelease: true },
    mappingStatus: "matched",
  }, "gm-test", 0);
  assert.equal(document.localAsset.image, "bulbasaur.png");
  assert.equal(document.mappingStatus, "matched");
  assert.equal(document.gameAvailability.released, false);
  assert.equal(document.assetAvailability.normal, true);
  assert.equal(document.localFile, "pokemon/0001-bulbasaur.json");
  assert.match(document.searchText, /bulbasaur/);
});

test("active le snapshot par pointeur après le staging et traite un hash identique sans snapshot", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../src/services/game-master-explorer-service.js"), "utf8");
  const insertOffset = source.indexOf("GameMasterTemplate.insertMany");
  const activateOffset = source.indexOf("GameMasterState.findOneAndUpdate", insertOffset);
  assert.ok(insertOffset > 0 && activateOffset > insertOffset);
  assert.match(source, /existingState\?\.sourceHash === payload\.metadata\.sourceHash/);
  assert.match(source, /\$inc: \{ checkCount: 1 \}/);
  assert.match(source, /cleanupStaging\(snapshotId\)/);
});

test("toutes les lectures Game Master exigent le secret Admin", async () => {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "game-master-test-secret";
  try {
    const app = createApp();
    await request(app).get("/api/v1/admin/game-master/summary").expect(401);
    await request(app).get("/api/v1/admin/game-master/templates").expect(401);
    await request(app).get("/api/v1/admin/game-master/export").expect(401);
    const openApi = await request(app).get("/api-docs.json").expect(200);
    assert.equal(Object.keys(openApi.body.paths).some((route) => route.includes("/admin/game-master")), false);
  } finally {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  }
});
