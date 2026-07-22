const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentityDiagnostic } = require("../src/models");
const { recordDiagnosticsBatch } = require("../src/services/pokemon-identity-service");

test("le batch de diagnostics initialise occurrences exclusivement avec $inc", async () => {
  const originalBulkWrite = PokemonIdentityDiagnostic.bulkWrite;
  let capturedOperations = [];
  PokemonIdentityDiagnostic.bulkWrite = async (operations) => {
    capturedOperations = operations;
    return { upsertedCount: 1, modifiedCount: 0 };
  };

  try {
    const result = await recordDiagnosticsBatch([{
      provider: "PokeMiners-game_masters",
      sourceId: "V0001_POKEMON_BULBASAUR",
      rawAlias: "BULBASAUR_NORMAL",
      reason: "VARIANT_NOT_FOUND",
      occurrences: 3,
    }]);
    assert.deepEqual(result, { detected: 1, upserted: 1, modified: 0 });
    const update = capturedOperations[0].updateOne.update;
    assert.equal(update.$setOnInsert.occurrences, undefined);
    assert.equal(update.$inc.occurrences, 3);
    assert.equal(update.$setOnInsert.status, "open");
  } finally {
    PokemonIdentityDiagnostic.bulkWrite = originalBulkWrite;
  }
});
