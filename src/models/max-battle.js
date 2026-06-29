const mongoose = require("mongoose");

const maxBattleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceFile: { type: String, default: null },
    sourceHash: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

module.exports = mongoose.models.MaxBattle || mongoose.model("MaxBattle", maxBattleSchema);
