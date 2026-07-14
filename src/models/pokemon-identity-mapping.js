const { createCurrentDatasetModel } = require("./current-dataset");

module.exports = createCurrentDatasetModel({
  modelName: "PokemonIdentityMapping",
  collectionName: "pokemon_identity_mappings",
  domain: "pokemon-identity-mappings",
});
