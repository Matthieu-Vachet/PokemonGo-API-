const MONGODB_SOURCE = "mongodb";

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
  if (!isConnected) {
    return datasetReadFailure(
      503,
      domain,
      "MONGODB_UNAVAILABLE",
      `MongoDB n'est pas disponible pour le domaine ${domain}.`,
    );
  }

  const document = await model.findOne({ key: "current" }).lean();
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
  return source;
}

module.exports = {
  MONGODB_SOURCE,
  readCurrentDatasetFromMongo,
  serializeCurrentDatasetDocument,
};
