const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "BestAttacker",
  collectionName: "best_attackers",
  domain: "best-attackers",
});
