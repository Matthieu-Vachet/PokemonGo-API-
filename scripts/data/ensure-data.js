const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "../..");
const defaultRepo = "https://github.com/Matthieu-Vachet/PokemonGo-Data.git";
const targetDir = path.join(appRoot, "runtime-data", "PokemonGo-Data");

function hasDataShape(directory) {
  if (!directory) return false;
  try {
    const packageMetadata = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
    const versionMetadata = JSON.parse(fs.readFileSync(path.join(directory, "version.json"), "utf8"));
    if (packageMetadata.name !== "pokemon-go-data") return false;
    if (!versionMetadata.appVersion || !versionMetadata.dataVersion || !versionMetadata.schemaVersion) return false;
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

function candidates() {
  return [
    process.env.POKEMON_GO_DATA_DIR,
    process.env.DATA_REPOSITORY_DIR,
    targetDir,
    path.join(appRoot, ".data", "PokemonGo-Data"),
    path.resolve(appRoot, "..", "PokemonGo-Data"),
    path.join(appRoot, "data"),
  ].filter(Boolean);
}

function pathExists(value) {
  try {
    fs.lstatSync(value);
    return true;
  } catch {
    return false;
  }
}

function materializeRuntimeData(sourceDir) {
  const source = path.resolve(sourceDir);
  if (source === targetDir) return targetDir;
  if (pathExists(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  try {
    fs.symlinkSync(source, targetDir, process.platform === "win32" ? "junction" : "dir");
  } catch {
    fs.cpSync(source, targetDir, {
      recursive: true,
      filter: (entry) => !String(entry).split(path.sep).includes(".git"),
    });
  }
  return targetDir;
}

function authenticatedRepoUrl(repo, token) {
  if (!token || !repo.startsWith("https://github.com/")) return repo;
  return repo.replace("https://github.com/", `https://x-access-token:${token}@github.com/`);
}

function ensureData() {
  for (const candidate of candidates()) {
    if (hasDataShape(path.resolve(candidate))) {
      const runtimeDir = materializeRuntimeData(candidate);
      console.log(`[data] dataset trouve: ${runtimeDir}`);
      return;
    }
  }

  const repo = process.env.POKEMON_GO_DATA_REPO || defaultRepo;
  const ref = process.env.POKEMON_GO_DATA_REF || "main";
  const token = process.env.POKEMON_GO_DATA_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const cloneUrl = authenticatedRepoUrl(repo, token);

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });
  if (fs.existsSync(targetDir))
    fs.rmSync(targetDir, { recursive: true, force: true });

  try {
    childProcess.execFileSync(
      "git",
      ["clone", "--depth", "1", "--branch", ref, cloneUrl, targetDir],
      { stdio: "inherit" },
    );
  } catch (error) {
    throw new Error(
      "Impossible de recuperer PokemonGo-Data. Configure POKEMON_GO_DATA_DIR en local ou POKEMON_GO_DATA_TOKEN sur Vercel/GitHub Actions.",
    );
  }

  if (!hasDataShape(targetDir))
    throw new Error(`PokemonGo-Data clone mais structure invalide: ${targetDir}`);

  console.log(`[data] dataset clone: ${targetDir}`);
}

ensureData();
