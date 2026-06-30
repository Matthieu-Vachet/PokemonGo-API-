const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    templateId: { type: String, required: true, index: true },
    itemId: { type: String, required: true, index: true },
    category: { type: String, default: null, index: true },
    itemType: { type: String, default: null, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    description: { type: mongoose.Schema.Types.Mixed, default: {} },
    asset: { type: mongoose.Schema.Types.Mixed, default: null },
    assetKey: { type: String, default: null, index: true },
    searchTerms: { type: [String], default: [] },
    sourceHash: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    collection: "items",
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

itemSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports = mongoose.models.Item || mongoose.model("Item", itemSchema);
