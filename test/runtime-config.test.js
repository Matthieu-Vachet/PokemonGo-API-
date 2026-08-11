const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("les fonctions API Next.js déclarent leur durée Vercel sans includeFiles ignoré", () => {
  const config = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf8"));
  const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf8"));

  assert.equal(config.functions["pages/api/rest.js"].maxDuration, 60);
  assert.equal(config.functions["pages/api/checklist-v3.js"].maxDuration, 60);
  for (const functionConfig of Object.values(config.functions)) {
    assert.equal(functionConfig.includeFiles, undefined);
  }
  assert.ok(fs.existsSync(path.resolve(__dirname, "../pages/api/rest.js")));
  assert.ok(fs.existsSync(path.resolve(__dirname, "../pages/api/checklist-v3.js")));
  for (const page of ["rest.js", "checklist-v3.js"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "../pages/api", page), "utf8");
    assert.match(source, /module\.exports\.default\s*=\s*handler/);
  }
  assert.equal(fs.existsSync(path.resolve(__dirname, "../api/rest.js")), false);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../api/checklist-v3.js")), false);
  assert.equal(packageJson.scripts.test, "node --test test/*.test.js");
});
