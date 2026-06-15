const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const write = process.argv.includes("--write");
const directories = [
  "data/pokemon",
  "data/pokemon-forms",
  "data/moves",
  "data/generations",
  "data/types",
  "data/stickers",
];
const keys = [
  "id", "formId", "form", "slug", "dexNr", "dexId", "generation",
  "baseFormId", "inherits", "region", "names", "size", "height", "weight",
  "weatherBoost", "buddyDistance", "catchRate", "fleeRate", "megaEnergyReward",
  "energyCost", "captureRewards", "secondChargeMoveCost", "candy", "stardust",
  "maxCp", "maxLevel50", "maxLevel40", "weatherBoostLevel25", "raidLevel20",
  "researchLevel15", "maxBattlesLevel20", "availability", "released",
  "shinyReleased", "tradable", "pokemonHomeTransfer", "shadow", "dynamax",
  "gigantamax", "apex", "pvp", "littleCup", "greatLeague", "ultraLeague",
  "masterLeague", "stats", "stamina", "attack", "defense", "primaryType",
  "secondaryType", "pokemonClass", "quickMoves", "cinematicMoves",
  "eliteQuickMoves", "eliteCinematicMoves", "maxBattle", "moves", "assets",
  "image", "shinyImage", "portrait", "portraitShiny", "home", "locationCards",
  "shuffle", "source", "variants", "filename", "state", "codes", "tags",
  "shiny", "assetForms",
  "regionForms", "evolutions", "hasMegaEvolution", "megaEvolutions",
  "dynamaxForms", "hasGigantamaxEvolution", "gigantamaxForms", "power",
  "energy", "durationMs", "type", "combat",
  "legacySlugs", "doubleDamageFrom", "halfDamageFrom", "noDamageFrom",
];
const rank = new Map(keys.map((key, index) => [key, index]));

function files(directory) {
  const absolute = path.join(rootDir, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(relative)
      : entry.name.endsWith(".json")
        ? [path.join(rootDir, relative)]
        : [];
  });
}

function order(value) {
  if (Array.isArray(value)) return value.map(order);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child], index) => ({ key, child, index }))
      .sort(
        (left, right) =>
          (rank.get(left.key) ?? Number.MAX_SAFE_INTEGER) -
            (rank.get(right.key) ?? Number.MAX_SAFE_INTEGER) ||
          left.index - right.index,
      )
      .map(({ key, child }) => [key, order(child)]),
  );
}

const changed = [];
for (const file of directories.flatMap(files).sort()) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = JSON.parse(sourceText);
  const next = order(source);
  assert.deepStrictEqual(next, source, `Une valeur a changé dans ${file}`);
  const output = `${JSON.stringify(next, null, 2)}\n`;
  if (output === sourceText) continue;
  changed.push(path.relative(rootDir, file));
  if (write) fs.writeFileSync(file, output);
}

console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      changedFiles: changed.length,
      valuesUnchanged: true,
      changed,
    },
    null,
    2,
  ),
);
