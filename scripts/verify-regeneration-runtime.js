const fs = require("node:fs");
const path = require("node:path");
const { validateGeneratorRegistry, generatorRegistry } = require("../src/lib/generator-registry");
const { getCurrentDatasetAdapter } = require("../src/current-datasets/adapters");

function fail(message, details = null) {
  console.error(`[regeneration-runtime] ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exitCode = 1;
}

const validation = validateGeneratorRegistry();
if (!validation.valid) fail("Registre de generateurs invalide.", validation);

for (const [key, registration] of Object.entries(generatorRegistry)) {
  const adapter = getCurrentDatasetAdapter(key);
  if (adapter.generatorKey !== key) fail(`${key}: generatorKey adaptateur invalide.`);
  if (adapter.jsonPath !== registration.outputPath) fail(`${key}: sortie registre/adaptateur divergente.`);
  if (adapter.provider !== registration.provider) fail(`${key}: provider registre/adaptateur divergent.`);
}

const projectRoot = path.resolve(__dirname, "..");
const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(target);
    else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) sourceFiles.push(target);
  }
}
collect(path.join(projectRoot, "src"));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (/require\s*\(\s*(?:dataPath|modulePath|generatorFile)\b/.test(source)) {
    fail(`Chargement dynamique runtime interdit: ${path.relative(projectRoot, file)}.`);
  }
}

const pipelineSource = fs.readFileSync(path.join(projectRoot, "src/lib/current-data-pipeline.js"), "utf8");
if (/scriptName|exportName|delete require\.cache/.test(pipelineSource)) {
  fail("Le pipeline contient encore un ancien mecanisme de chargement dynamique.");
}

if (!process.exitCode) {
  console.log(JSON.stringify({
    success: true,
    registry: validation.count,
    root: validation.root,
    dynamicRuntimeRequires: 0,
  }, null, 2));
}
