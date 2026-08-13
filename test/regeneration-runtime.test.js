const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { dataRoot, resolvePokemonGoDataFile } = require("../src/lib/data-repository");
const { generatorRegistry, validateGeneratorRegistry } = require("../src/lib/generator-registry");
const { getCurrentDatasetAdapter } = require("../src/current-datasets/adapters");

test("le registre statique couvre tous les adaptateurs de regeneration", () => {
  const validation = validateGeneratorRegistry();
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  assert.equal(validation.count, 11);
  for (const key of validation.keys) {
    const adapter = getCurrentDatasetAdapter(key);
    assert.equal(adapter.generatorKey, key);
    assert.equal(adapter.jsonPath, generatorRegistry[key].outputPath);
    assert.equal(adapter.provider, generatorRegistry[key].provider);
  }
});

test("le resolver rejette toute sortie de la racine canonique", () => {
  assert.throws(
    () => resolvePokemonGoDataFile("../../package.json"),
    (error) => error.code === "POKEMON_DATA_PATH_OUTSIDE_ROOT",
  );
});

test("un generateur statique utilise rootDir dans un cwd serverless deplace", async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "pokemon-go-serverless-"));
  const source = path.join(temporary, "game-master.json");
  fs.writeFileSync(source, JSON.stringify([{
    templateId: "V0001_POKEMON_BULBASAUR",
    data: { pokemonSettings: { pokemonId: "BULBASAUR", form: "BULBASAUR_NORMAL" } },
  }]));
  const previous = process.cwd();
  try {
    process.chdir(temporary);
    const generated = await generatorRegistry["pokemon-identity-mappings"].generator({ source, rootDir: dataRoot });
    assert.ok(generated.data.metadata.total > 1_000);
    assert.equal(generated.report.source, "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json");
  } finally {
    process.chdir(previous);
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("aucun chargement dynamique des generateurs ne subsiste dans le pipeline", () => {
  const pipeline = fs.readFileSync(path.resolve(__dirname, "../src/lib/current-data-pipeline.js"), "utf8");
  assert.doesNotMatch(pipeline, /require\s*\(\s*(?:dataPath|generatorFile|modulePath)/);
  assert.doesNotMatch(pipeline, /delete require\.cache/);
  assert.match(pipeline, /getGeneratorRegistration/);
});

test("les operations administratives longues restent reprises sous la limite Vercel", () => {
  const gameMasterService = fs.readFileSync(path.resolve(__dirname, "../src/services/game-master-explorer-service.js"), "utf8");
  const gameMasterRoute = fs.readFileSync(path.resolve(__dirname, "../src/routes/game-master.js"), "utf8");
  const dynamaxService = fs.readFileSync(path.resolve(__dirname, "../src/services/dynamax-images-service.js"), "utf8");
  const dynamaxRoute = fs.readFileSync(path.resolve(__dirname, "../src/routes/dynamax-images.js"), "utf8");
  assert.match(gameMasterService, /REINDEX_BATCH_SIZE = 2_000/);
  assert.match(gameMasterService, /status: "running"/);
  assert.match(gameMasterRoute, /request\.body\?\.continuation/);
  assert.match(dynamaxService, /SCAN_BATCH_SIZE = 16/);
  assert.match(dynamaxService, /page\.select\("select", "200"\)/);
  assert.match(dynamaxService, /kind: "scan-job"/);
  assert.match(dynamaxRoute, /scanDynamaxImagesStep/);
});
