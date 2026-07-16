const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const AdmZip = require("adm-zip");
const request = require("supertest");

process.env.DYNAMAX_IMAGES_CACHE_DIR = path.join(os.tmpdir(), `dynamax-images-test-${process.pid}`);
process.env.API_ADMIN_SECRET = "dynamax-test-secret";

const { createApp } = require("../src/app");
const {
  clearDynamaxImageCache,
  createDynamaxZip,
  fetchImage,
  filenameFor,
  readState,
  safeRemoteUrl,
  scanDynamaxImages,
} = require("../src/services/dynamax-images-service");

test.beforeEach(async () => clearDynamaxImageCache());
test.after(async () => clearDynamaxImageCache());

test("les routes Dynamax restent privées et aucune route publique image n'existe", async () => {
  const app = createApp();
  assert.equal((await request(app).get("/api/v1/admin/dynamax-images")).status, 401);
  assert.equal((await request(app).post("/api/v1/admin/dynamax-images/scan")).status, 401);
  assert.equal((await request(app).delete("/api/v1/admin/dynamax-images/cache")).status, 401);
  assert.equal((await request(app).get("/api/v1/dynamax-images")).status, 404);
});

test("le nom de fichier est stable, nettoyé et suffixé en cas de collision", () => {
  const used = new Map();
  const first = filenameFor({ dexNr: 25, name: "Pikachu", sourceImageUrl: "https://db.pokemongohub.net/images/official/thumb/025_dynamax.webp" }, "image/webp", used);
  const second = filenameFor({ dexNr: 25, name: "Pikachu", sourceImageUrl: "https://db.pokemongohub.net/images/official/thumb/025_gmax.webp" }, "image/webp", used);
  assert.equal(first, "0025-pikachu-dynamax.webp");
  assert.match(second, /^0025-pikachu-dynamax-[a-f0-9]{8}\.webp$/);
});

test("la validation distante refuse HTTP et les domaines tiers", () => {
  assert.throws(() => safeRemoteUrl("http://db.pokemongohub.net/image.webp"), /non autorisée/);
  assert.throws(() => safeRemoteUrl("https://example.com/image.webp"), /non autorisée/);
});

test("le téléchargement vérifie statut, Content-Type, redirections et timeout", async () => {
  const valid = await fetchImage("https://db.pokemongohub.net/image.webp", {
    fetchImpl: async () => new Response(Buffer.from("webp"), { status: 200, headers: { "content-type": "image/webp", "content-length": "4" } }),
  });
  assert.equal(valid.contentType, "image/webp");
  await assert.rejects(() => fetchImage("https://db.pokemongohub.net/nope.webp", { fetchImpl: async () => new Response("no", { status: 404 }) }), /HTTP 404/);
  await assert.rejects(() => fetchImage("https://db.pokemongohub.net/text", { fetchImpl: async () => new Response("hello", { status: 200, headers: { "content-type": "text/plain" } }) }), /Content-Type invalide/);
  await assert.rejects(() => fetchImage("https://db.pokemongohub.net/redirect", { fetchImpl: async () => new Response(null, { status: 302, headers: { location: "https://example.com/steal.webp" } }) }), /non autorisée/);
  await assert.rejects(() => fetchImage("https://db.pokemongohub.net/slow", {
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))),
  }), /Timeout/);
});

test("le scan conserve toutes les cartes fournies, déduplique les URL et enregistre les échecs", async () => {
  const cards = [
    { dexNr: "1", name: "Dynamax Bulbasaur", sourceImageUrl: "/images/official/thumb/001_dynamax.webp" },
    { dexNr: "1", name: "Dynamax Bulbasaur", sourceImageUrl: "/images/official/thumb/001_dynamax.webp" },
    { dexNr: "6", name: "Gigantamax Charizard", sourceImageUrl: "/images/official/thumb/006_gmax.webp" },
    { dexNr: "25", name: "Dynamax Pikachu", sourceImageUrl: "/images/official/thumb/025_dynamax.webp" },
  ];
  const result = await scanDynamaxImages({
    collector: async () => cards,
    downloader: async (url) => {
      if (url.includes("025")) throw new Error("remote-invalid");
      return { buffer: Buffer.from("image"), contentType: "image/webp", finalUrl: url };
    },
  });
  assert.deepEqual(result.counts, { detected: 4, downloaded: 2, duplicatesIgnored: 1, failed: 1 });
  assert.equal(result.images.length, 3);
  assert.equal((await readState()).images[2].downloadStatus, "failed");
});

test("le ZIP contient images, manifest.json et errors.json, puis le cache est supprimable", async () => {
  await scanDynamaxImages({
    collector: async () => [
      { dexNr: 25, name: "Dynamax Pikachu", sourceImageUrl: "/images/official/thumb/025_dynamax.webp" },
      { dexNr: 131, name: "Dynamax Lapras", sourceImageUrl: "/images/official/thumb/131_dynamax.webp" },
    ],
    downloader: async (url) => {
      if (url.includes("131")) throw new Error("invalid-image");
      return { buffer: Buffer.from("image"), contentType: "image/webp", finalUrl: url };
    },
  });
  const response = new PassThrough();
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  response.attachment = () => response;
  response.type = () => response;
  response.setHeader = () => response;
  const finished = new Promise((resolve, reject) => { response.on("finish", resolve); response.on("error", reject); });
  await createDynamaxZip(response);
  await finished;
  const zip = new AdmZip(Buffer.concat(chunks));
  const names = zip.getEntries().map((entry) => entry.entryName);
  assert.ok(names.includes("dynamax-images/images/0025-pikachu-dynamax.webp"));
  assert.ok(names.includes("dynamax-images/manifest.json"));
  assert.ok(names.includes("dynamax-images/errors.json"));
  const manifest = JSON.parse(zip.readAsText("dynamax-images/manifest.json"));
  const errors = JSON.parse(zip.readAsText("dynamax-images/errors.json"));
  assert.equal(manifest.total, 1);
  assert.equal(errors.length, 1);
  assert.deepEqual(Object.keys(manifest.images[0]), ["name", "dexNr", "filename", "sourceImageUrl", "downloadStatus"]);
  await clearDynamaxImageCache();
  await assert.rejects(() => fs.access(process.env.DYNAMAX_IMAGES_CACHE_DIR));
});
