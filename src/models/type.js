const mongoose = require("mongoose");

const typeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

typeSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports = mongoose.models.Type || mongoose.model("Type", typeSchema);
