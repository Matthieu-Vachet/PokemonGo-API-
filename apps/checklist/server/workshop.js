const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const { detailForKey, validateSourceData } = require("./engine");

const rootDir = process.cwd();
const notesFile = path.join(rootDir, ".checklist-notes.json");
const reviewsFile = path.join(rootDir, ".checklist-image-reviews.json");
const hdDir = path.join(rootDir, "asset", "HD");
const typesFile = path.join(rootDir, "data", "types", "types.json");
const movesDir = path.join(rootDir, "data", "moves");
const remoteHd =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/PokemonHd";
const filenamePattern =
  /^poke_capture_(\d{4})_(\d{3})_([^_]+)_([^_]+)_(\d{8})_([^_]+)_([nr])\.png$/;
let remoteHdCache = null;

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function validate(data, relativeFile, kind) {
  return validateSourceData(data, relativeFile, kind);
}

function parseAsset(filename) {
  const match = filename.match(filenamePattern);
  if (!match) return null;
  return {
    dexId: match[1],
    formIndex: match[2],
    genderCode: match[3],
    gender:
      {
        fd: "différence femelle",
        fo: "femelle uniquement",
        md: "différence mâle",
        mf: "partagé",
        mo: "mâle uniquement",
        uk: "sans genre",
      }[match[3]] || "inconnu",
    gigantamax: match[4] === "g",
    detail: match[5],
    view: match[6] === "b" ? "back" : "front",
    shiny: match[7] === "r",
    filename,
    url: `${remoteHd}/${filename}`,
  };
}

async function allHdAssets() {
  if (fs.existsSync(hdDir))
    return fs.readdirSync(hdDir).map(parseAsset).filter(Boolean);
  if (remoteHdCache) return remoteHdCache;
  const response = await fetch(
    "https://api.github.com/repos/Matthieu-Vachet/PokemonGo-Assets-API/git/trees/main?recursive=1",
    { headers: { "user-agent": "PokemonGo-API-checklist" } },
  );
  if (!response.ok) throw new Error(`GitHub assets: HTTP ${response.status}`);
  const tree = await response.json();
  remoteHdCache = (tree.tree || [])
    .filter((item) => item.type === "blob" && item.path.startsWith("PokemonHd/"))
    .map((item) => parseAsset(path.basename(item.path)))
    .filter(Boolean);
  return remoteHdCache;
}

function usedAssetUrls() {
  const urls = [];
  for (const file of [
    ...listFiles(path.join(rootDir, "data", "pokemon")),
    ...listFiles(path.join(rootDir, "data", "pokemon-forms")),
  ]) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/https?:[^"\\]+poke_capture_[^"\\]+\.png/g))
      urls.push({ url: match[0], file: path.relative(rootDir, file) });
  }
  return urls;
}

function allGoAssets() {
  const assets = [];
  const add = (data, file, label, url, shiny = false, details = "") => {
    if (!url) return;
    assets.push({
      dexId: data.dexId || path.basename(file).slice(0, 4),
      name: data.names?.French || data.names?.English || data.slug || data.id,
      form: data.form || "normal",
      label,
      shiny,
      details,
      url,
      filename: path.basename(url),
      file: path.relative(rootDir, file),
    });
  };
  for (const file of [
    ...listFiles(path.join(rootDir, "data", "pokemon")),
    ...listFiles(path.join(rootDir, "data", "pokemon-forms")),
  ]) {
    const data = readJson(file, {});
    add(data, file, "Image principale", data.assets?.image);
    add(data, file, "Image principale shiny", data.assets?.shinyImage, true);
    for (const [index, asset] of (data.assetForms || []).entries()) {
      const details = [
        asset.form && `forme ${asset.form}`,
        asset.costume && `costume ${asset.costume}`,
        asset.isFemale && "femelle",
      ]
        .filter(Boolean)
        .join(" · ");
      add(data, file, `Variante ${index + 1}`, asset.image, false, details);
      add(
        data,
        file,
        `Variante ${index + 1} shiny`,
        asset.shinyImage,
        true,
        details,
      );
    }
  }
  return assets.sort(
    (left, right) =>
      left.dexId.localeCompare(right.dexId) ||
      left.form.localeCompare(right.form) ||
      Number(left.shiny) - Number(right.shiny),
  );
}

async function assetAudit(dexId = "") {
  const assets = await allHdAssets();
  const goAssets = allGoAssets();
  const used = usedAssetUrls();
  const counts = new Map();
  for (const item of used)
    counts.set(item.url, (counts.get(item.url) || 0) + 1);
  const filterDex = String(dexId).padStart(4, "0");
  return {
    totals: {
      files: assets.length,
      used: new Set(used.map((item) => item.url)).size,
      unused: assets.filter((asset) => !counts.has(asset.url)).length,
      duplicated: [...counts.values()].filter((count) => count > 1).length,
      goFiles: goAssets.length,
    },
    proposals: assets
      .filter((asset) => !dexId || asset.dexId === filterDex)
      .sort(
        (left, right) =>
          left.dexId.localeCompare(right.dexId) ||
          left.formIndex.localeCompare(right.formIndex) ||
          left.filename.localeCompare(right.filename),
      ),
    goAssets: goAssets.filter((asset) => !dexId || asset.dexId === filterDex),
    unused: assets.filter((asset) => !counts.has(asset.url)).slice(0, 300),
    duplicated: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([url, count]) => ({ url, count })),
  };
}

async function auditUrls(key) {
  const detail = detailForKey(key);
  if (!detail) throw new Error("Fiche introuvable.");
  const urls = [
    ...new Set(
      [...JSON.stringify(detail.sourceData || detail).matchAll(/https?:[^"\\]+\.(?:png|webp|jpe?g)/g)].map(
        (match) => match[0],
      ),
    ),
  ].slice(0, 100);
  return Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          method: "HEAD",
          signal: AbortSignal.timeout(6000),
        });
        return { url, ok: response.ok, status: response.status };
      } catch (error) {
        return { url, ok: false, status: 0, error: error.message };
      }
    }),
  );
}

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listFiles(file)
      : entry.isFile() && entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

function catalog() {
  return {
    types: readJson(typesFile, []),
    moves: listFiles(movesDir)
      .map((file) => readJson(file))
      .filter(Boolean)
      .sort((a, b) =>
        String(a.names?.French || a.id).localeCompare(
          String(b.names?.French || b.id),
          "fr",
        ),
      ),
  };
}

function notes() {
  return readJson(notesFile, []);
}

function saveNote(note) {
  const list = notes();
  list.unshift({
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    text: String(note.text || "").trim(),
    key: note.key || null,
    name: note.name || null,
  });
  writeJson(notesFile, list.slice(0, 500));
  return list[0];
}

function imageReviews() {
  return readJson(reviewsFile, []);
}

function saveImageReview(review) {
  const list = imageReviews();
  list.unshift({
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    status: review.status === "valid" ? "valid" : "issue",
    key: review.key,
    name: review.name,
    details: String(review.details || ""),
  });
  writeJson(reviewsFile, list.slice(0, 2000));
  return list[0];
}

function gitHistory(relativeFile) {
  if (!relativeFile) return [];
  return childProcess
    .execFileSync(
      "git",
      ["log", "-8", "--date=short", "--pretty=format:%h|%ad|%s", "--", relativeFile],
      { cwd: rootDir, encoding: "utf8" },
    )
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, date, ...subject] = line.split("|");
      return { hash, date, subject: subject.join("|") };
    });
}

function openFile(relativeFile) {
  const file = path.resolve(rootDir, relativeFile);
  if (!file.startsWith(path.join(rootDir, "data")) || !fs.existsSync(file))
    throw new Error("Fichier non autorisé.");
  if (process.platform === "darwin")
    childProcess.spawn("open", ["-R", file], { detached: true, stdio: "ignore" }).unref();
  return { file: relativeFile, opened: process.platform === "darwin" };
}

module.exports = {
  assetAudit,
  auditUrls,
  catalog,
  gitHistory,
  imageReviews,
  notes,
  openFile,
  saveImageReview,
  saveNote,
  validate,
};
