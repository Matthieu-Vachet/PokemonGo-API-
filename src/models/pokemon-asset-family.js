const mongoose = require("mongoose");

const pokemonAssetFamilySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    entityCategory: { type: String, enum: ["NORMAL", "FORM", "MEGA", "DYNAMAX", "GIGANTAMAX"], index: true },
    family: {
      type: String,
      required: true,
      enum: ["home", "shuffle", "variants", "location-cards"],
      index: true,
    },
    id: { type: String, required: true, index: true },
    formId: { type: String, required: true, index: true },
    baseFormId: { type: String, required: true, index: true },
    form: { type: String, required: true, index: true },
    slug: { type: String, required: true, index: true },
    dexNr: { type: Number, index: true },
    dexId: { type: String, index: true },
    sourceFile: { type: String, required: true },
    sourceHash: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    collection: "pokemonAssetFamilies",
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

pokemonAssetFamilySchema.index({ family: 1, formId: 1 }, { unique: true });
pokemonAssetFamilySchema.index({ family: 1, dexNr: 1, form: 1 });

module.exports =
  mongoose.models.PokemonAssetFamily ||
  mongoose.model("PokemonAssetFamily", pokemonAssetFamilySchema);
