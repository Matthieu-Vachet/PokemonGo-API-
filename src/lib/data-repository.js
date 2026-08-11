const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(process.env.POKEMON_GO_APP_ROOT || process.cwd());
const packageName = "pokemon-go-data";

class PokemonGoDataRuntimeError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "PokemonGoDataRuntimeError";
    this.code = code;
    this.details = details;
  }
}

function hasDataShape(directory) {
  if (!directory) return false;
  try {
    if (JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8")).name !== packageName) return false;
  } catch {
    return false;
  }
  return [
    ["data", "pokemon"],
    ["data", "assets"],
    ["data", "pvp"],
    ["data", "moves"],
    ["data", "reference"],
    ["tooling", "lib"],
    ["tooling", "scripts", "generators"],
  ].every((segments) => fs.existsSync(path.join(directory, ...segments)));
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
    { source: "POKEMON_GO_DATA_DIR", value: process.env.POKEMON_GO_DATA_DIR },
    { source: "DATA_REPOSITORY_DIR", value: process.env.DATA_REPOSITORY_DIR },
    { source: "runtime-data", value: path.join(appRoot, "runtime-data", "PokemonGo-Data") },
    { source: "legacy-.data", value: path.join(appRoot, ".data", "PokemonGo-Data") },
    { source: "workspace-neighbor", value: path.resolve(appRoot, "..", "PokemonGo-Data") },
    { source: "legacy-data", value: path.join(appRoot, "data") },
    { source: "node-package", value: optionalPackageRoot() },
  ].filter((candidate) => candidate.value);
}

let cachedRoot = null;

function getPokemonGoDataRuntimeRoot({ refresh = false } = {}) {
  if (!refresh && cachedRoot && hasDataShape(cachedRoot)) return cachedRoot;
  const attempts = [];
  for (const candidate of candidateRoots()) {
    const absolute = path.resolve(candidate.value);
    let resolved = absolute;
    try {
      resolved = fs.realpathSync(absolute);
    } catch {
      // A missing candidate is reported below without masking the next valid root.
    }
    const valid = hasDataShape(resolved);
    attempts.push({ source: candidate.source, path: absolute, resolved, valid });
    if (!valid) continue;
    cachedRoot = resolved;
    if (process.env.POKEMON_GO_RUNTIME_DEBUG === "1") {
      console.info("[pokemon-go-data-runtime] root resolved", {
        source: candidate.source,
        root: cachedRoot,
        symlinkResolved: absolute !== cachedRoot,
      });
    }
    return cachedRoot;
  }

  throw new PokemonGoDataRuntimeError(
    "Depot Pokemon GO data introuvable ou incomplet.",
    "POKEMON_DATA_ROOT_NOT_FOUND",
    {
      appRoot,
      expectedPackage: packageName,
      attempts,
      remediation: "Configure POKEMON_GO_DATA_DIR ou materialise runtime-data/PokemonGo-Data avant le build.",
    },
  );
}

function assertInsideRoot(root, target, relativePath) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new PokemonGoDataRuntimeError(
      "Acces refuse en dehors du depot PokemonGo-Data.",
      "POKEMON_DATA_PATH_OUTSIDE_ROOT",
      { root, relativePath },
    );
  }
}

function resolvePokemonGoDataFile(relativePath, { mustExist = false, type = "any" } = {}) {
  const root = getPokemonGoDataRuntimeRoot();
  const normalized = Array.isArray(relativePath)
    ? path.join(...relativePath)
    : String(relativePath || "").replace(/\\/g, "/");
  if (!normalized || path.isAbsolute(normalized)) {
    throw new PokemonGoDataRuntimeError(
      "Le chemin PokemonGo-Data doit etre relatif et non vide.",
      "POKEMON_DATA_PATH_INVALID",
      { relativePath: normalized },
    );
  }
  const target = path.resolve(root, normalized);
  assertInsideRoot(root, target, normalized);

  if (mustExist && !fs.existsSync(target)) {
    throw new PokemonGoDataRuntimeError(
      `Ressource PokemonGo-Data introuvable: ${normalized}.`,
      "POKEMON_DATA_RESOURCE_NOT_FOUND",
      { root, relativePath: normalized, target, type },
    );
  }
  if (mustExist) {
    const realTarget = fs.realpathSync(target);
    assertInsideRoot(root, realTarget, normalized);
    const stat = fs.statSync(realTarget);
    if ((type === "file" && !stat.isFile()) || (type === "directory" && !stat.isDirectory())) {
      throw new PokemonGoDataRuntimeError(
        `Type de ressource PokemonGo-Data invalide: ${normalized}.`,
        "POKEMON_DATA_RESOURCE_TYPE_INVALID",
        { relativePath: normalized, expectedType: type },
      );
    }
  }
  return target;
}

function resolvePokemonGoDataModule(relativePath) {
  const modulePath = resolvePokemonGoDataFile(relativePath, { mustExist: true, type: "file" });
  if (!/\.(?:c?js|mjs)$/.test(modulePath)) {
    throw new PokemonGoDataRuntimeError(
      "Le module runtime PokemonGo-Data doit etre un fichier JavaScript.",
      "POKEMON_DATA_MODULE_INVALID",
      { relativePath },
    );
  }
  return modulePath;
}

const dataRoot = getPokemonGoDataRuntimeRoot();

function dataPath(...segments) {
  return resolvePokemonGoDataFile(segments);
}

function appPath(...segments) {
  return path.join(appRoot, ...segments);
}

function stripDataPrefix(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .replace(/^\.?\/*data\/data\//, "data/")
    .replace(/^\.?\/*repository\//, "")
    .replace(/^\.?\/*/, "");
}

function dataPathFromRelative(relativePath) {
  return resolvePokemonGoDataFile(stripDataPrefix(relativePath));
}

function relativeToData(file) {
  return path.relative(dataRoot, file).replace(/\\/g, "/");
}

function relativeToApp(file) {
  const absolute = path.resolve(file);
  const dataRelative = relativeToData(absolute);
  if (dataRelative && !dataRelative.startsWith("..") && !path.isAbsolute(dataRelative))
    return dataRelative.startsWith("data/") ? dataRelative : `repository/${dataRelative}`;
  return path.relative(appRoot, absolute).replace(/\\/g, "/");
}

function isInsideData(file) {
  const relative = path.relative(dataRoot, path.resolve(file));
  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
}

module.exports = {
  PokemonGoDataRuntimeError,
  appPath,
  appRoot,
  candidateRoots,
  dataPath,
  dataPathFromRelative,
  dataRoot,
  getPokemonGoDataRuntimeRoot,
  hasDataShape,
  isInsideData,
  relativeToApp,
  relativeToData,
  resolveDataFile: dataPathFromRelative,
  resolvePokemonGoDataFile,
  resolvePokemonGoDataModule,
  stripDataPrefix,
};
