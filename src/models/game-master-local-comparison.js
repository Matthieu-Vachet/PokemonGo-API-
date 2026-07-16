const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  snapshotId: { type: String, required: true, index: true },
  comparisonKey: { type: String, required: true },
  templateId: { type: String, required: true },
  pokemonId: { type: Number, default: null, index: true },
  pokemon: { type: String, default: null },
  form: { type: String, default: null },
  costume: { type: String, default: null },
  assetBundleValue: { type: String, default: null },
  assetBundleSuffix: { type: String, default: null },
  assetBundleSource: { type: String, default: null },
  assetBundleResolved: { type: Boolean, default: false },
  assetBundlePaths: { type: mongoose.Schema.Types.Mixed, default: null },
  isFemale: { type: Boolean, default: null },
  localForm: { type: String, default: null },
  localCostume: { type: String, default: null },
  localPokemonFormId: { type: String, default: null },
  localIdentity: { type: String, default: null },
  localFile: { type: String, default: null },
  localAssetsRef: { type: String, default: null },
  localAssetFormCount: { type: Number, default: 0 },
  localFormSource: { type: String, default: null },
  resolutionSource: { type: String, default: null },
  category: { type: String, default: null, index: true },
  dataType: { type: String, default: null, index: true },
  localAsset: { type: mongoose.Schema.Types.Mixed, default: null },
  genderVariants: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  gameAvailability: { type: mongoose.Schema.Types.Mixed, default: null },
  assetAvailability: { type: mongoose.Schema.Types.Mixed, default: null },
  mappingStatus: { type: String, required: true, index: true },
  ambiguityCount: { type: Number, default: 0 },
  candidateCount: { type: Number, default: 0 },
  ambiguousCandidates: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  ambiguityReason: { type: String, default: null },
  ambiguityExplanation: { type: String, default: null },
  localIdentityKey: { type: String, default: null },
  variantCategory: { type: String, default: null, index: true },
  searchText: { type: String, required: true },
  raw: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, versionKey: false, minimize: false });

schema.index({ snapshotId: 1, comparisonKey: 1 }, { unique: true });
schema.index({ snapshotId: 1, mappingStatus: 1, pokemonId: 1 });
schema.index({ snapshotId: 1, variantCategory: 1, mappingStatus: 1 });

module.exports = mongoose.models.GameMasterLocalComparison
  || mongoose.model("GameMasterLocalComparison", schema, "game_master_local_comparisons");
