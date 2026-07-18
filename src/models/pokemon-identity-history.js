const mongoose = require("mongoose");

const pokemonIdentityHistorySchema = new mongoose.Schema(
  {
    identityId: { type: mongoose.Schema.Types.ObjectId, ref: "PokemonIdentity", required: true, index: true },
    canonicalId: { type: String, required: true, index: true },
    action: {
      type: String,
      required: true,
      enum: ["create", "update", "alias-add", "alias-update", "alias-deprecate", "canonical-change", "conflict-resolve", "merge", "deprecate", "restore", "import", "sync-create", "sync-update", "sync-orphan", "sync-relink", "sync-alias-move"],
      index: true,
    },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    user: { type: String, required: true, default: "system" },
    provider: { type: String, default: null, index: true },
    alias: { type: String, default: null },
    normalizedAlias: { type: String, default: null },
    reason: { type: String, default: null },
  },
  {
    collection: "pokemon_identity_history",
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    minimize: false,
    versionKey: false,
  },
);

pokemonIdentityHistorySchema.index({ identityId: 1, createdAt: -1 });
pokemonIdentityHistorySchema.index({ canonicalId: 1, createdAt: -1 });
pokemonIdentityHistorySchema.index({ provider: 1, normalizedAlias: 1, createdAt: -1 });

module.exports = mongoose.models.PokemonIdentityHistory || mongoose.model("PokemonIdentityHistory", pokemonIdentityHistorySchema);
