const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { ApiError } = require("../lib/api-error");

const SOURCE_URL = "https://db.pokemongohub.net/pokemon-list/category/dynamax";
const SOURCE_HOSTS = new Set(["db.pokemongohub.net"]);
const CACHE_DIR = process.env.DYNAMAX_IMAGES_CACHE_DIR
  || path.join(os.tmpdir(), "pokemon-go-api", "dynamax-images");
const IMAGE_DIR = path.join(CACHE_DIR, "images");
const STATE_FILE = path.join(CACHE_DIR, "state.json");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 3;
const CACHE_DATASET_KEY = "dynamax-images";
const CACHE_COLLECTION = "admin_asset_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SCAN_JOB_TTL_MS = 30 * 60 * 1000;
const SCAN_BATCH_SIZE = 16;
const DASHBOARD_DB = process.env.DASHBOARD_MONGODB_DB || "matweb-dashboard-admin";

let cacheIndexPromise;

function persistentCacheCollection() {
  return mongoose.connection.client?.db(DASHBOARD_DB).collection(CACHE_COLLECTION) || null;
}

async function preparePersistentCache(collection) {
  if (!collection) return;
  if (!cacheIndexPromise) {
    cacheIndexPromise = collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "expiresAt_ttl" },
    ).catch((error) => {
      cacheIndexPromise = null;
      throw error;
    });
  }
  await cacheIndexPromise;
}

function bufferFromMongo(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value?.value === "function") return Buffer.from(value.value(true));
  if (Buffer.isBuffer(value?.buffer)) return Buffer.from(value.buffer);
  return value ? Buffer.from(value) : null;
}

function scanJobId(scanId) {
  return `${CACHE_DATASET_KEY}:scan:${scanId}:job`;
}

function scanImageId(scanId, filename) {
  return `${CACHE_DATASET_KEY}:scan:${scanId}:image:${filename}`;
}

function persistentImageId(state, filename) {
  return state?.scanId
    ? scanImageId(state.scanId, filename)
    : `${CACHE_DATASET_KEY}:image:${filename}`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "pokemon";
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 8);
}

function safeRemoteUrl(value) {
  let url;
  try {
    url = new URL(value, SOURCE_URL);
  } catch {
    throw new ApiError(400, "URL d'image invalide.", "DYNAMAX_IMAGE_URL_INVALID");
  }
  if (url.protocol !== "https:" || !SOURCE_HOSTS.has(url.hostname.toLowerCase())) {
    throw new ApiError(400, "Source d'image non autorisée.", "DYNAMAX_IMAGE_SOURCE_FORBIDDEN");
  }
  url.hash = "";
  return url;
}

function extensionFor(url, contentType = "") {
  const byType = {
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  }[contentType.split(";")[0].trim().toLowerCase()];
  if (byType) return byType;
  const candidate = path.extname(new URL(url).pathname).toLowerCase();
  return [".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(candidate)
    ? (candidate === ".jpeg" ? ".jpg" : candidate)
    : ".img";
}

function filenameFor(card, contentType = "", used = new Map()) {
  const dex = Number.isInteger(card.dexNr) && card.dexNr > 0
    ? `${String(card.dexNr).padStart(4, "0")}-`
    : "";
  const base = `${dex}${slugify(card.name)}-dynamax`;
  const extension = extensionFor(card.sourceImageUrl, contentType);
  const previousUrl = used.get(`${base}${extension}`);
  const filename = previousUrl && previousUrl !== card.sourceImageUrl
    ? `${base}-${shortHash(card.sourceImageUrl)}${extension}`
    : `${base}${extension}`;
  used.set(filename, card.sourceImageUrl);
  return filename;
}

function normalizeCard(raw) {
  const sourceLabel = cleanText(raw.name || raw.sourceName);
  const name = sourceLabel.replace(/^(?:Dynamax|Gigantamax)\s+/i, "").trim() || sourceLabel;
  const dexValue = Number.parseInt(String(raw.dexNr || "").replace(/\D/g, ""), 10);
  return {
    name,
    dexNr: Number.isFinite(dexValue) ? dexValue : null,
    sourceImageUrl: safeRemoteUrl(raw.sourceImageUrl || raw.imageUrl).toString(),
  };
}

async function collectDynamaxCards() {
  // Both browser packages are ESM-only on the Node.js 22 runtime used by Vercel.
  const [{ default: chromium }, puppeteer] = await Promise.all([
    import("@sparticuz/chromium"),
    import("puppeteer-core"),
  ]);
  const localCandidates = process.platform === "darwin" ? [
    process.env.CHROMIUM_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ].filter(Boolean) : [];
  const localExecutable = localCandidates.find((candidate) => fs.existsSync(candidate));
  const browser = await puppeteer.launch({
    args: localExecutable ? ["--no-sandbox", "--disable-setuid-sandbox"] : chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: localExecutable || await chromium.executablePath(),
    headless: "shell",
  });
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/149 Safari/537.36");
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      // Only the image URLs in the rendered cards are needed here. Avoid
      // downloading the same files in Chromium before the validated server
      // downloader fetches them.
      if (["font", "image", "media"].includes(request.resourceType())) request.abort();
      else request.continue();
    });
    await page.goto(SOURCE_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForSelector("table tbody tr", { timeout: 30_000 });

    const cards = [];
    for (let pageIndex = 0; pageIndex < 30; pageIndex += 1) {
      const batch = await page.$$eval("table tbody tr", (rows) => rows.map((row) => {
        const cells = [...row.querySelectorAll("td")];
        const image = row.querySelector("img[src*='/images/official/']") || row.querySelector("img");
        return {
          dexNr: cells[0]?.textContent || "",
          name: cells[1]?.textContent || image?.getAttribute("alt") || "",
          sourceImageUrl: image?.getAttribute("src") || "",
        };
      }).filter((card) => card.name && card.sourceImageUrl));
      cards.push(...batch);

      const nextImages = await page.$$('img[alt="Next page"]');
      let nextImage = null;
      for (const image of nextImages) {
        const enabled = await image.evaluate((candidate) => {
          const button = candidate.closest("button");
          return Boolean(button && !button.disabled && button.getAttribute("aria-disabled") !== "true");
        });
        if (enabled && await image.boundingBox()) {
          nextImage = image;
          break;
        }
      }
      if (!nextImage) {
        await Promise.all(nextImages.map((image) => image.dispose()));
        break;
      }
      const marker = await page.$eval("table tbody tr", (row) => row.textContent || "");
      try {
        await nextImage.click();
        await page.waitForFunction(
          (previousMarker) => (document.querySelector("table tbody tr")?.textContent || "") !== previousMarker,
          { timeout: 10_000 },
          marker,
        );
      } finally {
        await Promise.all(nextImages.map((image) => image.dispose()));
      }
    }
    return cards;
  } finally {
    await browser.close();
  }
}

async function fetchImage(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || DOWNLOAD_TIMEOUT_MS;
  let currentUrl = safeRemoteUrl(url);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif" },
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error(`Timeout après ${timeoutMs} ms`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("Redirection distante invalide");
      currentUrl = safeRemoteUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error(`Content-Type invalide: ${contentType || "absent"}`);
    const announcedSize = Number(response.headers.get("content-length") || 0);
    if (announcedSize > MAX_IMAGE_BYTES) throw new Error(`Image trop volumineuse (${announcedSize} octets)`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("Image vide");
    if (buffer.length > MAX_IMAGE_BYTES) throw new Error(`Image trop volumineuse (${buffer.length} octets)`);
    return { buffer, contentType, finalUrl: currentUrl.toString() };
  }
  throw new Error("Trop de redirections");
}

async function readState() {
  const collection = persistentCacheCollection();
  if (collection) {
    const document = await collection.findOne({ _id: `${CACHE_DATASET_KEY}:state`, datasetKey: CACHE_DATASET_KEY });
    if (document?.state) return document.state;
  }
  try {
    return JSON.parse(await fsp.readFile(STATE_FILE, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return null;
}

async function writeState(state, cachedFiles = new Map()) {
  const localWrite = (async () => {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    const temporary = `${STATE_FILE}.${process.pid}.tmp`;
    await fsp.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await fsp.rename(temporary, STATE_FILE);
  })();
  const collection = persistentCacheCollection();
  const persistentWrite = collection ? (async () => {
    await preparePersistentCache(collection);
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    const updatedAt = new Date();
    const documents = [{
      _id: `${CACHE_DATASET_KEY}:state`,
      datasetKey: CACHE_DATASET_KEY,
      kind: "state",
      state,
      updatedAt,
      expiresAt,
    }];
    for (const [filename, file] of cachedFiles) {
      documents.push({
        _id: `${CACHE_DATASET_KEY}:image:${filename}`,
        datasetKey: CACHE_DATASET_KEY,
        kind: "image",
        filename,
        contentType: file.contentType,
        data: file.buffer,
        updatedAt,
        expiresAt,
      });
    }
    await collection.deleteMany({ datasetKey: CACHE_DATASET_KEY });
    await collection.insertMany(documents, { ordered: false });
  })() : Promise.resolve();
  await Promise.all([localWrite, persistentWrite]);
}

async function clearDynamaxImageCache() {
  const collection = persistentCacheCollection();
  await Promise.all([
    fsp.rm(CACHE_DIR, { recursive: true, force: true }),
    collection ? collection.deleteMany({ datasetKey: CACHE_DATASET_KEY }) : Promise.resolve(),
  ]);
  return { cleared: true };
}

async function scanDynamaxImages(options = {}) {
  const collector = options.collector || collectDynamaxCards;
  const downloader = options.downloader || fetchImage;
  const detected = (await collector()).map(normalizeCard);
  const uniqueByUrl = new Map();
  for (const card of detected) if (!uniqueByUrl.has(card.sourceImageUrl)) uniqueByUrl.set(card.sourceImageUrl, card);
  const uniqueCards = [...uniqueByUrl.values()];
  const duplicatesIgnored = detected.length - uniqueCards.length;
  await clearDynamaxImageCache();
  await fsp.mkdir(IMAGE_DIR, { recursive: true });

  const downloads = new Array(uniqueCards.length);
  let cursor = 0;
  async function worker() {
    while (cursor < uniqueCards.length) {
      const index = cursor;
      cursor += 1;
      try {
        downloads[index] = { downloaded: await downloader(uniqueCards[index].sourceImageUrl) };
      } catch (error) {
        downloads[index] = { error: error instanceof Error ? error.message : String(error) };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(32, uniqueCards.length || 1) }, worker));
  const usedFilenames = new Map();
  const images = [];
  const cachedFiles = new Map();
  const localWrites = [];
  for (let index = 0; index < uniqueCards.length; index += 1) {
    const card = uniqueCards[index];
    const result = downloads[index];
    if (result.downloaded) {
      const filename = filenameFor(card, result.downloaded.contentType, usedFilenames);
      localWrites.push(fsp.writeFile(path.join(IMAGE_DIR, filename), result.downloaded.buffer));
      cachedFiles.set(filename, { buffer: result.downloaded.buffer, contentType: result.downloaded.contentType });
      images.push({ ...card, filename, downloadStatus: "success", error: null });
    } else {
      const filename = filenameFor(card, "", usedFilenames);
      images.push({ ...card, filename, downloadStatus: "failed", error: result.error });
    }
  }
  await Promise.all(localWrites);
  images.sort((left, right) => (left.dexNr || 99999) - (right.dexNr || 99999) || left.name.localeCompare(right.name));
  const downloadedCount = images.filter((image) => image.downloadStatus === "success").length;
  const state = {
    lastScanAt: new Date().toISOString(),
    source: SOURCE_URL,
    counts: {
      detected: detected.length,
      downloaded: downloadedCount,
      duplicatesIgnored,
      failed: images.length - downloadedCount,
    },
    images,
  };
  await writeState(state, cachedFiles);
  return state;
}

function scanProgress(scanId, offset, total) {
  return {
    success: true,
    status: "running",
    scanId,
    processed: Math.min(offset, total),
    total,
    continuation: { scanId, offset },
  };
}

async function scanDynamaxImagesStep(options = {}) {
  const collection = persistentCacheCollection();
  if (!collection) {
    return { ...(await scanDynamaxImages(options)), success: true, status: "completed" };
  }
  await preparePersistentCache(collection);
  const requestedScanId = String(options.scanId || "").trim();
  if (!requestedScanId) {
    const collector = options.collector || collectDynamaxCards;
    const detected = (await collector()).map(normalizeCard);
    const uniqueByUrl = new Map();
    for (const card of detected) if (!uniqueByUrl.has(card.sourceImageUrl)) uniqueByUrl.set(card.sourceImageUrl, card);
    const usedFilenames = new Map();
    const cards = [...uniqueByUrl.values()].map((card) => ({
      ...card,
      filename: filenameFor(card, "", usedFilenames),
    }));
    const scanId = crypto.randomUUID();
    const now = new Date();
    await collection.replaceOne(
      { _id: scanJobId(scanId) },
      {
        _id: scanJobId(scanId),
        datasetKey: CACHE_DATASET_KEY,
        kind: "scan-job",
        scanId,
        source: SOURCE_URL,
        detectedCount: detected.length,
        duplicatesIgnored: detected.length - cards.length,
        cards,
        results: [],
        nextOffset: 0,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(now.getTime() + SCAN_JOB_TTL_MS),
      },
      { upsert: true },
    );
    return scanProgress(scanId, 0, cards.length);
  }

  const job = await collection.findOne({
    _id: scanJobId(requestedScanId),
    datasetKey: CACHE_DATASET_KEY,
    kind: "scan-job",
  });
  if (!job) throw new ApiError(404, "Étape de scan Dynamax expirée ou introuvable.", "DYNAMAX_SCAN_JOB_NOT_FOUND");
  const requestedOffset = Math.max(0, Number.parseInt(options.offset, 10) || 0);
  const currentOffset = Math.max(0, Number(job.nextOffset || 0));
  if (requestedOffset > currentOffset) {
    throw new ApiError(409, "Curseur de scan Dynamax en avance sur l'état persistant.", "DYNAMAX_SCAN_CURSOR_INVALID");
  }
  if (requestedOffset < currentOffset) {
    return scanProgress(job.scanId, currentOffset, job.cards.length);
  }

  const downloader = options.downloader || fetchImage;
  const batch = job.cards.slice(currentOffset, currentOffset + SCAN_BATCH_SIZE);
  const results = new Array(batch.length);
  await Promise.all(batch.map(async (card, index) => {
    try {
      const downloaded = await downloader(card.sourceImageUrl);
      results[index] = {
        ...card,
        downloadStatus: "success",
        contentType: downloaded.contentType,
        error: null,
        buffer: downloaded.buffer,
      };
    } catch (error) {
      results[index] = {
        ...card,
        downloadStatus: "failed",
        contentType: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));

  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  const successful = results.filter((result) => result.downloadStatus === "success");
  if (successful.length) {
    await collection.bulkWrite(successful.map((result) => ({
      replaceOne: {
        filter: { _id: scanImageId(job.scanId, result.filename) },
        replacement: {
          _id: scanImageId(job.scanId, result.filename),
          datasetKey: CACHE_DATASET_KEY,
          kind: "image",
          scanId: job.scanId,
          filename: result.filename,
          contentType: result.contentType,
          data: result.buffer,
          updatedAt: new Date(),
          expiresAt,
        },
        upsert: true,
      },
    })), { ordered: false });
  }
  const storedResults = results.map(({ buffer: _buffer, ...result }) => result);
  const nextOffset = currentOffset + batch.length;
  await collection.updateOne(
    { _id: job._id, nextOffset: currentOffset },
    {
      $push: { results: { $each: storedResults } },
      $set: { nextOffset, updatedAt: new Date(), expiresAt: new Date(Date.now() + SCAN_JOB_TTL_MS) },
    },
  );
  if (nextOffset < job.cards.length) return scanProgress(job.scanId, nextOffset, job.cards.length);

  const completedJob = await collection.findOne({ _id: job._id });
  const images = [...completedJob.results]
    .sort((left, right) => (left.dexNr || 99999) - (right.dexNr || 99999) || left.name.localeCompare(right.name));
  const downloadedCount = images.filter((image) => image.downloadStatus === "success").length;
  const state = {
    scanId: job.scanId,
    lastScanAt: new Date().toISOString(),
    source: SOURCE_URL,
    counts: {
      detected: job.detectedCount,
      downloaded: downloadedCount,
      duplicatesIgnored: job.duplicatesIgnored,
      failed: images.length - downloadedCount,
    },
    images,
  };
  await collection.replaceOne(
    { _id: `${CACHE_DATASET_KEY}:state` },
    {
      _id: `${CACHE_DATASET_KEY}:state`,
      datasetKey: CACHE_DATASET_KEY,
      kind: "state",
      state,
      updatedAt: new Date(),
      expiresAt,
    },
    { upsert: true },
  );
  await Promise.all([
    collection.deleteMany({ datasetKey: CACHE_DATASET_KEY, kind: "image", scanId: { $ne: job.scanId } }),
    collection.deleteMany({ datasetKey: CACHE_DATASET_KEY, kind: "scan-job" }),
  ]);
  return { ...state, success: true, status: "completed" };
}

async function dynamaxImagePath(filename) {
  const state = await readState();
  const safeName = path.basename(String(filename || ""));
  const item = state?.images?.find((image) => image.filename === safeName && image.downloadStatus === "success");
  if (!item || !safeName || safeName !== filename) throw new ApiError(404, "Image Dynamax introuvable.", "DYNAMAX_IMAGE_NOT_FOUND");
  const filePath = path.join(IMAGE_DIR, safeName);
  if (!state.scanId) {
    try {
      await fsp.access(filePath);
      return { item, filePath };
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const collection = persistentCacheCollection();
  const document = collection ? await collection.findOne({
    _id: persistentImageId(state, safeName),
    datasetKey: CACHE_DATASET_KEY,
    kind: "image",
  }) : null;
  const buffer = bufferFromMongo(document?.data);
  if (!buffer) throw new ApiError(404, "Image Dynamax expirée.", "DYNAMAX_IMAGE_NOT_FOUND");
  return { item, buffer, contentType: document.contentType };
}

async function createDynamaxZip(response) {
  // Archiver 8 is ESM-only on the Node.js 22 runtime used by Vercel.
  const { ZipArchive } = await import("archiver");
  const state = await readState();
  if (!state) throw new ApiError(404, "Aucun scan Dynamax disponible.", "DYNAMAX_SCAN_NOT_FOUND");
  const successful = state.images.filter((image) => image.downloadStatus === "success");
  const manifest = {
    generatedAt: new Date().toISOString(),
    source: SOURCE_URL,
    total: successful.length,
    images: state.images.map(({ name, dexNr, filename, sourceImageUrl, downloadStatus }) => ({
      name, dexNr, filename, sourceImageUrl, downloadStatus,
    })),
  };
  const errors = state.images
    .filter((image) => image.downloadStatus !== "success")
    .map(({ name, dexNr, filename, sourceImageUrl, error }) => ({ name, dexNr, filename, sourceImageUrl, error }));
  response.attachment("dynamax-images.zip");
  response.type("application/zip");
  response.setHeader("Cache-Control", "private, no-store");
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("error", (error) => response.destroy(error));
  archive.pipe(response);
  const collection = persistentCacheCollection();
  const persistentImages = new Map();
  if (collection && successful.length) {
    const documents = await collection.find(state.scanId ? {
      datasetKey: CACHE_DATASET_KEY,
      kind: "image",
      scanId: state.scanId,
      filename: { $in: successful.map((image) => image.filename) },
    } : {
      datasetKey: CACHE_DATASET_KEY,
      kind: "image",
      filename: { $in: successful.map((image) => image.filename) },
    }).toArray();
    for (const document of documents) persistentImages.set(document.filename, bufferFromMongo(document.data));
  }
  for (const image of successful) {
    const buffer = persistentImages.get(image.filename);
    if (buffer) archive.append(buffer, { name: `dynamax-images/images/${image.filename}` });
    else if (!state.scanId) archive.file(path.join(IMAGE_DIR, image.filename), { name: `dynamax-images/images/${image.filename}` });
    else throw new ApiError(503, `Image Dynamax persistante absente: ${image.filename}`, "DYNAMAX_IMAGE_CACHE_INCOMPLETE");
  }
  archive.append(`${JSON.stringify(manifest, null, 2)}\n`, { name: "dynamax-images/manifest.json" });
  archive.append(`${JSON.stringify(errors, null, 2)}\n`, { name: "dynamax-images/errors.json" });
  await archive.finalize();
}

module.exports = {
  SOURCE_URL,
  clearDynamaxImageCache,
  collectDynamaxCards,
  createDynamaxZip,
  dynamaxImagePath,
  extensionFor,
  fetchImage,
  filenameFor,
  normalizeCard,
  readState,
  safeRemoteUrl,
  scanDynamaxImages,
  scanDynamaxImagesStep,
};
