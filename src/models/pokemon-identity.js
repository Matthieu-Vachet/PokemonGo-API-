const crypto = require("crypto");
const mongoose = require("mongoose");

const IDENTITY_STATUSES = ["active", "draft", "deprecated", "ignored"];
const ALIAS_STATUSES = ["active", "deprecated", "ignored", "conflict"];
const ALIAS_SOURCES = ["manual", "migration", "detected", "rule", "import"];

const aliasSchema = new mongoose.Schema(
  {
    aliasId: { type: String, required: true, default: () => crypto.randomUUID() },
    provider: { type: String, required: true, trim: true, lowercase: true },
    value: { type: String, required: true, trim: true },
    normalizedValue: { type: String, required: true, trim: true, lowercase: true },
    status: { type: String, required: true, enum: ALIAS_STATUSES, default: "active" },
    confidence: { type: Number, min: 0, max: 1, default: 1 },
    source: { type: String, required: true, enum: ALIAS_SOURCES, default: "manual" },
    reason: { type: String, default: null },
    firstDetectedAt: { type: Date, default: null },
    lastDetectedAt: { type: Date, default: null },
    occurrences: { type: Number, min: 0, default: 0 },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
    createdBy: { type: String, required: true, default: "system" },
    updatedBy: { type: String, required: true, default: "system" },
  },
  { _id: false, minimize: false },
);

const pokemonIdentitySchema = new mongoose.Schema(
  {
    canonicalId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    pokemonId: { type: Number, required: true, min: 1, index: true },
    form: { type: String, default: null, trim: true },
    costume: { type: String, default: null, trim: true },
    status: { type: String, required: true, enum: IDENTITY_STATUSES, default: "active", index: true },
    aliases: { type: [aliasSchema], default: [] },
    activeAliasKeys: { type: [String], default: [], select: false },
    genderVariants: {
      male: { type: Boolean, default: false },
      female: { type: Boolean, default: false },
    },
    localReference: {
      key: { type: String, default: null },
      formId: { type: String, default: null },
      file: { type: String, default: null },
      assetsRef: { type: String, default: null },
    },
    metadata: {
      notes: { type: String, default: null },
      tags: { type: [String], default: [] },
      lastResolvedAt: { type: Date, default: null },
      lastUsedAt: { type: Date, default: null },
      usageCount: { type: Number, min: 0, default: 0 },
    },
    createdBy: { type: String, required: true, default: "system" },
    updatedBy: { type: String, required: true, default: "system" },
    deprecatedAt: { type: Date, default: null },
    deprecatedBy: { type: String, default: null },
    deprecationReason: { type: String, default: null },
  },
  {
    collection: "pokemon_identities",
    timestamps: true,
    strict: true,
    minimize: false,
    versionKey: false,
  },
);

pokemonIdentitySchema.index({ "aliases.provider": 1 });
pokemonIdentitySchema.index({ "aliases.normalizedValue": 1 });
pokemonIdentitySchema.index({ "aliases.provider": 1, "aliases.normalizedValue": 1 });
pokemonIdentitySchema.index({ activeAliasKeys: 1 }, { unique: true, sparse: true, name: "uniq_active_provider_alias" });
pokemonIdentitySchema.index({ pokemonId: 1, form: 1, costume: 1 });
pokemonIdentitySchema.index({ updatedAt: -1 });

pokemonIdentitySchema.pre("validate", function normalizeEmbeddedAliases() {
  const seen = new Set();
  this.activeAliasKeys = [];
  for (const alias of this.aliases || []) {
    alias.provider = String(alias.provider || "").trim().toLowerCase();
    alias.value = String(alias.value || "").trim();
    alias.normalizedValue = String(alias.normalizedValue || "").trim().toLowerCase();
    alias.updatedAt = new Date();
    const key = `${alias.provider}:${alias.normalizedValue}`;
    if (!alias.provider || !alias.value || !alias.normalizedValue) {
      this.invalidate("aliases", "Un alias doit contenir un provider, une valeur brute et une valeur normalisée.");
      continue;
    }
    if (seen.has(key)) this.invalidate("aliases", `Alias dupliqué dans l'identité : ${key}`);
    seen.add(key);
    if (alias.status === "active") this.activeAliasKeys.push(key);
  }
});

module.exports = mongoose.models.PokemonIdentity || mongoose.model("PokemonIdentity", pokemonIdentitySchema);
module.exports.IDENTITY_STATUSES = IDENTITY_STATUSES;
module.exports.ALIAS_STATUSES = ALIAS_STATUSES;
module.exports.ALIAS_SOURCES = ALIAS_SOURCES;
