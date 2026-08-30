const mongoose = require("mongoose");

const pokemonIdentityDiagnosticSchema = new mongoose.Schema(
  {
    diagnosticKey: { type: String, required: true, unique: true },
    provider: { type: String, required: true, index: true },
    sourceId: { type: String, default: null },
    rawAlias: { type: String, required: true },
    normalizedAlias: { type: String, required: true, index: true },
    pokemonId: { type: Number, default: null, index: true },
    pokemon: { type: String, default: null },
    form: { type: String, default: null },
    costume: { type: String, default: null },
    reason: {
      type: String,
      required: true,
      enum: [
        "unknown-alias", "unknown-pokemon", "unknown-form", "unknown-costume", "missing-canonical-id", "duplicate", "conflict", "multiple-candidates", "ambiguous-gender", "deprecated-identity", "ignored-alias", "incomplete-source", "missing-local-match",
        "ALIAS_UNKNOWN", "POKEMON_UNKNOWN", "FORM_UNKNOWN", "COSTUME_UNKNOWN", "CANONICAL_ID_MISSING", "CANONICAL_ID_NOT_SYNCHRONIZED", "DUPLICATE_ALIAS", "ALIAS_CONFLICT", "MULTIPLE_FUNCTIONAL_IDENTITIES", "GENDER_ASSET_UNAVAILABLE", "IDENTITY_DEPRECATED", "ALIAS_IGNORED", "SOURCE_DATA_INCOMPLETE", "LOCAL_IDENTITY_MISSING", "VARIANT_NOT_FOUND",
        "ambiguous", "multiple-local-identities", "multiple-canonical-identities", "CANONICAL_ASSET_MISSING",
      ],
      index: true,
    },
    confidence: { type: Number, min: 0, max: 1, default: 0 },
    candidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    proposedAction: { type: String, default: "associate" },
    status: { type: String, enum: ["open", "resolved", "ignored", "false-positive"], default: "open", index: true },
    firstDetectedAt: { type: Date, required: true, default: Date.now },
    lastDetectedAt: { type: Date, required: true, default: Date.now },
    occurrences: { type: Number, min: 1, default: 1 },
    resolvedIdentityId: { type: mongoose.Schema.Types.ObjectId, ref: "PokemonIdentity", default: null },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
    sourcePayload: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    collection: "pokemon_identity_diagnostics",
    timestamps: true,
    strict: true,
    minimize: false,
    versionKey: false,
  },
);

pokemonIdentityDiagnosticSchema.index({ provider: 1, normalizedAlias: 1 });
pokemonIdentityDiagnosticSchema.index({ status: 1, reason: 1, lastDetectedAt: -1 });
pokemonIdentityDiagnosticSchema.index({ pokemonId: 1, form: 1, costume: 1 });

module.exports = mongoose.models.PokemonIdentityDiagnostic || mongoose.model("PokemonIdentityDiagnostic", pokemonIdentityDiagnosticSchema);
