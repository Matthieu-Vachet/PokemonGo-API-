const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  snapshotId: { type: String, required: true, index: true },
  templateId: { type: String, required: true },
  category: { type: String, required: true },
  categorySlug: { type: String, required: true },
  categoryLabel: { type: String, required: true },
  categoryGroup: { type: String, required: true },
  categoryGroupLabel: { type: String, required: true },
  settingType: { type: String, required: true },
  pokemonId: { type: String, default: null },
  numericPokemonId: { type: Number, default: null },
  form: { type: String, default: null },
  costume: { type: String, default: null },
  itemId: { type: String, default: null },
  moveId: { type: String, default: null },
  assetBundleValue: { type: String, default: null },
  assetBundleSuffix: { type: String, default: null },
  searchTokens: { type: [String], default: undefined, select: false },
  searchText: { type: String, required: true },
  flattenedPaths: { type: [mongoose.Schema.Types.Mixed], default: undefined, select: false },
  flattenedText: { type: String, default: undefined, select: false },
  propertyCount: { type: Number, required: true },
  sizeBytes: { type: Number, required: true },
  sourceHash: { type: String, required: true },
  sourceUpdatedAt: { type: Date },
  indexSchemaVersion: { type: Number, required: true },
  raw: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, versionKey: false, minimize: false });

schema.index({ snapshotId: 1, templateId: 1 }, { unique: true });
schema.index({ snapshotId: 1, category: 1, templateId: 1 });
schema.index({ snapshotId: 1, settingType: 1, templateId: 1 });
schema.index({ snapshotId: 1, numericPokemonId: 1 });
schema.index({ snapshotId: 1, sourceHash: 1 });

module.exports = mongoose.models.GameMasterTemplate
  || mongoose.model("GameMasterTemplate", schema, "game_master_templates");
