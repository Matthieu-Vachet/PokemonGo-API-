const assert = require("node:assert/strict");
const test = require("node:test");

const { dataPath } = require("../src/lib/data-repository");
const {
  collectAllDocuments,
  hydratePokemonPvp,
  readJson,
} = require("../src/sync/source-reader");

test("le reader API hydrate pvpRef avec le contrat dédié", () => {
  const source = readJson(dataPath("pokemon", "0001-bulbasaur.json"));
  const hydrated = hydratePokemonPvp(source);
  assert.equal(hydrated.pvpRecord.pvpId, "BULBASAUR");
  assert.equal(hydrated.pvpRecord.source.commit, "5aa3fe6e99c270c3b0404e3135960ce943fa582a");
  assert.equal(hydrated.pvp.greatLeague.status, "RANKED");
  assert.equal(hydrated.pvp.greatLeague.bestMovesets.fast, "VINE_WHIP_FAST");
});

test("les documents Mongo/API référencent la fiche PvP comme source canonique", () => {
  const documents = collectAllDocuments().pokemon;
  const bulbasaur = documents.find((entry) => entry.formId === "BULBASAUR");
  assert.equal(bulbasaur.data.pvpRecord.pvpId, "BULBASAUR");
  assert.ok(bulbasaur.sourceFiles.includes("data/pvp/pokemon/0001-bulbasaur.pvp.json"));
  assert.equal(bulbasaur.pvpLeagues.includes("greatLeague"), true);
});

