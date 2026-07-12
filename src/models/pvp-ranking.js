const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "PvpRanking",
  collectionName: "pvp_rankings",
  domain: "pvp-rankings",
});
