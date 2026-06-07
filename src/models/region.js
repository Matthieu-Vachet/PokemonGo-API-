const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    generation: { type: Number, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

module.exports = mongoose.models.Region || mongoose.model("Region", regionSchema);
