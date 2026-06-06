const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const rootDir = path.resolve(__dirname, "..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const progressFile = path.join(rootDir, ".pokemon-checklist-progress.json");
const publicDir = path.join(rootDir, "checklist");
const port = Number(process.env.CHECKLIST_PORT || 3001);
const host = "127.0.0.1";

const pokemonFields = [
  "size.height",
  "size.weight",
  "weatherBoost",
  "buddyDistance",
  "catchRate",
  "fleeRate",
  "captureRewards.candy",
  "captureRewards.stardust",
  "megaEnergyReward",
  "secondChargeMoveCost.candy",
  "secondChargeMoveCost.stardust",
  "availability.released",
  "availability.shinyReleased",
  "availability.tradable",
  "availability.pokemonHomeTransfer",
  "availability.shadow",
  "availability.dynamax",
  "availability.gigantamax",
  "availability.apex",
  "maxCp.maxLevel50",
  "maxCp.maxLevel40",
  "maxCp.weatherBoostLevel25",
  "maxCp.raidLevel20",
  "maxCp.researchLevel15",
];

const pvpLeagueFields = [
  "tierRank",
  "rank1.ivs.attack",
  "rank1.ivs.defense",
  "rank1.ivs.stamina",
  "rank1.level",
  "rank1.cp",
  "bestMovesets.fast",
  "bestMovesets.charged",
];

const megaFields = [
  "size.height",
  "size.weight",
  "catchRate",
  "fleeRate",
  "availability.released",
  "availability.shinyReleased",
  "availability.tradable",
  "availability.pokemonHomeTransfer",
  "maxCp.maxLevel50",
  "maxCp.maxLevel40",
  "maxCp.weatherBoostLevel25",
  "maxCp.raidLevel20",
  "maxCp.researchLevel15",
];

app.use(express.json());
app.use(express.static(publicDir));

function readProgress() {
  try {
    return JSON.parse(fs.readFileSync(progressFile, "utf8"));
  } catch {
    return {};
  }
}

function writeProgress(progress) {
  if (Object.keys(progress).length === 0) {
    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
    }
    return;
  }
  fs.writeFileSync(progressFile, `${JSON.stringify(progress, null, 2)}\n`);
}

function getValue(object, field) {
  return field.split(".").reduce((value, key) => value?.[key], object);
}

function isFilled(value) {
  return value !== undefined && value !== null && value !== "";
}

function getPvpMissingFields(data) {
  if (!data.pvp || typeof data.pvp !== "object" || Object.keys(data.pvp).length === 0) {
    return ["pvp"];
  }

  return Object.entries(data.pvp).flatMap(([league, leagueData]) => (
    pvpLeagueFields
      .filter((field) => !isFilled(getValue(leagueData, field)))
      .map((field) => `pvp.${league}.${field}`)
  ));
}

function inspectEntry({ key, type, data, file, generation, parentName }) {
  const expectedFields = type === "mega" ? megaFields : pokemonFields;
  const missingFields = expectedFields.filter((field) => !isFilled(getValue(data, field)));
  if (type !== "mega") {
    missingFields.push(...getPvpMissingFields(data));
  }
  const name = data.names?.French || data.names?.English || data.slug || data.id || key;

  return {
    key,
    type,
    name,
    parentName,
    dexId: data.dexId || path.basename(file).slice(0, 4),
    generation: data.generation || generation || null,
    form: data.form || (type === "mega" ? "mega" : "normal"),
    file: path.relative(rootDir, file),
    image: data.assets?.image || null,
    shinyImage: data.assets?.shinyImage || null,
    pvpLeagues: type !== "mega" && data.pvp && typeof data.pvp === "object"
      ? Object.keys(data.pvp)
      : [],
    complete: missingFields.length === 0,
    missingFields,
  };
}

function listJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return listJsonFiles(entryPath);
    }
    return entry.isFile() && entry.name.endsWith(".json") && entry.name !== "index.json"
      ? [entryPath]
      : [];
  });
}

function isMegaForm(data) {
  return String(data.form || "").startsWith("mega");
}

function buildChecklist() {
  const entries = [];
  const pokemonFiles = fs.readdirSync(pokemonDir)
    .filter((file) => file.endsWith(".json"))
    .sort();
  const pokemonByDex = new Map();
  const pokemonSources = [];
  const dedicatedMegaIds = new Set();

  for (const filename of pokemonFiles) {
    const file = path.join(pokemonDir, filename);

    try {
      const pokemon = JSON.parse(fs.readFileSync(file, "utf8"));
      pokemonByDex.set(pokemon.dexId, pokemon);
      pokemonSources.push({ filename, file, pokemon });
      const pokemonKey = `pokemon:${filename}`;

      entries.push(inspectEntry({
        key: pokemonKey,
        type: "pokemon",
        data: pokemon,
        file,
        generation: pokemon.generation,
      }));
    } catch (error) {
      entries.push({
        key: `pokemon:${filename}`,
        type: "pokemon",
        name: filename,
        dexId: filename.slice(0, 4),
        generation: null,
        form: "erreur",
        file: path.relative(rootDir, file),
        complete: false,
        missingFields: [],
        parseError: error.message,
      });
    }
  }

  for (const file of listJsonFiles(formsDir).sort()) {
    const relativeFile = path.relative(formsDir, file);

    try {
      const form = JSON.parse(fs.readFileSync(file, "utf8"));
      const parent = pokemonByDex.get(form.dexId);
      const type = isMegaForm(form) ? "mega" : "form";
      const parentName = parent?.names?.French || parent?.names?.English || parent?.slug || form.id;

      if (type === "mega") {
        dedicatedMegaIds.add(`${form.dexId}:${form.formId || form.id}`);
      }

      entries.push(inspectEntry({
        key: `${type}:${relativeFile}`,
        type,
        data: form,
        file,
        generation: form.generation || parent?.generation,
        parentName,
      }));
    } catch (error) {
      entries.push({
        key: `form:${relativeFile}`,
        type: "form",
        name: relativeFile,
        dexId: path.basename(file).slice(0, 4),
        generation: null,
        form: "erreur",
        file: path.relative(rootDir, file),
        complete: false,
        missingFields: [],
        parseError: error.message,
      });
    }
  }

  for (const { filename, file, pokemon } of pokemonSources) {
    if (!pokemon.megaEvolutions || Array.isArray(pokemon.megaEvolutions)) {
      continue;
    }

    const parentName = pokemon.names?.French || pokemon.names?.English || pokemon.slug;
    for (const [megaId, mega] of Object.entries(pokemon.megaEvolutions)) {
      if (dedicatedMegaIds.has(`${pokemon.dexId}:${mega.formId || mega.id || megaId}`)) {
        continue;
      }

      entries.push(inspectEntry({
        key: `mega:${filename}:${megaId}`,
        type: "mega",
        data: mega,
        file,
        generation: pokemon.generation,
        parentName,
      }));
    }
  }

  return entries;
}

app.get("/api/checklist", (_request, response) => {
  response.json({
    entries: buildChecklist(),
    progress: readProgress(),
  });
});

app.post("/api/progress", (request, response) => {
  const { key, checked } = request.body || {};

  if (typeof key !== "string" || typeof checked !== "boolean") {
    return response.status(400).json({ error: "key et checked sont obligatoires." });
  }

  const progress = readProgress();
  if (checked) {
    progress[key] = true;
  } else {
    delete progress[key];
  }
  writeProgress(progress);
  return response.json({ progress });
});

app.listen(port, host, () => {
  console.log(`Checklist Pokemon disponible sur http://${host}:${port}`);
});
