const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  datasetKey: { type: String, required: true, index: true },
  provider: { type: String, default: null },
  sourceUrl: { type: String, default: null },
  status: { type: String, required: true, enum: ["running", "success", "partial", "failed", "unchanged"], index: true },
  phase: { type: String, enum: ["generating", "generated", "persisting", "completed"], default: "generating", index: true },
  phaseStartedAt: { type: Date, default: null },
  stagedPayload: { type: Buffer, default: undefined },
  startedAt: { type: Date, required: true, index: true },
  completedAt: { type: Date, default: null },
  durationMs: { type: Number, default: 0 },
  retrievedAt: { type: Date, default: null },
  savedAt: { type: Date, default: null },
  hashBefore: { type: String, default: null },
  hashAfter: { type: String, default: null },
  changed: { type: Boolean, default: false },
  totalBefore: { type: Number, default: 0 },
  totalAfter: { type: Number, default: 0 },
  added: { type: Number, default: 0 },
  removed: { type: Number, default: 0 },
  modified: { type: Number, default: 0 },
  matchedCount: { type: Number, default: 0 },
  unmatchedCount: { type: Number, default: 0 },
  warningsCount: { type: Number, default: 0 },
  errorsCount: { type: Number, default: 0 },
  unmatchedEntries: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  warnings: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  errors: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  diffUnavailableReason: { type: String, default: null },
}, { timestamps: true, strict: false, minimize: false, versionKey: false, suppressReservedKeysWarning: true });

schema.index({ datasetKey: 1, startedAt: -1 });

module.exports = mongoose.models.DatasetRun || mongoose.model("DatasetRun", schema, "dataset_runs");
