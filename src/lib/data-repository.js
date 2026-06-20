const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(process.env.POKEMON_GO_APP_ROOT || process.cwd());
const packageName = "pokemon-go-data";

function hasDataShape(directory) {
  return (
    directory &&
    fs.existsSync(path.join(directory, "pokemon")) &&
    fs.existsSync(path.join(directory, "pokemon-forms")) &&
    fs.existsSync(path.join(directory, "moves"))
  );
}

function optionalPackageRoot() {
  try {
    return path.dirname(require.resolve(`${packageName}/package.json`));
  } catch {
    return null;
  }
}

function candidateRoots() {
  return [
    process.env.POKEMON_GO_DATA_DIR,
    process.env.DATA_REPOSITORY_DIR,
    path.join(appRoot, ".data", "PokemonGo-Data"),
    path.resolve(appRoot, "..", "PokemonGo-Data"),
    path.join(appRoot, "data"),
    optionalPackageRoot(),
  ].filter(Boolean);
}

function resolveDataRoot() {
  const explicit = process.env.POKEMON_GO_DATA_DIR || process.env.DATA_REPOSITORY_DIR;
  for (const candidate of candidateRoots()) {
    const root = path.resolve(candidate);
    if (hasDataShape(root)) return root;
  }

  const expected = explicit || "../PokemonGo-Data ou node_modules/pokemon-go-data";
  throw new Error(
    `Depot Pokemon GO data introuvable. Configure POKEMON_GO_DATA_DIR ou installe ${packageName}. Attendu: ${expected}`,
  );
}

const dataRoot = resolveDataRoot();

function dataPath(...segments) {
  return path.join(dataRoot, ...segments);
}

function appPath(...segments) {
  return path.join(appRoot, ...segments);
}

function stripDataPrefix(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\/*data\//, "")
    .replace(/^\.?\/*/, "");
}

function dataPathFromRelative(relativePath) {
  return dataPath(...stripDataPrefix(relativePath).split("/").filter(Boolean));
}

function relativeToData(file) {
  return path.relative(dataRoot, file).replace(/\\/g, "/");
}

function relativeToApp(file) {
  const absolute = path.resolve(file);
  const dataRelative = relativeToData(absolute);
  if (dataRelative && !dataRelative.startsWith("..") && !path.isAbsolute(dataRelative))
    return `data/${dataRelative}`;
  return path.relative(appRoot, absolute).replace(/\\/g, "/");
}

function isInsideData(file) {
  const relative = path.relative(dataRoot, path.resolve(file));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function resolveDataFile(relativeFile) {
  return dataPathFromRelative(relativeFile);
}

module.exports = {
  appPath,
  appRoot,
  dataPath,
  dataPathFromRelative,
  dataRoot,
  isInsideData,
  relativeToApp,
  relativeToData,
  resolveDataFile,
  stripDataPrefix,
};
