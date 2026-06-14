const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "../..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const dynamaxDir = path.join(rootDir, "data", "pokemon-forms", "dynamax");
const fastMoveDirectories = [
  path.join(rootDir, "data", "moves", "fast"),
  path.join(rootDir, "data", "moves", "fast_elite"),
];
const maxMoveDir = path.join(rootDir, "data", "moves", "max");
const reportFile = path.join(rootDir, "data", "dynamax-pokemon-import-report.json");
const source = "https://www.margxt.fr/pokemon-go-liste-des-pokemon-dynamax/";
const asOf = "2026-06-14";

const releases = [
  ["2024-09-10", [1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ["2025-03-24", [10, 11, 12]],
  ["2026-03-09", [25, 26]],
  ["2026-02-09", [58, 59]],
  ["2025-09-15", [63, 64, 65]],
  ["2024-12-03", [66, 67, 68]],
  ["2024-10-22", [92, 93, 94]],
  ["2024-12-09", [98, 99]],
  ["2025-12-11", [106, 107]],
  ["2025-03-17", [113, 242]],
  ["2026-06-08", [125, 466]],
  ["2025-11-24", [133, 134, 135, 136, 196, 197, 470, 471, 700]],
  ["2025-08-04", [138, 139]],
  ["2025-07-28", [140, 141]],
  ["2025-01-20", [144, 145, 146]],
  ["2025-06-30", [213]],
  ["2025-03-15", [243]],
  ["2025-04-26", [244]],
  ["2025-05-10", [245]],
  ["2026-01-31", [250]],
  ["2025-11-10", [280, 281, 282, 475]],
  ["2025-05-19", [302]],
  ["2025-07-14", [320, 321]],
  ["2026-04-06", [328, 329, 330]],
  ["2025-12-22", [363, 364, 365]],
  ["2024-09-18", [374, 375, 376]],
  ["2026-04-20", [377]],
  ["2026-03-23", [378]],
  ["2026-05-18", [379]],
  ["2025-07-26", [380, 381]],
  ["2026-05-25", [415, 416]],
  ["2025-02-17", [519, 520, 521]],
  ["2026-01-26", [524, 525, 526]],
  ["2025-10-27", [527, 528]],
  ["2024-11-15", [529, 530]],
  ["2026-05-04", [546, 547]],
  ["2025-02-24", [554, 555]],
  ["2025-08-11", [568, 569]],
  ["2024-12-23", [615]],
  ["2025-11-03", [686, 687]],
  ["2025-10-13", [761, 762, 763]],
  ["2025-04-14", [766]],
  ["2026-01-05", [780]],
  ["2024-10-01", [810, 811, 812, 813, 814, 815, 816, 817, 818, 870]],
  ["2024-09-05", [819, 820, 831, 832]],
  ["2025-05-26", [821, 822, 823]],
  ["2024-11-16", [849]],
  ["2025-06-16", [856, 857, 858]],
  ["2025-09-30", [884]],
  ["2025-03-05", [891]],
  ["2025-05-21", [892]],
];

const variants = new Map([
  [849, ["TOXTRICITY_AMPED", "TOXTRICITY_LOW_KEY"]],
  [892, ["URSHIFU_RAPID_STRIKE", "URSHIFU_SINGLE_STRIKE"]],
]);

const futureReleases = [
  { dexNr: 163, releaseDate: "2026-06-22" },
  { dexNr: 164, releaseDate: "2026-06-22" },
];

const excludedMaxBattleParticipants = [
  { dexNr: 888, formId: "ZACIAN_CROWNED_SWORD" },
  { dexNr: 889, formId: "ZAMAZENTA_CROWNED_SHIELD" },
  { dexNr: 890, formId: "ETERNATUS" },
];

const maxMoves = {
  BUG: ["MAX_FLUTTERBY", "max-flutterby"],
  DARK: ["MAX_DARKNESS", "max-darkness"],
  DRAGON: ["MAX_WYRMWIND", "max-wyrmwind"],
  ELECTRIC: ["MAX_LIGHTNING", "max-lightning"],
  FAIRY: ["MAX_STARFALL", "max-starfall"],
  FIGHTING: ["MAX_KNUCKLE", "max-knuckle"],
  FIRE: ["MAX_FLARE", "max-flare"],
  FLYING: ["MAX_AIRSTREAM", "max-airstream"],
  GHOST: ["MAX_PHANTASM", "max-phantasm"],
  GRASS: ["MAX_OVERGROWTH", "max-overgrowth"],
  GROUND: ["MAX_QUAKE", "max-quake"],
  ICE: ["MAX_HAILSTORM", "max-hailstorm"],
  NORMAL: ["MAX_STRIKE", "max-strike"],
  POISON: ["MAX_OOZE", "max-ooze"],
  PSYCHIC: ["MAX_MINDSTORM", "max-mindstorm"],
  ROCK: ["MAX_ROCKFALL", "max-rockfall"],
  STEEL: ["MAX_STEELSPIKE", "max-steelspike"],
  WATER: ["MAX_GEYSER", "max-geyser"],
};

const languages = {
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
};

function read(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function files(directory) {
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name));
}

function formSource(pokemon, formId) {
  return formId ? pokemon.regionForms?.[formId] : pokemon;
}

function targetDynamaxFormId(targetFormId, selectedFormIds) {
  if (selectedFormIds.has(targetFormId)) return `${targetFormId}_DYNAMAX`;
  const targetBase = targetFormId.split("_")[0];
  return selectedFormIds.has(targetBase) ? `${targetBase}_DYNAMAX` : null;
}

function dynamaxEvolutions(sourceForm, selectedFormIds) {
  return (sourceForm.evolutions || []).flatMap((evolution) => {
    const targetFormId = targetDynamaxFormId(evolution.targetFormId, selectedFormIds);
    return targetFormId ? [{ ...evolution, targetFormId }] : [];
  });
}

async function moveNames(slug) {
  const response = await fetch(`https://pokeapi.co/api/v2/move/${slug}`, {
    headers: { "user-agent": "PokemonGo-API Dynamax importer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${slug}`);
  const move = await response.json();
  return Object.fromEntries(
    move.names
      .filter(({ language }) => languages[language.name])
      .map(({ language, name }) => [languages[language.name], name]),
  );
}

async function main() {
  const write = process.argv.includes("--write");
  const releaseDates = new Map(
    releases.flatMap(([releaseDate, dexNumbers]) =>
      dexNumbers.map((dexNr) => [dexNr, releaseDate]),
    ),
  );
  const pokemonByDex = new Map(
    files(pokemonDir).map((file) => {
      const pokemon = read(file);
      return [pokemon.dexNr, { file, pokemon }];
    }),
  );
  const fastMoves = new Map(
    fastMoveDirectories.flatMap((directory) =>
      files(directory).map((file) => {
        const move = read(file);
        return [move.id, move];
      }),
    ),
  );
  const selectedForms = [];
  for (const dexNr of releaseDates.keys()) {
    const entry = pokemonByDex.get(dexNr);
    if (!entry) throw new Error(`Pokémon #${dexNr} introuvable`);
    const formIds = variants.get(dexNr) || [null];
    for (const sourceFormId of formIds) {
      const sourceForm = formSource(entry.pokemon, sourceFormId);
      if (!sourceForm) throw new Error(`${sourceFormId} introuvable dans #${dexNr}`);
      selectedForms.push({ ...entry, sourceForm, sourceFormId });
    }
  }
  const selectedFormIds = new Set(
    selectedForms.map(({ pokemon, sourceFormId }) => sourceFormId || pokemon.formId),
  );
  const requiredTypes = new Set();
  for (const { sourceForm } of selectedForms) {
    for (const moveId of [...(sourceForm.quickMoves || []), ...(sourceForm.eliteQuickMoves || [])]) {
      const move = fastMoves.get(moveId);
      if (!move) throw new Error(`Attaque rapide introuvable: ${moveId}`);
      requiredTypes.add(move.type);
    }
  }

  const moveChanges = [];
  for (const type of [...requiredTypes].sort()) {
    const [id, slug] = maxMoves[type] || [];
    if (!id) throw new Error(`Attaque Max inconnue pour le type ${type}`);
    const file = path.join(maxMoveDir, `${id}.json`);
    if (fs.existsSync(file)) continue;
    const move = {
      id,
      slug,
      power: 250,
      energy: -100,
      durationMs: 2500,
      type,
      names: await moveNames(slug),
      combat: null,
    };
    moveChanges.push(path.relative(rootDir, file));
    if (write) writeJson(file, move);
  }

  const dynamaxEnabled = [];
  const dynamaxDisabled = [];
  const pokemonChanges = [];
  for (const { file, pokemon } of pokemonByDex.values()) {
    const dynamax = releaseDates.has(pokemon.dexNr);
    if (pokemon.availability?.dynamax === dynamax) continue;
    if (dynamax) dynamaxEnabled.push(pokemon.formId);
    else dynamaxDisabled.push(pokemon.formId);
    pokemon.availability = { ...(pokemon.availability || {}), dynamax };
    pokemonChanges.push(path.relative(rootDir, file));
    if (write) writeJson(file, pokemon);
  }

  const expectedFiles = new Set();
  const formChanges = [];
  for (const { pokemon, sourceForm, sourceFormId } of selectedForms) {
    const baseFormId = sourceFormId || pokemon.formId;
    const formId = `${baseFormId}_DYNAMAX`;
    const sourceSlug = sourceForm.slug || pokemon.slug;
    const file = path.join(dynamaxDir, `${pokemon.dexId}-${sourceSlug}-dynamax.json`);
    expectedFiles.add(path.resolve(file));
    const moves = [
      ...new Set(
        [...(sourceForm.quickMoves || []), ...(sourceForm.eliteQuickMoves || [])].map(
          (moveId) => maxMoves[fastMoves.get(moveId).type][0],
        ),
      ),
    ].sort();
    const form = {
      id: pokemon.id,
      formId,
      form: "dynamax",
      dexNr: pokemon.dexNr,
      dexId: pokemon.dexId,
      generation: pokemon.generation,
      baseFormId,
      slug: `${sourceSlug}-dynamax`,
      maxCp: {
        maxLevel50: pokemon.maxCp?.maxLevel50 ?? null,
        maxLevel40: pokemon.maxCp?.maxLevel40 ?? null,
        maxBattlesLevel20: pokemon.maxCp?.raidLevel20 ?? null,
      },
      maxBattle: { moves },
      evolutions: dynamaxEvolutions(sourceForm, selectedFormIds),
    };
    if (sourceFormId) {
      form.names = sourceForm.names;
      form.stats = sourceForm.stats;
      form.primaryType = sourceForm.primaryType;
      form.secondaryType = sourceForm.secondaryType;
      form.assets = sourceForm.assets;
    }
    const previous = fs.existsSync(file) ? read(file) : null;
    if (!same(previous, form)) {
      formChanges.push(path.relative(rootDir, file));
      if (write) writeJson(file, form);
    }
  }

  const obsoleteForms = files(dynamaxDir)
    .filter((file) => !expectedFiles.has(path.resolve(file)))
    .map((file) => path.relative(rootDir, file));
  if (write) {
    for (const file of obsoleteForms) fs.unlinkSync(path.join(rootDir, file));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    asOf,
    write,
    releasedDexNumbers: releaseDates.size,
    dynamaxForms: selectedForms.length,
    futureReleases,
    excludedMaxBattleParticipants,
    requiredMaxMoveTypes: [...requiredTypes].sort(),
    moveChanges,
    pokemonChanges,
    formChanges,
    obsoleteForms,
    dynamaxEnabled,
    dynamaxDisabled,
  };
  writeJson(reportFile, report);
  console.log(
    `${write ? "Écriture" : "Simulation"}: ${releaseDates.size} Pokémon, ` +
      `${selectedForms.length} fiches Dynamax, ${requiredTypes.size} attaques Max.`,
  );
  console.log(
    `À modifier: ${pokemonChanges.length} Pokémon, ${formChanges.length} formes, ` +
      `${moveChanges.length} attaques; ${obsoleteForms.length} formes obsolètes.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
