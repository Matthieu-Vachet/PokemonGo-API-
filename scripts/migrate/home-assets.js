const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath } = require("../../src/lib/data-repository");
const { refreshAssetManifest, writeFamilyAsset } = require("../../src/lib/canonical-asset-writer");

const sourceDir = path.join(rootDir, "asset", "HD");
const pokemonDir = dataPath("data", "pokemon", "normal");
const write = process.argv.includes("--write");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/PokemonHd";
const filenamePattern =
  /^poke_capture_(\d{4})_(\d{3})_([^_]+)_([^_]+)_(\d{8})_([^_]+)_([nr])\.png$/;
const copySuffix = / \d+\.json$/;

const genderNames = {
  fd: "female-difference",
  fo: "female-only",
  md: "male-difference",
  mf: "shared",
  mo: "male-only",
  uk: "genderless",
};

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function url(filename) {
  return `${remoteBase}/${filename}`;
}

function variantKey(asset) {
  return [
    asset.dexId,
    asset.formIndex,
    asset.genderCode,
    asset.gigantamax ? "g" : "n",
    asset.detail,
    asset.view,
  ].join(":");
}

function parse(filename) {
  const match = filename.match(filenamePattern);
  if (!match) return null;
  return {
    dexId: match[1],
    formIndex: match[2],
    genderCode: match[3],
    gigantamax: match[4] === "g",
    detail: match[5],
    view: match[6] === "b" ? "back" : "front",
    color: match[7],
    filename,
  };
}

function score(variant) {
  return [
    variant.formIndex === "000",
    !variant.gigantamax,
    variant.detail === "00000000",
    variant.view === "front",
    variant.genderCode === "mf",
    variant.genderCode === "uk",
    variant.genderCode === "md",
    variant.genderCode === "mo",
  ].reduce((total, preferred, index) => total + (preferred ? 2 ** (8 - index) : 0), 0);
}

function homeAssets(assets) {
  const grouped = new Map();
  for (const asset of assets) {
    const key = variantKey(asset);
    const variant = grouped.get(key) || {
      formIndex: asset.formIndex,
      gender: genderNames[asset.genderCode] || "unknown",
      genderCode: asset.genderCode,
      gigantamax: asset.gigantamax,
      detail: asset.detail,
      view: asset.view,
    };
    variant[asset.color === "r" ? "shinyImage" : "image"] = url(asset.filename);
    grouped.set(key, variant);
  }

  const variants = [...grouped.values()].sort((left, right) =>
    [
      left.formIndex.localeCompare(right.formIndex),
      left.genderCode.localeCompare(right.genderCode),
      Number(left.gigantamax) - Number(right.gigantamax),
      left.detail.localeCompare(right.detail),
      left.view.localeCompare(right.view),
    ].find((difference) => difference !== 0) || 0,
  );
  const main = [...variants]
    .filter((variant) => variant.image)
    .sort((left, right) => score(right) - score(left))[0];
  const shiny =
    variants.find(
      (variant) =>
        variant.shinyImage &&
        main &&
        variant.formIndex === main.formIndex &&
        variant.genderCode === main.genderCode &&
        variant.gigantamax === main.gigantamax &&
        variant.detail === main.detail &&
        variant.view === main.view,
    ) || [...variants].filter((variant) => variant.shinyImage).sort((left, right) => score(right) - score(left))[0];

  return {
    source: "pokemon-home",
    image: main?.image || null,
    shinyImage: shiny?.shinyImage || null,
    variants,
  };
}

const byDex = new Map();
for (const filename of fs.existsSync(sourceDir) ? fs.readdirSync(sourceDir) : []) {
  const asset = parse(filename);
  if (!asset) continue;
  const assets = byDex.get(asset.dexId) || [];
  assets.push(asset);
  byDex.set(asset.dexId, assets);
}

const pokemonFiles = fs
  .readdirSync(pokemonDir)
  .filter((filename) => filename.endsWith(".json") && !copySuffix.test(filename))
  .map((filename) => path.join(pokemonDir, filename));
const availableDex = new Set();
const changed = [];

for (const file of pokemonFiles) {
  const data = read(file);
  availableDex.add(data.dexId);
  const home = byDex.get(data.dexId);
  if (!home) continue;
  const update = writeFamilyAsset(data, "home", homeAssets(home), { write });
  if (update.changed) changed.push(update.reference);
}
refreshAssetManifest({ write });

const skippedDex = [...byDex.keys()].filter((dexId) => !availableDex.has(dexId)).sort();
console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      sourceImages: [...byDex.values()].reduce((total, assets) => total + assets.length, 0),
      sourcePokemon: byDex.size,
      changedFiles: changed.length,
      skippedDex,
    },
    null,
    2,
  ),
);
