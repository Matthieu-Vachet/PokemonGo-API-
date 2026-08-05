const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

test("les fonctions Next.js embarquent le dataset PokemonGo-Data requis", async () => {
  const { default: nextConfig } = await import("../next.config.mjs");
  const tracedFiles = nextConfig.outputFileTracingIncludes?.["/*"];

  assert.equal(nextConfig.outputFileTracingRoot, path.resolve(__dirname, ".."));
  assert.ok(Array.isArray(tracedFiles));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/pokemon/**/*"));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/pokemon-assets/**/*"));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/types/**/*"));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/research/**/*"));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/mappings/**/*"));
  assert.ok(tracedFiles.includes("./.data/PokemonGo-Data/scripts/**/*"));
});
