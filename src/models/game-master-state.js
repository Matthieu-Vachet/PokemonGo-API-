const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: "current" },
  snapshotId: { type: String, required: true, index: true },
  sourceHash: { type: String, required: true },
  sourceUpdatedAt: { type: Date },
  retrievedAt: { type: Date, required: true },
  lastCheckedAt: { type: Date, required: true },
  checkCount: { type: Number, required: true, default: 1 },
  totalTemplates: { type: Number, required: true },
  totalCategories: { type: Number, required: true },
  indexSchemaVersion: { type: Number, required: true },
}, { timestamps: true, versionKey: false, minimize: false });

module.exports = mongoose.models.GameMasterState
  || mongoose.model("GameMasterState", schema, "game_master_states");
