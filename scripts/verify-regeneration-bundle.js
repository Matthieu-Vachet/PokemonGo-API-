const fs = require("node:fs");
const path = require("node:path");
const { generatorRegistry } = require("../src/lib/generator-registry");

const serverRoot = path.resolve(__dirname, "../.next/server");
if (!fs.existsSync(serverRoot)) throw new Error("Bundle Next.js absent: .next/server.");

const JavaScriptFiles = [];
const manifests = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (entry.name.endsWith(".js")) JavaScriptFiles.push(target);
    else if (entry.name.endsWith(".nft.json")) manifests.push(target);
  }
}
collect(serverRoot);

const bundledSource = JavaScriptFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
const missingExports = Object.values(generatorRegistry)
  .filter((registration) => !bundledSource.includes(registration.exportName))
  .map((registration) => registration.key);
if (missingExports.length) {
  throw new Error(`Generateurs absents du code server bundle: ${missingExports.join(", ")}`);
}

const traced = manifests.flatMap((manifest) => {
  try {
    return JSON.parse(fs.readFileSync(manifest, "utf8")).files || [];
  } catch {
    return [];
  }
}).join("\n");
for (const marker of ["PokemonGo-Data/package.json", "PokemonGo-Data/version.json", "PokemonGo-Data/data/pokemon", "PokemonGo-Data/data/reference"]) {
  if (!traced.includes(marker)) throw new Error(`Ressource runtime non tracee: ${marker}`);
}
for (const marker of [
  "node_modules/@sparticuz/chromium/bin/chromium.br",
  "node_modules/@sparticuz/chromium/bin/al2023.tar.br",
  "node_modules/@sparticuz/chromium/build/index.js",
]) {
  if (!traced.includes(marker)) throw new Error(`Ressource navigateur serverless non tracee: ${marker}`);
}

console.log(JSON.stringify({
  success: true,
  bundledGenerators: Object.keys(generatorRegistry).length,
  serverJavaScriptFiles: JavaScriptFiles.length,
  manifests: manifests.length,
  chromiumRuntime: true,
}, null, 2));
