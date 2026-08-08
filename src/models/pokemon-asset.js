const mongoose = require("mongoose");

const pokemonAssetSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    id: { type: String, required: true, index: true },
    formId: { type: String, required: true, unique: true },
    baseFormId: { type: String, required: true, index: true },
    form: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    dexNr: { type: Number, index: true },
    dexId: { type: String, index: true },
    sourceFile: { type: String },
    sourceHash: { type: String, required: true },
    assets: { type: mongoose.Schema.Types.Mixed, required: true },
    assetRefs: { type: mongoose.Schema.Types.Mixed, default: {} },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    collection: "pokemonAssets",
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

pokemonAssetSchema.index({ dexNr: 1, form: 1 });

module.exports =
  mongoose.models.PokemonAsset ||
  mongoose.model("PokemonAsset", pokemonAssetSchema);
