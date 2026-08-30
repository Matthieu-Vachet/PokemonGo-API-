const test = require("node:test");
const assert = require("node:assert/strict");
const { PokemonIdentity, PokemonIdentityDiagnostic } = require("../src/models");
const {
  diagnosticCode,
  diagnosticSeverity,
  diagnosticSummary,
  reconcileDiagnosticsWithAliases,
  recordDiagnosticsBatch,
  resolveDiagnosticsForAlias,
} = require("../src/services/pokemon-identity-service");

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
      reason: { $in: capturedFilter.reason.$in },
    });
    assert.ok(capturedFilter.reason.$in.includes("unknown-form"));
    assert.equal(capturedFilter.reason.$in.includes("CANONICAL_ASSET_MISSING"), false);
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

test("les causes historiques reçoivent un code et une sévérité stables", () => {
  assert.equal(diagnosticCode("unknown-form"), "FORM_UNKNOWN");
  assert.equal(diagnosticSeverity("unknown-form"), "warning");
  assert.equal(diagnosticCode("multiple-local-identities"), "MULTIPLE_FUNCTIONAL_IDENTITIES");
  assert.equal(diagnosticSeverity("multiple-local-identities"), "error");
  assert.equal(diagnosticCode("CANONICAL_ASSET_MISSING"), "CANONICAL_ASSET_MISSING");
  assert.equal(diagnosticSeverity("CANONICAL_ASSET_MISSING"), "error");
});

test("le résumé sépare les alias actifs, diagnostics résolus et entrées actionnables", async () => {
  const originalDiagnosticFind = PokemonIdentityDiagnostic.find;
  const originalIdentityAggregate = PokemonIdentity.aggregate;
  PokemonIdentityDiagnostic.find = () => ({ select: () => ({ lean: async () => [{
    provider: "snacknap",
    normalizedAlias: "baile_style",
    sourceId: "741",
    reason: "unknown-form",
    status: "open",
    candidates: [],
    occurrences: 3,
  }, {
    provider: "snacknap",
    normalizedAlias: "missing_form",
    sourceId: "25",
    reason: "unknown-form",
    status: "open",
    candidates: [{ canonicalId: "PIKACHU_NORMAL" }],
    occurrences: 2,
  }, {
    provider: "snacknap",
    normalizedAlias: "old_form",
    sourceId: "25",
    reason: "unknown-form",
    status: "resolved",
    candidates: [],
    occurrences: 1,
  }] }) });
  PokemonIdentity.aggregate = async () => [{
    _id: "507f1f77bcf86cd799439011",
    canonicalId: "ORICORIO_BAILE",
    pokemonId: 741,
    provider: "snacknap",
    normalizedValue: "baile_style",
    sourceFile: "data/pokemon/normal/0741-oricorio.json",
    identityKey: "741|BAILE|none|none",
  }];
  try {
    const summary = await diagnosticSummary();
    const snacknap = summary.providers.find((provider) => provider.id === "snacknap");
    assert.equal(snacknap.activeAliases, 1);
    assert.equal(snacknap.open, 2);
    assert.equal(snacknap.resolved, 1);
    assert.equal(snacknap.alreadyAssociated, 1);
    assert.equal(snacknap.actionable, 1);
    assert.equal(snacknap.withCandidates, 1);
    assert.deepEqual(snacknap.codes.map((entry) => [entry.code, entry.severity, entry.open]), [["FORM_UNKNOWN", "warning", 2]]);
  } finally {
    PokemonIdentityDiagnostic.find = originalDiagnosticFind;
    PokemonIdentity.aggregate = originalIdentityAggregate;
  }
});

test("la réconciliation clôt uniquement les diagnostics d'alias couverts", async () => {
  const originalDiagnosticFind = PokemonIdentityDiagnostic.find;
  const originalDiagnosticBulkWrite = PokemonIdentityDiagnostic.bulkWrite;
  const originalIdentityAggregate = PokemonIdentity.aggregate;
  let receivedFilter = null;
  let operations = [];
  PokemonIdentityDiagnostic.find = (filter) => {
    receivedFilter = filter;
    return { select: () => ({ lean: async () => [{ _id: "607f1f77bcf86cd799439011", provider: "snacknap", normalizedAlias: "baile_style" }] }) };
  };
  PokemonIdentityDiagnostic.bulkWrite = async (entries) => {
    operations = entries;
    return { modifiedCount: 1 };
  };
  PokemonIdentity.aggregate = async () => [{
    _id: "507f1f77bcf86cd799439011",
    provider: "snacknap",
    normalizedValue: "baile_style",
  }];
  try {
    const result = await reconcileDiagnosticsWithAliases("admin@example.test");
    assert.equal(receivedFilter.status, "open");
    assert.equal(receivedFilter.reason.$in.includes("CANONICAL_ASSET_MISSING"), false);
    assert.equal(result.matched, 1);
    assert.equal(result.modified, 1);
    assert.deepEqual(result.providers, [{ provider: "snacknap", count: 1 }]);
    assert.equal(operations[0].updateMany.update.$set.resolvedIdentityId, "507f1f77bcf86cd799439011");
    assert.equal(operations[0].updateMany.update.$set.resolvedBy, "admin@example.test");
  } finally {
    PokemonIdentityDiagnostic.find = originalDiagnosticFind;
    PokemonIdentityDiagnostic.bulkWrite = originalDiagnosticBulkWrite;
    PokemonIdentity.aggregate = originalIdentityAggregate;
  }
});
