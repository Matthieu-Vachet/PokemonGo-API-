const UNMATCHED_REASON_CODES = Object.freeze([
  "NO_CANONICAL_MATCH",
  "AMBIGUOUS_MATCH",
  "SOURCE_ID_UNKNOWN",
  "FORM_MISMATCH",
  "VARIANT_MISMATCH",
  "NAME_MISMATCH",
  "MISSING_ALIAS",
]);

const reasonCodeSet = new Set(UNMATCHED_REASON_CODES);
const terminalStatuses = new Set(["resolved", "ignored", "false-positive", "closed"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function normalizedToken(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function unmatchedReasonCode(value, entry = {}) {
  const token = normalizedToken(value);
  if (reasonCodeSet.has(token)) return token;
  if (token.includes("AMBIG")) return "AMBIGUOUS_MATCH";
  if (token.includes("FORM")) return "FORM_MISMATCH";
  if (token.includes("VARIANT") || token.includes("COSTUME") || token.includes("ASSET")) return "VARIANT_MISMATCH";
  if (token.includes("NAME")) return "NAME_MISMATCH";
  if (token.includes("ALIAS")) return "MISSING_ALIAS";
  if (token.includes("SOURCE_ID") || token.includes("IDENTIFIER") || token === "ID_UNKNOWN") return "SOURCE_ID_UNKNOWN";
  if (!firstDefined(entry.sourceId, entry.rawId, entry.id) && !firstDefined(entry.sourceName, entry.rawName, entry.name)) {
    return "SOURCE_ID_UNKNOWN";
  }
  return "NO_CANONICAL_MATCH";
}

function confidenceValue(entry = {}) {
  const direct = Number(firstDefined(
    entry.confidence,
    entry.matchConfidence,
    entry.resolutionConfidence,
    entry.score,
  ));
  if (Number.isFinite(direct)) return Math.max(0, Math.min(1, direct));
  const candidates = asArray(entry.candidates ?? entry.ambiguousCandidates);
  const candidateScores = candidates
    .map((candidate) => Number(candidate?.confidence ?? candidate?.score))
    .filter(Number.isFinite);
  return candidateScores.length ? Math.max(0, Math.min(1, Math.max(...candidateScores))) : 0;
}

function unmatchedStatus(entry = {}) {
  const raw = String(firstDefined(entry.reportStatus, entry.diagnosticStatus, entry.status, "open")).trim().toLowerCase();
  return terminalStatuses.has(raw) ? raw : "open";
}

function normalizeUnmatchedEntry(entry = {}, options = {}) {
  const sourceId = firstDefined(entry.sourceId, entry.rawId, entry.id, null);
  const name = firstDefined(entry.name, entry.sourceName, entry.rawName, entry.pokemonName, null);
  const sourceValue = firstDefined(
    entry.sourceValue,
    entry.rawAlias,
    entry.sourceAlias,
    entry.alias,
    entry.value,
    sourceId,
    name,
    null,
  );
  const rawReason = firstDefined(entry.reason, entry.reasonCode, entry.mappingStatus, entry.status, options.fallbackReason, "unknown");
  const candidates = asArray(entry.candidates ?? entry.ambiguousCandidates);
  const destination = firstDefined(
    entry.destination,
    entry.eventualDestination,
    entry.canonicalId,
    entry.identityId,
    entry.localFile,
    null,
  );

  return {
    provider: firstDefined(entry.provider, options.provider, null),
    occurrenceId: firstDefined(entry.occurrenceId, entry.entryId) ?? null,
    sourceId,
    name,
    sourceValue,
    reason: unmatchedReasonCode(rawReason, entry),
    reasonDetails: firstDefined(entry.reasonDetails, entry.detail, entry.message, rawReason, null),
    candidates,
    confidence: confidenceValue(entry),
    destination,
    status: unmatchedStatus(entry),
    sourceName: name,
    sourceForm: firstDefined(entry.sourceForm, entry.rawForm, entry.form, entry.requestedVariant, null),
    sourceCostume: firstDefined(entry.sourceCostume, entry.rawCostume, entry.costume, null),
    sourceImage: firstDefined(entry.sourceImage, entry.rawImage, entry.image, null),
    shiny: Boolean(firstDefined(entry.shiny, entry.isShiny, false)),
    shinyDetails: firstDefined(entry.shinyDetails) ?? null,
    dexNr: firstDefined(entry.dexNr, entry.pokemonId) ?? null,
    bucket: firstDefined(entry.bucket) ?? null,
    rank: firstDefined(entry.rank) ?? null,
    localFile: firstDefined(entry.localFile, null),
    sourcePayload: firstDefined(entry.sourcePayload, entry.raw, entry),
  };
}

function createUnmatchedEntriesReport(entries = [], options = {}) {
  const seen = new Set();
  const normalizedEntries = asArray(entries)
    .map((entry) => normalizeUnmatchedEntry(entry, options))
    .filter((entry) => {
      const key = JSON.stringify([
        entry.occurrenceId,
        entry.provider,
        entry.sourceId,
        entry.name,
        entry.sourceValue,
        entry.sourceForm,
        entry.sourceCostume,
        entry.reason,
      ]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const expectedCount = Math.max(0, Number(options.expectedCount) || 0);
  const total = Math.max(expectedCount, normalizedEntries.length);
  const countBy = (field) => normalizedEntries.reduce((counts, entry) => {
    const key = String(entry[field] || "unknown");
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  return {
    schema: "UnmatchedEntriesReport@1",
    total,
    detailedCount: normalizedEntries.length,
    missingDetailCount: Math.max(total - normalizedEntries.length, 0),
    complete: total === normalizedEntries.length,
    reasonCounts: countBy("reason"),
    statusCounts: countBy("status"),
    entries: normalizedEntries,
  };
}

module.exports = {
  UNMATCHED_REASON_CODES,
  createUnmatchedEntriesReport,
  normalizeUnmatchedEntry,
  unmatchedReasonCode,
};
