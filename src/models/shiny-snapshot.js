const { createDatasetSnapshotModel } = require("./dataset-snapshot");

module.exports = createDatasetSnapshotModel({
  modelName: "ShinySnapshot",
  collectionName: "shiny_snapshots",
  domain: "shiny",
});
