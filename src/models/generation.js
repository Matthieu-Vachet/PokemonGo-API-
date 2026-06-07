const mongoose = require("mongoose");

const generationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    generation: { type: Number, required: true, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    sourceHash: { type: String, required: true },
  },
  { timestamps: true, strict: false, minimize: false, versionKey: false },
);

module.exports =
  mongoose.models.Generation || mongoose.model("Generation", generationSchema);
