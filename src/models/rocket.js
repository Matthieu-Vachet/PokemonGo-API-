const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "Rocket",
  collectionName: "rockets",
  domain: "rocket",
});
