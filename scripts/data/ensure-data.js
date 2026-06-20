const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const appRoot = path.resolve(__dirname, "../..");
const defaultRepo = "https://github.com/Matthieu-Vachet/PokemonGo-Data.git";
const targetDir = path.join(appRoot, ".data", "PokemonGo-Data");

function hasDataShape(directory) {
  return (
    directory &&
    fs.existsSync(path.join(directory, "pokemon")) &&
    fs.existsSync(path.join(directory, "pokemon-forms")) &&
    fs.existsSync(path.join(directory, "moves"))
  );
}

function candidates() {
  return [
    process.env.POKEMON_GO_DATA_DIR,
    process.env.DATA_REPOSITORY_DIR,
    targetDir,
    path.resolve(appRoot, "..", "PokemonGo-Data"),
    path.join(appRoot, "data"),
  ].filter(Boolean);
}

function authenticatedRepoUrl(repo, token) {
  if (!token || !repo.startsWith("https://github.com/")) return repo;
  return repo.replace("https://github.com/", `https://x-access-token:${token}@github.com/`);
}

function ensureData() {
  for (const candidate of candidates()) {
    if (hasDataShape(path.resolve(candidate))) {
      console.log(`[data] dataset trouve: ${path.resolve(candidate)}`);
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
