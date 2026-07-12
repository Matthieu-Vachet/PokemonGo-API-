const mongoose = require("mongoose");

function createDatasetSnapshotSchema(domain) {
  const schema = new mongoose.Schema(
    {
      domain: { type: String, required: true, enum: [domain], index: true },
      visibility: { type: String, required: true, enum: ["public", "private"], index: true },
      snapshotAt: { type: Date, required: true, index: true },
      sourceHash: { type: String, required: true, index: true },
      count: { type: Number, required: true, min: 0 },
      source: { type: mongoose.Schema.Types.Mixed, required: true },
      diagnostics: { type: mongoose.Schema.Types.Mixed, required: true },
      data: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    { timestamps: true, strict: false, minimize: false, versionKey: false },
  );
  schema.index({ domain: 1, snapshotAt: -1 });
  return schema;
}

function createDatasetSnapshotModel({ modelName, collectionName, domain }) {
  if (mongoose.models[modelName]) return mongoose.models[modelName];
  return mongoose.model(modelName, createDatasetSnapshotSchema(domain), collectionName);
}

module.exports = { createDatasetSnapshotModel, createDatasetSnapshotSchema };
