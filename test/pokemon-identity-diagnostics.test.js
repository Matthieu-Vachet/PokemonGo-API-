const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentityDiagnostic } = require("../src/models");
const { recordDiagnosticsBatch, resolveDiagnosticsForAlias } = require("../src/services/pokemon-identity-service");

test("le batch de diagnostics fixe le nombre courant d’occurrences de manière idempotente", async () => {
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
    assert.equal(update.$set.occurrences, 3);
    assert.equal(update.$inc, undefined);
    assert.equal(update.$setOnInsert.status, "open");
  } finally {
    PokemonIdentityDiagnostic.bulkWrite = originalBulkWrite;
  }
});

test("un alias actif clôt immédiatement les diagnostics ouverts correspondants", async () => {
  const originalUpdateMany = PokemonIdentityDiagnostic.updateMany;
  let capturedFilter = null;
  let capturedUpdate = null;
  PokemonIdentityDiagnostic.updateMany = async (filter, update) => {
    capturedFilter = filter;
    capturedUpdate = update;
    return { matchedCount: 2, modifiedCount: 2 };
  };

  try {
    const identity = { _id: "507f1f77bcf86cd799439011" };
    const result = await resolveDiagnosticsForAlias(identity, {
      provider: "margxt",
      normalizedValue: "pikachu_chapeau_valor",
      status: "active",
    }, "admin@example.test");
    assert.deepEqual(capturedFilter, {
      provider: "margxt",
      normalizedAlias: "pikachu_chapeau_valor",
      status: "open",
    });
    assert.equal(capturedUpdate.$set.status, "resolved");
    assert.equal(capturedUpdate.$set.resolvedIdentityId, identity._id);
    assert.equal(capturedUpdate.$set.resolvedBy, "admin@example.test");
    assert.deepEqual(result, { matchedCount: 2, modifiedCount: 2 });
  } finally {
    PokemonIdentityDiagnostic.updateMany = originalUpdateMany;
  }
});

test("un alias non actif ne clôt aucun diagnostic", async () => {
  const result = await resolveDiagnosticsForAlias({ _id: "unused" }, {
    provider: "margxt",
    normalizedValue: "pikachu",
    status: "ignored",
  }, "admin@example.test");
  assert.deepEqual(result, { matchedCount: 0, modifiedCount: 0 });
});
