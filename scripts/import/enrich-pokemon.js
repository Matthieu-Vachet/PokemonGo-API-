const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const typesFile = path.join(rootDir, "data", "types", "types.json");
const pokemonReportFile = path.join(rootDir, "data", "pokemon-enrichment-report.json");
const formsReportFile = path.join(rootDir, "data", "forms-enrichment-report.json");
const enrichableFormKinds = new Set([
  "normal",
  "alola",
  "galar",
  "hisui",
  "paldea",
  "mega",
  "mega-x",
  "mega-y",
  "primal",
]);
const megaFormKinds = new Set(["mega", "mega-x", "mega-y", "primal"]);
const megaTargetKeys = ["size", "catchRate", "fleeRate", "maxCp", "availability"];

const targetKeys = [
  "size",
  "weatherBoost",
  "buddyDistance",
  "catchRate",
  "fleeRate",
  "megaEnergyReward",
  "captureRewards",
  "secondChargeMoveCost",
  "maxCp",
  "availability",
  "pvp",
  "assetForms",
];

const sources = {
  gameMaster: "https://raw.githubusercontent.com/PokeMiners/game_masters/master/latest/latest.json",
  cpMultipliers: "https://pogoapi.net/api/v1/cp_multiplier.json",
  released: "https://pogoapi.net/api/v1/released_pokemon.json",
  shiny: "https://pogoapi.net/api/v1/shiny_pokemon.json",
  shadow: "https://pogoapi.net/api/v1/shadow_pokemon.json",
  pvp: {
    littleCup: "https://pvpoke.com/data/rankings/all/overall/rankings-500.json",
    greatLeague: "https://pvpoke.com/data/rankings/all/overall/rankings-1500.json",
    ultraLeague: "https://pvpoke.com/data/rankings/all/overall/rankings-2500.json",
    masterLeague: "https://pvpoke.com/data/rankings/all/overall/rankings-10000.json",
  },
};

function parseArgs(argv) {
  const args = {
    write: argv.includes("--write"),
    force: argv.includes("--force"),
    forms: argv.includes("--forms"),
    limit: null,
  };
  const limitIndex = argv.indexOf("--limit");
  if (limitIndex >= 0) args.limit = Number(argv[limitIndex + 1]);
  return args;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "PokemonGo-API enrichment script" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

function normalizeSpeciesId(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cp(stats, multiplier, ivs = { attack: 15, defense: 15, stamina: 15 }) {
  const value =
    ((stats.attack + ivs.attack) *
      Math.sqrt(stats.defense + ivs.defense) *
      Math.sqrt(stats.stamina + ivs.stamina) *
      multiplier *
      multiplier) /
    10;
  return Math.max(10, Math.floor(value));
}

function rankOne(stats, multipliers, cap) {
  let best = null;
  for (let attack = 0; attack <= 15; attack += 1) {
    for (let defense = 0; defense <= 15; defense += 1) {
      for (let stamina = 0; stamina <= 15; stamina += 1) {
        for (const [level, multiplier] of multipliers) {
          const ivs = { attack, defense, stamina };
          const combatPower = cp(stats, multiplier, ivs);
          if (combatPower > cap) break;
          const product =
            (stats.attack + attack) *
            multiplier *
            (stats.defense + defense) *
            multiplier *
            Math.floor((stats.stamina + stamina) * multiplier);
          if (!best || product > best.product) {
            best = { ivs, level, cp: combatPower, product };
          }
        }
      }
    }
  }
  return best && { ivs: best.ivs, level: best.level, cp: best.cp };
}

function tier(score) {
  if (score >= 90) return "S";
  if (score >= 84) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
}

function moveCatalog() {
  const directories = [
    "fast",
    "charged",
    "fast_elite",
    "charged_elite",
  ].map((directory) => path.join(rootDir, "data", "moves", directory));
  const ids = new Set();
  for (const directory of directories) {
    for (const file of fs.readdirSync(directory).filter((entry) => entry.endsWith(".json"))) {
      ids.add(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8")).id);
    }
  }
  return ids;
}

function mapMove(moveId, fast, catalog) {
  if (fast && moveId.startsWith("HIDDEN_POWER_") && catalog.has("HIDDEN_POWER_FAST")) {
    return "HIDDEN_POWER_FAST";
  }
  const candidates = fast ? [`${moveId}_FAST`, moveId] : [moveId];
  const exact = candidates.find((candidate) => catalog.has(candidate));
  if (exact) return exact;
  const normalized = moveId.replace(/_/g, "");
  const equivalent = [...catalog].find(
    (candidate) => candidate.replace(/_FAST$/, "").replace(/_/g, "") === normalized,
  );
  return equivalent || null;
}

function findRanking(pokemon, rankings, allowBaseFallback) {
  const exactCandidates = [
    normalizeSpeciesId(pokemon.slug),
    normalizeSpeciesId(pokemon.formId),
  ];
  const exact = rankings.find((ranking) => exactCandidates.includes(ranking.speciesId));
  if (exact || !allowBaseFallback) return exact || null;
  const baseCandidates = [
    normalizeSpeciesId(pokemon.names?.English),
    normalizeSpeciesId(pokemon.id),
  ];
  return rankings.find((ranking) => baseCandidates.includes(ranking.speciesId)) || null;
}

function pvpBlock(pokemon, rankingsByLeague, multipliers, catalog, warnings, allowBaseFallback) {
  const leagues = {
    littleCup: 500,
    greatLeague: 1500,
    ultraLeague: 2500,
    masterLeague: 10000,
  };
  const pvp = {};
  for (const [league, cap] of Object.entries(leagues)) {
    const ranking = findRanking(pokemon, rankingsByLeague[league], allowBaseFallback);
    if (!ranking?.moveset?.length) {
      pvp[league] = null;
      continue;
    }
    const fast = mapMove(ranking.moveset[0], true, catalog);
    const charged = ranking.moveset.slice(1).map((move) => mapMove(move, false, catalog));
    if (!fast || charged.some((move) => !move)) {
      warnings.push(`${pokemon.dexId}: moveset PvP non reconnu pour ${league}`);
      pvp[league] = null;
      continue;
    }
    const rank1 =
      league === "masterLeague"
        ? {
            ivs: { attack: 15, defense: 15, stamina: 15 },
            level: 50,
            cp: cp(pokemon.stats, multipliers.get(50)),
          }
        : rankOne(pokemon.stats, [...multipliers.entries()], cap);
    pvp[league] = {
      tierRank: tier(ranking.score),
      rank1,
      bestMovesets: { fast, charged },
    };
  }
  return pvp;
}

function gameMasterPokemon(gameMaster, pokemon, allowBaseFallback) {
  const prefix = `V${pokemon.dexId}_POKEMON_`;
  const preferred = `${prefix}${pokemon.formId}`;
  const exact = gameMaster.find((template) => template.templateId === preferred);
  const base = gameMaster.find((template) => template.templateId === `${prefix}${pokemon.id}`);
  return (exact || (allowBaseFallback ? base : null))?.data?.pokemonSettings || null;
}

function sorted(values) {
  return [...(values || [])].sort();
}

function gameplayEquivalent(pokemon, basePokemon) {
  if (!basePokemon) return false;
  return (
    JSON.stringify(pokemon.stats) === JSON.stringify(basePokemon.stats) &&
    pokemon.primaryType === basePokemon.primaryType &&
    pokemon.secondaryType === basePokemon.secondaryType &&
    pokemon.pokemonClass === basePokemon.pokemonClass &&
    JSON.stringify(sorted(pokemon.quickMoves)) === JSON.stringify(sorted(basePokemon.quickMoves)) &&
    JSON.stringify(sorted(pokemon.cinematicMoves)) ===
      JSON.stringify(sorted(basePokemon.cinematicMoves)) &&
    JSON.stringify(sorted(pokemon.eliteQuickMoves)) ===
      JSON.stringify(sorted(basePokemon.eliteQuickMoves)) &&
    JSON.stringify(sorted(pokemon.eliteCinematicMoves)) ===
      JSON.stringify(sorted(basePokemon.eliteCinematicMoves))
  );
}

function weatherBoost(pokemon, typeWeather) {
  return [...new Set([pokemon.primaryType, pokemon.secondaryType].filter(Boolean).map((type) => typeWeather.get(type)))];
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

function hasCompleteEnrichment(pokemon) {
  const keys = megaFormKinds.has(pokemon.form) ? megaTargetKeys : targetKeys;
  return (
    keys.every((key) => key in pokemon) &&
    pokemon.maxCp?.maxLevel50 != null &&
    pokemon.maxCp?.maxLevel40 != null
  );
}

function availability(pokemon, settings, sets, dynamax, gigantamax) {
  const isBaseForm = pokemon.form === "normal" && pokemon.formId === pokemon.id;
  return {
    released: sets.released.has(String(pokemon.dexNr)),
    shinyReleased: sets.shiny.has(String(pokemon.dexNr)),
    tradable: settings.isTradable === true,
    pokemonHomeTransfer: settings.isTransferable !== false,
    shadow:
      pokemon.shadow?.released === true ||
      (isBaseForm && sets.shadow.has(String(pokemon.dexNr))),
    dynamax: dynamax.has(pokemon.formId),
    gigantamax: gigantamax.has(pokemon.formId),
    apex: isBaseForm && ["LUGIA", "HO_OH"].includes(pokemon.id),
  };
}

function orderedPokemon(pokemon, enrichment, enrichmentKeys = targetKeys) {
  const result = {};
  for (const [key, value] of Object.entries(pokemon)) {
    if (enrichmentKeys.includes(key)) continue;
    if (key === "stats") Object.assign(result, enrichment);
    result[key] = value;
  }
  if (!("stats" in pokemon)) Object.assign(result, enrichment);
  return result;
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listJsonFiles(file)
      : entry.name.endsWith(".json")
        ? [file]
        : [];
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [
    gameMaster,
    cpMultiplierData,
    released,
    shiny,
    shadow,
    littleCup,
    greatLeague,
    ultraLeague,
    masterLeague,
  ] = await Promise.all([
    fetchJson(sources.gameMaster),
    fetchJson(sources.cpMultipliers),
    fetchJson(sources.released),
    fetchJson(sources.shiny),
    fetchJson(sources.shadow),
    fetchJson(sources.pvp.littleCup),
    fetchJson(sources.pvp.greatLeague),
    fetchJson(sources.pvp.ultraLeague),
    fetchJson(sources.pvp.masterLeague),
  ]);

  const multipliers = new Map(cpMultiplierData.map((entry) => [entry.level, entry.multiplier]));
  const fullLevelMultipliers =
    gameMaster.find((template) => template.templateId === "PLAYER_LEVEL_SETTINGS")?.data?.playerLevel
      ?.cpMultiplier || [];
  for (let level = 1; level <= 50; level += 1) {
    const current = fullLevelMultipliers[level - 1];
    if (current == null) continue;
    multipliers.set(level, current);
    if (level < 50 && !multipliers.has(level + 0.5)) {
      const next = fullLevelMultipliers[level];
      multipliers.set(level + 0.5, Math.sqrt((current * current + next * next) / 2));
    }
  }
  const typeWeather = new Map(
    JSON.parse(fs.readFileSync(typesFile, "utf8")).map((type) => [type.id, type.weatherBoost.id]),
  );
  const sets = {
    released: new Set(Object.keys(released)),
    shiny: new Set(Object.keys(shiny)),
    shadow: new Set(Object.keys(shadow)),
  };
  const rankings = { littleCup, greatLeague, ultraLeague, masterLeague };
  const catalog = moveCatalog();
  const breadScaling = gameMaster.find((template) => template.templateId === "BREAD_POKEMON_SCALING_SETTINGS");
  const breadShared = gameMaster.find((template) => template.templateId === "BREAD_SHARED_SETTINGS");
  const dynamax = new Set(
    breadScaling?.data?.breadPokemonScalingSettings?.visualSettings?.map((entry) => entry.pokemonId) || [],
  );
  const gigantamax = new Set(
    breadShared?.data?.breadSettings?.allowedSourdoughPokemon?.map((entry) => entry.pokemonId) || [],
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: args.write ? "write" : "dry-run",
    processed: 0,
    enriched: 0,
    skippedExisting: 0,
    inheritedFromBase: [],
    missingGameMaster: [],
    warnings: [],
  };
  let files = args.forms
    ? listJsonFiles(formsDir).filter((file) =>
        enrichableFormKinds.has(JSON.parse(fs.readFileSync(file, "utf8")).form),
      )
    : fs
        .readdirSync(pokemonDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => path.join(pokemonDir, file));
  files.sort();
  if (Number.isFinite(args.limit)) files = files.slice(0, args.limit);
  const basePokemonById = new Map(
    fs
      .readdirSync(pokemonDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => JSON.parse(fs.readFileSync(path.join(pokemonDir, file), "utf8")))
      .map((pokemon) => [pokemon.id, pokemon]),
  );

  for (const file of files) {
    report.processed += 1;
    const filePath = file;
    const pokemon = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!args.force && hasCompleteEnrichment(pokemon)) {
      report.skippedExisting += 1;
      continue;
    }
    const allowBaseFallback =
      pokemon.formId === pokemon.id || gameplayEquivalent(pokemon, basePokemonById.get(pokemon.id));
    const settings = gameMasterPokemon(gameMaster, pokemon, allowBaseFallback);
    if (!settings) {
      report.missingGameMaster.push(`${pokemon.dexId}:${pokemon.formId}`);
      continue;
    }
    if (
      pokemon.formId !== pokemon.id &&
      allowBaseFallback &&
      !gameMasterPokemon(gameMaster, pokemon, false)
    ) {
      report.inheritedFromBase.push(`${pokemon.dexId}:${pokemon.formId}`);
    }
    const encounter = settings.encounter || {};
    const isMegaForm = megaFormKinds.has(pokemon.form);
    const computedAvailability = availability(pokemon, settings, sets, dynamax, gigantamax);
    const enrichment = isMegaForm
      ? {
          size: pokemon.size || {
            height: settings.pokedexHeightM ?? null,
            weight: settings.pokedexWeightKg ?? null,
          },
          catchRate:
            pokemon.catchRate ?? (encounter.baseCaptureRate != null
              ? encounter.baseCaptureRate * 100
              : null),
          fleeRate:
            pokemon.fleeRate ?? (encounter.baseFleeRate != null ? encounter.baseFleeRate * 100 : null),
          maxCp: pokemon.maxCp || maxCp(pokemon.stats, multipliers),
          availability: {
            released: pokemon.availability?.released ?? computedAvailability.released,
            shinyReleased:
              pokemon.availability?.shinyReleased ?? computedAvailability.shinyReleased,
            tradable: pokemon.availability?.tradable ?? computedAvailability.tradable,
            pokemonHomeTransfer:
              pokemon.availability?.pokemonHomeTransfer ??
              computedAvailability.pokemonHomeTransfer,
          },
        }
      : {
          size: {
            height: settings.pokedexHeightM ?? null,
            weight: settings.pokedexWeightKg ?? null,
          },
          weatherBoost: weatherBoost(pokemon, typeWeather),
          buddyDistance: settings.kmBuddyDistance ?? null,
          catchRate: pokemon.pokemonClass ? 2 : 20,
          fleeRate: 0,
          megaEnergyReward: settings.buddyWalkedMegaEnergyAward ?? null,
          captureRewards: {
            candy: 3 + (encounter.bonusCandyCaptureReward || 0),
            stardust: 100 + (encounter.bonusStardustCaptureReward || 0),
          },
          secondChargeMoveCost: {
            candy: settings.thirdMove?.candyToUnlock ?? null,
            stardust: settings.thirdMove?.stardustToUnlock ?? null,
          },
          maxCp: maxCp(pokemon.stats, multipliers),
          availability: computedAvailability,
          pvp: pvpBlock(
            pokemon,
            rankings,
            multipliers,
            catalog,
            report.warnings,
            allowBaseFallback,
          ),
          assetForms: pokemon.assetForms || [],
        };
    if (args.write)
      writeJson(filePath, orderedPokemon(pokemon, enrichment, isMegaForm ? megaTargetKeys : targetKeys));
    report.enriched += 1;
  }

  if (args.write) writeJson(args.forms ? formsReportFile : pokemonReportFile, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
