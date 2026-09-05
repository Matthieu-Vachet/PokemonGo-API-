const fs = require("node:fs");
const path = require("node:path");
const { generatorRegistry } = require("../src/lib/generator-registry");
const { dataRoot } = require("../src/lib/data-repository");

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
// Check the REST function itself, not the union of unrelated page bundles.
const restManifest = path.join(serverRoot, "pages/api/rest.js.nft.json");
const restFiles = new Set(JSON.parse(fs.readFileSync(restManifest, "utf8")).files.map((file) => fs.realpathSync(path.resolve(path.dirname(restManifest), file))));
const effectsDirectory = path.join(dataRoot, "data/adventure-effects/effects");
const effectFiles = fs.readdirSync(effectsDirectory).filter((file) => file.endsWith(".adventure-effect.json"));
const adventureResources = [
  "data/adventure-effects/manifests/index.json",
  "data/adventure-effects/sources/index.json",
  "schemas/adventure-effects/adventure-effect.schema.json",
  ...effectFiles.map((file) => `data/adventure-effects/effects/${file}`),
];
for (const resource of adventureResources) {
  if (!restFiles.has(fs.realpathSync(path.join(dataRoot, resource)))) {
    throw new Error(`Ressource Adventure Effects absente de la fonction REST: ${resource}`);
  }
}
console.log(JSON.stringify({
  success: true,
  bundledGenerators: Object.keys(generatorRegistry).length,
  serverJavaScriptFiles: JavaScriptFiles.length,
  manifests: manifests.length,
  adventureEffects: effectFiles.length,
  adventureResources: adventureResources.length,
}, null, 2));
