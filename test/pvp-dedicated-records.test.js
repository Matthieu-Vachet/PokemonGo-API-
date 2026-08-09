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
  assert.equal(hydrated.pvpRecord.source.commit, "ea8f7691cdee95cb33a485b8e89ff39819d41ba4");
  assert.equal(hydrated.pvp.greatLeague.status, "RANKED");
  assert.equal(hydrated.pvp.greatLeague.bestMovesets.fast, "VINE_WHIP_FAST");
});

test("les documents Mongo/API référencent la fiche PvP comme source canonique", () => {
  const documents = collectAllDocuments().pokemon;
  const bulbasaur = documents.find((entry) => entry.formId === "BULBASAUR");
  assert.equal(bulbasaur.data.pvpRecord.pvpId, "BULBASAUR");
  assert.ok(bulbasaur.sourceFiles.includes("data/pvp/pokemon/normal/0001-bulbasaur.pvp.json"));
  assert.equal(bulbasaur.pvpLeagues.includes("greatLeague"), true);
});
