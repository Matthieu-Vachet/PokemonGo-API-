const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  league: { type: String, required: true, index: true },
  speciesId: { type: String, required: true, index: true },
  sourceHash: { type: String, required: true },
  sourceUrl: { type: String, required: true },
  fetchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  items: { type: [mongoose.Schema.Types.Mixed], default: [] },
  diagnostics: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { timestamps: true, strict: true, minimize: false, versionKey: false });

module.exports = mongoose.models.PvpTeammateCache
  || mongoose.model("PvpTeammateCache", schema, "pvp_teammate_cache");
