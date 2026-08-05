const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("la fonction REST longue et la checklist déclarent leur durée Vercel", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf8"));

  assert.equal(config.functions["api/rest.js"].maxDuration, 60);
  assert.equal(config.functions["api/checklist-v3.js"].maxDuration, 60);
  for (const functionConfig of Object.values(config.functions)) {
    if (!functionConfig.includeFiles) continue;
    assert.doesNotMatch(functionConfig.includeFiles, /PokemonGo-Data\/\*\*/);
    assert.doesNotMatch(functionConfig.includeFiles, /pvp-rankings|archives|best-attackers/);
    assert.match(functionConfig.includeFiles, /pokemon-assets/);
    assert.match(functionConfig.includeFiles, /mappings/);
    assert.match(functionConfig.includeFiles, /scripts/);
    assert.ok(functionConfig.includeFiles.length <= 256);
  }
});
