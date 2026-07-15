const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  snapshotId: { type: String, required: true, index: true },
  previousSnapshotId: { type: String, default: null, index: true },
  templateId: { type: String, required: true },
  category: { type: String, required: true },
  settingType: { type: String, required: true },
  changeType: { type: String, required: true, enum: ["added", "removed", "modified"] },
  changes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  truncated: { type: Boolean, default: false },
  beforeHash: { type: String, default: null },
  afterHash: { type: String, default: null },
}, { timestamps: true, versionKey: false, minimize: false });

schema.index({ snapshotId: 1, templateId: 1 }, { unique: true });
schema.index({ snapshotId: 1, changeType: 1, category: 1 });

module.exports = mongoose.models.GameMasterDiff
  || mongoose.model("GameMasterDiff", schema, "game_master_diffs");
