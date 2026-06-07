const mongoose = require("mongoose");

const globalStatSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

module.exports =
  mongoose.models.GlobalStat || mongoose.model("GlobalStat", globalStatSchema);
