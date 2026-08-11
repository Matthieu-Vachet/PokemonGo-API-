const fs = require("node:fs");
const path = require("node:path");
const { ApiError } = require("./api-error");
const {
  dataRoot,
  resolvePokemonGoDataFile,
  resolvePokemonGoDataModule,
} = require("./data-repository");

// Literal requires are intentional: Next/Vercel can trace and bundle every generator
// and every transitive dependency without relying on a runtime filesystem require.
const modules = Object.freeze({
  "pokemon-identity-mappings": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateGameMasterPokemonMappings.js"),
  "best-attackers": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateBestAttackers.js"),
  "best-defenders": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateBestDefenders.js"),
  "costume-audit": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCostumeAudit.js"),
  shiny: require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateShinyTracker.js"),
  "pvp-rankings": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generatePvpRankings.js"),
  "gbl-calendar": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateGblCalendar.js"),
  raids: require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCurrentRaids.js"),
  eggs: require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCurrentEggs.js"),
  "max-battles": require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCurrentMaxBattles.js"),
  research: require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCurrentResearch.js"),
  rocket: require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateCurrentRocket.js"),
});

const definitions = Object.freeze({
  "pokemon-identity-mappings": ["generateGameMasterPokemonMappings.js", "generateGameMasterPokemonMappings", "data/reference/game-master/gameMasterPokemonMappings.json", "PokeMiners-game_masters", 180],
  "best-attackers": ["generateBestAttackers.js", "generateBestAttackers", "data/rankings/pve/attackers.json", "dialgadex-official-repository", 300],
  "best-defenders": ["generateBestDefenders.js", "generateBestDefenders", "data/rankings/pve/defenders.json", "pokemon-go-hub", 180],
  "costume-audit": ["generateCostumeAudit.js", "generateCostumeAudit", "operations/audits/costume/current.json", "margxt", 180],
  shiny: ["generateShinyTracker.js", "generateShinyTracker", "operations/audits/shiny/current.json", "snacknap", 180],
  "pvp-rankings": ["generatePvpRankings.js", "generatePvpRankings", "data/pvp/rankings/current.json", "pvpoke-official-repository", 600],
  "gbl-calendar": ["generateGblCalendar.js", "generateGblCalendar", "data/battles/gbl/calendar.json", "battleflow", 180],
  raids: ["generateCurrentRaids.js", "generateCurrentRaids", "data/battles/raids/current.json", "leekduck", 180],
  eggs: ["generateCurrentEggs.js", "generateCurrentEggs", "data/activities/eggs/current.json", "leekduck", 180],
  "max-battles": ["generateCurrentMaxBattles.js", "generateCurrentMaxBattles", "data/battles/max-battles/current.json", "snacknap", 180],
  research: ["generateCurrentResearch.js", "generateCurrentResearch", "data/activities/research/current.json", "leekduck", 180],
  rocket: ["generateCurrentRocket.js", "generateCurrentRocket", "data/battles/rocket/current.json", "leekduck", 180],
});

const generatorRegistry = Object.freeze(Object.fromEntries(
  Object.entries(definitions).map(([key, [scriptName, exportName, outputPath, provider, timeoutSeconds]]) => {
    const modulePath = `tooling/scripts/generators/${scriptName}`;
    return [key, Object.freeze({
      key,
      modulePath,
      exportName,
      outputPath,
      provider,
      permissions: ["admin:regenerate"],
      timeoutSeconds,
      runtime: "vercel-nodejs",
      status: "active",
      module: modules[key],
      generator: modules[key]?.[exportName],
    })];
  }),
));

function getGeneratorRegistration(key) {
  const registration = generatorRegistry[key];
  if (!registration) {
    throw new ApiError(500, `Generateur non enregistre: ${key}.`, "GENERATOR_REGISTRY_MISSING", {
      key,
      registered: Object.keys(generatorRegistry),
    });
  }
  if (typeof registration.generator !== "function") {
    throw new ApiError(500, `Export invalide pour le generateur ${key}.`, "GENERATOR_REGISTRY_EXPORT_INVALID", {
      key,
      modulePath: registration.modulePath,
      exportName: registration.exportName,
    });
  }
  return registration;
}

function validateGeneratorRegistry() {
  const errors = [];
  for (const registration of Object.values(generatorRegistry)) {
    try {
      resolvePokemonGoDataModule(registration.modulePath);
    } catch (error) {
      errors.push({ key: registration.key, field: "modulePath", code: error.code, message: error.message });
    }
    if (typeof registration.generator !== "function") {
      errors.push({ key: registration.key, field: "exportName", message: `Export ${registration.exportName} absent.` });
    }
    const output = resolvePokemonGoDataFile(registration.outputPath);
    if (!fs.existsSync(path.dirname(output))) {
      errors.push({ key: registration.key, field: "outputPath", message: `Dossier de sortie absent: ${registration.outputPath}.` });
    }
    if (!registration.provider || !registration.permissions.length || registration.timeoutSeconds <= 0) {
      errors.push({ key: registration.key, field: "metadata", message: "Metadonnees runtime incompletes." });
    }
  }
  return {
    valid: errors.length === 0,
    root: dataRoot,
    count: Object.keys(generatorRegistry).length,
    keys: Object.keys(generatorRegistry),
    errors,
  };
}

module.exports = {
  generatorRegistry,
  getGeneratorRegistration,
  validateGeneratorRegistry,
};
