const mongoose = require("mongoose");

const weatherSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    assets: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    boostedTypes: { type: [String], default: [] },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

weatherSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports =
  mongoose.models.Weather || mongoose.model("Weather", weatherSchema);
