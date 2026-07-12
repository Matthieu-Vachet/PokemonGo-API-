const MONGODB_SOURCE = "mongodb";
const zlib = require("node:zlib");

function compressedBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value.type === "Buffer" && Array.isArray(value.data)) return Buffer.from(value.data);
  if (value.buffer) return Buffer.from(value.buffer);
  return Buffer.from(value);
}

function hydrateCurrentDatasetDocument(document) {
  if (!document?.compressedData) return document;
  const buffer = compressedBuffer(document.compressedData);
  const data = JSON.parse(zlib.gunzipSync(buffer).toString("utf8"));
  return { ...document, data };
}

function datasetReadFailure(status, domain, error, message) {
  return {
    ok: false,
    status,
    body: {
      success: false,
      source: MONGODB_SOURCE,
      error,
      message,
      domain,
    },
  };
}

async function readCurrentDatasetFromMongo({ model, domain, isConnected }) {
  if (isConnected === false) {
    return datasetReadFailure(
      503,
      domain,
      "MONGODB_UNAVAILABLE",
      `MongoDB n'est pas disponible pour le domaine ${domain}.`,
    );
  }

  let document;
  try {
    document = hydrateCurrentDatasetDocument(await model.findOne({ key: "current" }).lean());
  } catch (_error) {
    return datasetReadFailure(
      503,
      domain,
      "MONGODB_UNAVAILABLE",
      `MongoDB n'est pas disponible pour le domaine ${domain}.`,
    );
  }
  if (!document || document.data === null || document.data === undefined) {
    return datasetReadFailure(
      404,
      domain,
      "CURRENT_DATASET_NOT_FOUND",
      `Aucun dataset courant n'est disponible dans MongoDB pour le domaine ${domain}.`,
    );
  }

  return { ok: true, data: document.data, document };
}

function serializeCurrentDatasetDocument(document) {
  const source = document?.toObject ? document.toObject() : { ...(document || {}) };
  delete source._id;
  delete source.__v;
  delete source.compressedData;
  return source;
}

module.exports = {
  MONGODB_SOURCE,
  hydrateCurrentDatasetDocument,
  readCurrentDatasetFromMongo,
  serializeCurrentDatasetDocument,
};
