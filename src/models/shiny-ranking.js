const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "ShinyRanking",
  collectionName: "shiny_rankings",
  domain: "shiny",
});
