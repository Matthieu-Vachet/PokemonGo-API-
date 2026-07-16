const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer-core");
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
  // Chromium 149 is ESM-only on the Node.js 22 runtime used by Vercel.
  const { default: chromium } = await import("@sparticuz/chromium");
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
      if (["font", "media"].includes(request.resourceType())) request.abort();
      else request.continue();
    });
    await page.goto(SOURCE_URL, { waitUntil: "networkidle2", timeout: 45_000 });
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

      const nextState = await page.evaluate(() => {
        const image = document.querySelector('img[alt="Next page"]');
        const button = image?.closest("button");
        return {
          present: Boolean(button),
          disabled: !button || button.disabled || button.getAttribute("aria-disabled") === "true",
          marker: document.querySelector("table tbody tr")?.textContent || "",
        };
      });
      if (!nextState.present || nextState.disabled) break;
      await page.evaluate(() => document.querySelector('img[alt="Next page"]')?.closest("button")?.click());
      await page.waitForFunction(
        (marker) => (document.querySelector("table tbody tr")?.textContent || "") !== marker,
        { timeout: 10_000 },
        nextState.marker,
      );
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
  try {
    return JSON.parse(await fsp.readFile(STATE_FILE, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function writeState(state) {
  await fsp.mkdir(CACHE_DIR, { recursive: true });
  const temporary = `${STATE_FILE}.${process.pid}.tmp`;
  await fsp.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fsp.rename(temporary, STATE_FILE);
}

async function clearDynamaxImageCache() {
  await fsp.rm(CACHE_DIR, { recursive: true, force: true });
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

  const usedFilenames = new Map();
  const images = [];
  let cursor = 0;
  async function worker() {
    while (cursor < uniqueCards.length) {
      const card = uniqueCards[cursor];
      cursor += 1;
      try {
        const downloaded = await downloader(card.sourceImageUrl);
        const filename = filenameFor(card, downloaded.contentType, usedFilenames);
        await fsp.writeFile(path.join(IMAGE_DIR, filename), downloaded.buffer);
        images.push({ ...card, filename, downloadStatus: "success", error: null });
      } catch (error) {
        const filename = filenameFor(card, "", usedFilenames);
        images.push({ ...card, filename, downloadStatus: "failed", error: error instanceof Error ? error.message : String(error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, uniqueCards.length || 1) }, worker));
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
  await writeState(state);
  return state;
}

async function dynamaxImagePath(filename) {
  const state = await readState();
  const safeName = path.basename(String(filename || ""));
  const item = state?.images?.find((image) => image.filename === safeName && image.downloadStatus === "success");
  if (!item || !safeName || safeName !== filename) throw new ApiError(404, "Image Dynamax introuvable.", "DYNAMAX_IMAGE_NOT_FOUND");
  return { item, filePath: path.join(IMAGE_DIR, safeName) };
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
  for (const image of successful) archive.file(path.join(IMAGE_DIR, image.filename), { name: `dynamax-images/images/${image.filename}` });
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
};
