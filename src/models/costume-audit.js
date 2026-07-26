const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "CostumeAudit",
  collectionName: "costume_audits",
  domain: "costume-audit",
});
