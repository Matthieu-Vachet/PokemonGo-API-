const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const typesFile = dataPath("types", "types.json");
const assetsDir = path.join(rootDir, "asset", "Types");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Types";
const write = process.argv.includes("--write");

const files = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter((name) => /^ico_\d+_[a-z]+\.png$/.test(name))
  : [];
const bySlug = new Map(
  files.map((name) => [name.match(/^ico_\d+_([a-z]+)\.png$/)[1], name]),
);
const types = JSON.parse(fs.readFileSync(typesFile, "utf8"));
const next = types.map((type) => ({
  ...type,
  assets: {
    ...(type.assets || {}),
    icon: bySlug.has(type.slug) ? `${remoteBase}/${bySlug.get(type.slug)}` : null,
  },
}));
const changed = JSON.stringify(types) !== JSON.stringify(next);

if (write && changed)
  fs.writeFileSync(typesFile, `${JSON.stringify(next, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      sourceImages: files.length,
      matchedTypes: next.filter((type) => type.assets.icon).length,
      changed,
    },
    null,
    2,
  ),
);
