const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  snapshotId: { type: String, required: true, unique: true },
  previousSnapshotId: { type: String, default: null, index: true },
  sourceHash: { type: String, required: true, index: true },
  provider: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  sourceUpdatedAt: { type: Date },
  retrievedAt: { type: Date, required: true },
  indexedAt: { type: Date, required: true },
  totalTemplates: { type: Number, required: true },
  totalCategories: { type: Number, required: true },
  categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  changes: {
    added: { type: Number, required: true, default: 0 },
    removed: { type: Number, required: true, default: 0 },
    modified: { type: Number, required: true, default: 0 },
  },
  localSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  warnings: { type: [String], default: [] },
  durationMs: { type: Number, required: true },
  schemaVersion: { type: Number, required: true },
  indexSchemaVersion: { type: Number, required: true },
}, { timestamps: true, versionKey: false, minimize: false });

schema.index({ indexedAt: -1 });

module.exports = mongoose.models.GameMasterSnapshot
  || mongoose.model("GameMasterSnapshot", schema, "game_master_snapshots");
