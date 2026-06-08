const mongoose = require("mongoose");

const moveSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, index: true },
    legacySlugs: { type: [String], default: [], index: true },
    kind: {
      type: String,
      required: true,
      enum: ["fast", "charged", "max", "gmax"],
      index: true,
    },
    categories: { type: [String], default: [], index: true },
    elite: { type: Boolean, default: false, index: true },
    type: { type: String, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    power: Number,
    energy: Number,
    durationMs: Number,
    combat: { type: mongoose.Schema.Types.Mixed },
    sourceFiles: { type: [String], default: [] },
    sourceHash: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

moveSchema.index({ kind: 1, elite: 1, type: 1 });
moveSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports = mongoose.models.Move || mongoose.model("Move", moveSchema);
