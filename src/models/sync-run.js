const mongoose = require("mongoose");

const syncRunSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      required: true,
      enum: ["running", "success", "failed"],
      index: true,
    },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    durationMs: Number,
    counts: { type: mongoose.Schema.Types.Mixed, default: {} },
    changes: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

module.exports =
  mongoose.models.SyncRun || mongoose.model("SyncRun", syncRunSchema);
