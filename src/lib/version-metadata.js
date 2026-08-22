const packageMetadata = require("../../package.json");
// Keep the canonical Data version in Next.js' static dependency graph. Dynamic
// fs reads alone can be omitted from a serverless function trace even when the
// rest of the runtime dataset is covered by outputFileTracingIncludes.
const dataVersionMetadata = require("../../runtime-data/PokemonGo-Data/version.json");

function readDataVersion() {
  return dataVersionMetadata;
}

function versionMetadata() {
  const data = readDataVersion();
  return {
    apiVersion: packageMetadata.version,
    dataVersion: data.dataVersion,
    schemaVersion: data.schemaVersion,
    generatedAt: data.generatedAt,
    dataAppVersion: data.appVersion,
  };
}

module.exports = { readDataVersion, versionMetadata };
