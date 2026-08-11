const currentEventUtils = require("../../runtime-data/PokemonGo-Data/tooling/lib/current-event-utils.js");
const entityPaths = require("../../runtime-data/PokemonGo-Data/tooling/lib/entity-paths.js");
const gameMasterExplorer = require("../../runtime-data/PokemonGo-Data/tooling/lib/game-master-explorer.js");
const gameMasterGenerator = require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateGameMasterExplorerIndex.js");
const gameMasterMappings = require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateGameMasterPokemonMappings.js");
const pokemonAssetResolver = require("../../runtime-data/PokemonGo-Data/tooling/lib/pokemon-canonical-asset-resolver.js");
const separatedAssetRecords = require("../../runtime-data/PokemonGo-Data/tooling/lib/separated-asset-records.js");
const { dataRoot } = require("./data-repository");

const serverlessGameMasterGenerator = {
  ...gameMasterGenerator,
  generateGameMasterExplorerIndex(options = {}) {
    return gameMasterGenerator.generateGameMasterExplorerIndex({
      ...options,
      rootDir: dataRoot,
    });
  },
};

module.exports = {
  currentEventUtils,
  entityPaths,
  gameMasterExplorer,
  gameMasterGenerator: serverlessGameMasterGenerator,
  gameMasterMappings,
  pokemonAssetResolver,
  separatedAssetRecords,
};
