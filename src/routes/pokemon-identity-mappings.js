const { getCurrentDatasetAdapter } = require("../current-datasets/adapters");
const { createCurrentDatasetRouter } = require("../current-datasets/router");

module.exports = createCurrentDatasetRouter(getCurrentDatasetAdapter("pokemon-identity-mappings"));
