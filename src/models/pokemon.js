const mongoose = require("mongoose");

const pokemonSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    kind: {
      type: String,
      required: true,
      enum: ["pokemon", "regional", "mega", "gigantamax", "form"],
      index: true,
    },
    parentKey: { type: String, default: null, index: true },
    id: { type: String, required: true, index: true },
    formId: { type: String, index: true },
    slug: { type: String, required: true, index: true },
    dexNr: { type: Number, index: true },
    dexId: { type: String, index: true },
    form: { type: String, required: true, index: true },
    generation: { type: Number, index: true },
    regionId: { type: String, index: true },
    names: { type: mongoose.Schema.Types.Mixed, default: {} },
    searchTerms: { type: [String], default: [] },
    primaryType: { type: String, index: true },
    secondaryType: { type: String, index: true },
    types: { type: [String], default: [], index: true },
    weatherBoost: { type: [String], default: [], index: true },
    moveIds: { type: [String], default: [], index: true },
    eliteMoveIds: { type: [String], default: [], index: true },
    pvpLeagues: { type: [String], default: [], index: true },
    stats: {
      attack: { type: Number, index: true },
      defense: { type: Number, index: true },
      stamina: { type: Number, index: true },
    },
    maxCp: {
      maxLevel50: { type: Number, index: true },
      maxLevel40: Number,
      weatherBoostLevel25: Number,
      raidLevel20: Number,
      researchLevel15: Number,
    },
    flags: {
      released: { type: Boolean, index: true },
      shinyReleased: { type: Boolean, index: true },
      tradable: { type: Boolean, index: true },
      pokemonHomeTransfer: { type: Boolean, index: true },
      shadow: { type: Boolean, index: true },
      apex: { type: Boolean, index: true },
      dynamax: { type: Boolean, index: true },
      gigantamax: { type: Boolean, index: true },
      mega: { type: Boolean, index: true },
    },
    buddyDistance: { type: Number, index: true },
    catchRate: { type: Number, index: true },
    fleeRate: { type: Number, index: true },
    sourceFiles: { type: [String], default: [] },
    sourceHash: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    strict: false,
    minimize: false,
    versionKey: false,
  },
);

pokemonSchema.index({ dexNr: 1, form: 1 });
pokemonSchema.index({ generation: 1, regionId: 1, types: 1 });
pokemonSchema.index({ primaryType: 1, secondaryType: 1 });
pokemonSchema.index({ moveIds: 1, form: 1 });
pokemonSchema.index({ "flags.released": 1, "flags.shinyReleased": 1 });
pokemonSchema.index({ searchTerms: "text" }, { default_language: "none" });

module.exports =
  mongoose.models.Pokemon || mongoose.model("Pokemon", pokemonSchema);
