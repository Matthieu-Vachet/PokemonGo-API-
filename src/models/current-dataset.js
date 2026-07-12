const mongoose = require("mongoose");

const DATASET_STATUSES = ["success", "error"];

function createCurrentDatasetSchema(domain) {
  return new mongoose.Schema(
    {
      key: { type: String, required: true, unique: true },
      domain: {
        type: String,
        required: true,
        enum: [domain],
        default: domain,
      },
      visibility: {
        type: String,
        required: true,
        enum: ["public", "private"],
      },
      source: { type: mongoose.Schema.Types.Mixed, required: true },
      generatedAt: { type: Date, required: true },
      savedAt: { type: Date, required: true },
      count: { type: Number, required: true, min: 0 },
      sourceHash: { type: String, required: true },
      status: {
        type: String,
        required: true,
        enum: DATASET_STATUSES,
      },
      data: { type: mongoose.Schema.Types.Mixed, required: true },
      compressedData: { type: Buffer },
      diagnostics: { type: mongoose.Schema.Types.Mixed, required: true },
      sourceFile: { type: String },
    },
    { timestamps: true, strict: false, minimize: false, versionKey: false },
  );
}

function createCurrentDatasetModel({ modelName, collectionName, domain }) {
  const existingModel = mongoose.models[modelName];
  if (existingModel) return existingModel;

  const schema = createCurrentDatasetSchema(domain);
  return mongoose.model(modelName, schema, collectionName);
}

module.exports = {
  DATASET_STATUSES,
  createCurrentDatasetModel,
  createCurrentDatasetSchema,
};
