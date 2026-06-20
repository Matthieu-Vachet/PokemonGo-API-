const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const pokemonDir = dataPath("pokemon");
const megaFormsDir = dataPath("pokemon-forms", "mega");
const typesDir = dataPath("types");
const typesIndex = path.join(typesDir, "types.json");
const portraitsDir = path.join(rootDir, "asset", "MegaPortraits");
const typeBackgroundsDir = path.join(rootDir, "asset", "TypeBackgrounds");
const stickersDir = path.join(rootDir, "asset", "Stickers");
const stickersCatalog = dataPath("stickers", "stickers.json");
const reportFile = dataPath("visual-assets-import-report.json");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main";
const treeSource =
  "https://api.github.com/repos/Matthieu-Vachet/PokemonGo-Assets-API/git/trees/main?recursive=1";

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function slug(value) {
  return String(value)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function stickerCategory(filename) {
  const value = filename.replace(/\.[^.]+$/, "").replace(/^sticker[_-]?/i, "");
  return value.split(/[_-]/)[0]?.toLowerCase() || "misc";
}

async function stickerFiles() {
  if (fs.existsSync(stickersDir)) {
    return fs
      .readdirSync(stickersDir)
      .filter((name) => /\.(png|webp|jpe?g)$/i.test(name))
      .sort();
  }
  const response = await fetch(treeSource, {
    headers: { "user-agent": "PokemonGo-API visual assets importer" },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${treeSource}`);
  const tree = await response.json();
  return (tree.tree || [])
    .filter(
      (item) =>
        item.type === "blob" &&
        item.path.startsWith("Stickers/") &&
        /\.(png|webp|jpe?g)$/i.test(item.path),
    )
    .map((item) => path.basename(item.path))
    .sort();
}

function portraitCatalog() {
  const portraits = new Map();
  if (!fs.existsSync(portraitsDir)) return portraits;
  for (const filename of fs.readdirSync(portraitsDir).sort()) {
    const preferred = filename.match(
      /^mega_portrait_(\d+)_(MEGA(?:_[XY])?|PRIMAL)(\.s)?\.png$/,
    );
    const fallback = filename.match(
      /^pm(\d+)\.f(MEGA(?:_[XY])?|PRIMAL)(\.s)?\.portrait\.png$/,
    );
    const match = preferred || fallback;
    if (!match) continue;
    const key = `${Number(match[1])}_${match[2]}`;
    const entry = portraits.get(key) || {};
    const field = match[3] ? "portraitShiny" : "portrait";
    if (preferred || !entry[field])
      entry[field] = `${remoteBase}/MegaPortraits/${filename}`;
    portraits.set(key, entry);
  }
  return portraits;
}

function megaKey(dexNr, formId) {
  if (formId.endsWith("_MEGA_X")) return `${dexNr}_MEGA_X`;
  if (formId.endsWith("_MEGA_Y")) return `${dexNr}_MEGA_Y`;
  if (formId.endsWith("_PRIMAL")) return `${dexNr}_PRIMAL`;
  return `${dexNr}_MEGA`;
}

async function main() {
  const write = process.argv.includes("--write");
  const portraits = portraitCatalog();
  const pokemonChanges = [];
  const megaFormChanges = [];
  const matchedMegas = [];
  const unmatchedMegas = [];

  for (const filename of fs.readdirSync(pokemonDir).filter((name) => name.endsWith(".json"))) {
    const file = path.join(pokemonDir, filename);
    const pokemon = read(file);
    if (!pokemon.megaEvolutions || Array.isArray(pokemon.megaEvolutions)) continue;
    let changed = false;
    for (const [formId, mega] of Object.entries(pokemon.megaEvolutions)) {
      const assets = portraits.get(megaKey(pokemon.dexNr, formId));
      if (!assets) {
        unmatchedMegas.push(formId);
        continue;
      }
      matchedMegas.push(formId);
      const nextAssets = { ...(mega.assets || {}), ...assets };
      if (!same(mega.assets, nextAssets)) {
        mega.assets = nextAssets;
        changed = true;
      }
    }
    if (!changed) continue;
    pokemonChanges.push(relativeToApp(file));
    if (write) writeJson(file, pokemon);
  }

  if (fs.existsSync(megaFormsDir)) {
    for (const filename of fs.readdirSync(megaFormsDir).filter((name) => name.endsWith(".json"))) {
      const file = path.join(megaFormsDir, filename);
      const mega = read(file);
      const assets = portraits.get(megaKey(mega.dexNr, mega.formId || mega.id));
      if (!assets) {
        unmatchedMegas.push(mega.formId || mega.id);
        continue;
      }
      matchedMegas.push(mega.formId || mega.id);
      const nextAssets = { ...(mega.assets || {}), ...assets };
      if (same(mega.assets, nextAssets)) continue;
      mega.assets = nextAssets;
      megaFormChanges.push(relativeToApp(file));
      if (write) writeJson(file, mega);
    }
  }

  const types = read(typesIndex);
  const typeChanges = [];
  const nextTypes = types.map((type) => {
    const filename = `details_type_bg_${type.slug}.png`;
    const background = fs.existsSync(path.join(typeBackgroundsDir, filename))
      ? `${remoteBase}/TypeBackgrounds/${filename}`
      : `${remoteBase}/TypeBackgrounds/details_type_bg_default.png`;
    const next = { ...type, assets: { ...(type.assets || {}), background } };
    const file = path.join(typesDir, `${type.slug}.json`);
    if (!fs.existsSync(file) || !same(read(file), next)) {
      typeChanges.push(relativeToApp(file));
      if (write) writeJson(file, next);
    }
    return next;
  });
  if (!same(types, nextTypes)) {
    typeChanges.push(relativeToApp(typesIndex));
    if (write) writeJson(typesIndex, nextTypes);
  }

  const stickerNames = await stickerFiles();
  const stickers = stickerNames.map((filename) => ({
    id: slug(filename),
    filename,
    category: stickerCategory(filename),
    image: `${remoteBase}/Stickers/${encodeURIComponent(filename)}`,
  }));
  const stickersChanged = !fs.existsSync(stickersCatalog) || !same(read(stickersCatalog), stickers);
  if (write && stickersChanged) writeJson(stickersCatalog, stickers);

  const report = {
    generatedAt: new Date().toISOString(),
    write,
    sources: {
      megaPortraits: `${remoteBase}/MegaPortraits`,
      typeBackgrounds: `${remoteBase}/TypeBackgrounds`,
      stickers: treeSource,
    },
    megaPortraitFiles: fs.existsSync(portraitsDir) ? fs.readdirSync(portraitsDir).length : 0,
    matchedMegas: [...new Set(matchedMegas)].sort(),
    unmatchedMegas: [...new Set(unmatchedMegas)].sort(),
    pokemonChanges,
    megaFormChanges,
    typeBackgroundFiles: fs.existsSync(typeBackgroundsDir)
      ? fs.readdirSync(typeBackgroundsDir).length
      : 0,
    typeChanges,
    stickers: stickers.length,
    stickersChanged,
  };
  writeJson(reportFile, report);
  console.log(
    `${write ? "Écriture" : "Simulation"}: ${matchedMegas.length} Méga associées, ` +
      `${nextTypes.length} types, ${stickers.length} stickers.`,
  );
  console.log(
    `À modifier: ${pokemonChanges.length} Pokémon, ${megaFormChanges.length} formes Méga, ` +
      `${typeChanges.length} fichiers de types, ` +
      `${stickersChanged ? 1 : 0} catalogue stickers.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
