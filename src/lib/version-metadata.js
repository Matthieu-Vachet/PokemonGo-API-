const fs = require("node:fs");

const packageMetadata = require("../../package.json");
const { dataPath } = require("./data-repository");

function readDataVersion() {
  return JSON.parse(fs.readFileSync(dataPath("version.json"), "utf8"));
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
