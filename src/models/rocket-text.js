const mongoose = require("mongoose");

const rocketTextSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    textKey: { type: String, required: true, index: true },
    trainerType: { type: String, default: null, index: true },
    gender: { type: String, default: null, index: true },
    type: { type: String, default: null, index: true },
    character: { type: String, default: null, index: true },
    texts: { type: mongoose.Schema.Types.Mixed, default: {} },
    textVariants: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    sourceHash: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    collection: "rocket_texts",
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

rocketTextSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports = mongoose.models.RocketText || mongoose.model("RocketText", rocketTextSchema);
