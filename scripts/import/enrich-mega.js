const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const reportFile = path.join(rootDir, "data", "mega-enrichment-report.json");
const write = process.argv.includes("--write");
const megaKinds = new Set(["mega", "mega-x", "mega-y", "primal"]);
const sources = {
  mega: "https://pogoapi.net/api/v1/mega_pokemon.json",
  shiny: "https://pogoapi.net/api/v1/shiny_pokemon.json",
  multipliers: "https://pogoapi.net/api/v1/cp_multiplier.json",
  pokemon: "https://pokeapi.co/api/v2/pokemon",
};

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(file)
      : entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function cp(stats, multiplier) {
  return Math.max(
    10,
    Math.floor(
      ((stats.attack + 15) *
        Math.sqrt(stats.defense + 15) *
        Math.sqrt(stats.stamina + 15) *
        multiplier *
        multiplier) /
        10,
    ),
  );
}

function maxCp(stats, multipliers) {
  return {
    maxLevel50: cp(stats, multipliers.get(50)),
    maxLevel40: cp(stats, multipliers.get(40)),
    weatherBoostLevel25: cp(stats, multipliers.get(25)),
    raidLevel20: cp(stats, multipliers.get(20)),
    researchLevel15: cp(stats, multipliers.get(15)),
  };
}

function releasedKey(form) {
  if (form.form === "mega-x") return `${form.dexNr}:X`;
  if (form.form === "mega-y") return `${form.dexNr}:Y`;
  return `${form.dexNr}:Normal`;
}

function ordered(form, enrichment) {
  const result = {};
  const keys = new Set(["size", "catchRate", "fleeRate", "maxCp", "availability"]);
  for (const [key, value] of Object.entries(form)) {
    if (keys.has(key)) continue;
    if (key === "energyCost") Object.assign(result, enrichment);
    result[key] = value;
  }
  if (!("energyCost" in form)) Object.assign(result, enrichment);
  return result;
}

async function main() {
  const [releasedMega, shiny, multiplierData] = await Promise.all([
    fetchJson(sources.mega),
    fetchJson(sources.shiny),
    fetchJson(sources.multipliers),
  ]);
  const released = new Set(
    releasedMega.map((mega) => `${mega.pokemon_id}:${mega.form}`),
  );
  const shinyDex = new Set(Object.keys(shiny));
  const multipliers = new Map(multiplierData.map((entry) => [entry.level, entry.multiplier]));
  // pogoapi.net s'arrête parfois au niveau 45; Pokémon GO utilise ce multiplicateur au niveau 50.
  if (!multipliers.has(50)) multipliers.set(50, 0.84029999);
  const baseById = new Map(
    files(pokemonDir).map((file) => {
      const pokemon = read(file);
      return [pokemon.id, pokemon];
    }),
  );
  const report = {
    generatedAt: new Date().toISOString(),
    mode: write ? "write" : "dry-run",
    processed: 0,
    changed: [],
    released: [],
    unreleased: [],
    missingSize: [],
  };

  for (const file of files(formsDir).sort()) {
    const form = read(file);
    if (!megaKinds.has(form.form)) continue;
    report.processed += 1;
    const response = await fetch(`${sources.pokemon}/${form.slug}`, {
      headers: { "user-agent": "PokemonGo-API mega enrichment" },
    });
    if (!response.ok) {
      report.missingSize.push(form.formId);
      continue;
    }
    const species = await response.json();
    const isReleased = released.has(releasedKey(form));
    const base = baseById.get(form.baseFormId) || {};
    const enrichment = {
      size: {
        height: species.height / 10,
        weight: species.weight / 10,
      },
      catchRate: 5,
      fleeRate: 5,
      maxCp: maxCp(form.stats, multipliers),
      availability: {
        released: isReleased,
        shinyReleased: isReleased && shinyDex.has(String(form.dexNr)),
        tradable: base.availability?.tradable ?? false,
        pokemonHomeTransfer: base.availability?.pokemonHomeTransfer ?? false,
      },
    };
    const next = ordered(form, enrichment);
    if (JSON.stringify(next) !== JSON.stringify(form)) {
      report.changed.push(path.relative(rootDir, file));
      if (write) writeJson(file, next);
    }
    (isReleased ? report.released : report.unreleased).push(form.formId);
  }

  if (write) writeJson(reportFile, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
