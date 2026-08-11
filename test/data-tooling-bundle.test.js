const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { dataRoot } = require("../src/lib/data-repository");
const tooling = require("../src/lib/data-tooling");

test("les modules runtime PokemonGo-Data sont des dépendances statiques du bundle Next.js", () => {
  assert.equal(typeof tooling.currentEventUtils.loadPokemonEntries, "function");
  assert.equal(typeof tooling.entityPaths.resolveEntityPath, "function");
  assert.equal(typeof tooling.gameMasterExplorer.buildGameMasterExplorerIndex, "function");
  assert.equal(typeof tooling.gameMasterGenerator.generateGameMasterExplorerIndex, "function");
  assert.equal(typeof tooling.gameMasterMappings.buildGameMasterPokemonMappings, "function");
  assert.equal(typeof tooling.pokemonAssetResolver.resolvePokemonAssetByCanonicalIdentity, "function");
  assert.equal(typeof tooling.pokemonLocalIdentityInventory.loadPokemonLocalIdentityInventory, "function");
  assert.equal(typeof tooling.separatedAssetRecords.writeManifest, "function");
  assert.ok(fs.existsSync(path.join(dataRoot, "tooling", "lib", "current-event-utils.js")));
});

test("le wrapper serverless force la racine Data canonique pour le générateur Game Master", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pokemon-go-api-game-master-"));
  const source = path.join(directory, "game-master.json");
  fs.writeFileSync(source, JSON.stringify([{
    templateId: "V0001_POKEMON_BULBASAUR",
    data: { pokemonSettings: { pokemonId: "BULBASAUR", form: "BULBASAUR_NORMAL" } },
  }]));
  try {
    const generated = await tooling.gameMasterGenerator.generateGameMasterExplorerIndex({ source });
    assert.equal(generated.report.totalTemplates, 1);
    assert.ok(generated.report.localComparisons >= 1_611);
    assert.ok(generated.report.localStatusCounts.matched >= 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("aucun consommateur API ne charge un module tooling par chemin absolu dynamique", () => {
  const files = [
    "src/lib/canonical-asset-writer.js",
    "src/services/game-master-explorer-service.js",
    "src/services/pokemon-canonical-asset-service.js",
    "src/services/pokemon-local-identity-inventory-service.js",
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /require\(dataPath\([^)]*tooling/);
  }
});
