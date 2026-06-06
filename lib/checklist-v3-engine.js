const fs = require("fs");
const path = require("path");

const rootDir = process.cwd();
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const languages = [
  "English",
  "German",
  "French",
  "Italian",
  "Japanese",
  "Korean",
  "Spanish",
];

function listJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(entryPath);
    return entry.isFile() &&
      entry.name.endsWith(".json") &&
      entry.name !== "index.json"
      ? [entryPath]
      : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function actualType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function createValidator() {
  const issues = [];

  function add(pathName, issue, expected, actual) {
    issues.push({ path: pathName, issue, expected, actual });
  }

  function field(object, key, pathName, type, options = {}) {
    const value = object?.[key];
    if (value === undefined) {
      add(pathName, "missing", type, "absent");
      return undefined;
    }
    if (value === null && options.nullable) return value;
    if (actualType(value) !== type) {
      add(
        pathName,
        "type",
        options.nullable ? `${type} ou null` : type,
        actualType(value),
      );
      return value;
    }
    if (
      options.nonEmpty &&
      ((type === "string" && value.trim() === "") ||
        Object.keys(value).length === 0)
    ) {
      add(pathName, "empty", "non vide", "vide");
    }
    return value;
  }

  function names(value, pathName) {
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "objet de traductions",
        actualType(value),
      );
      return;
    }
    for (const language of languages)
      field(value, language, `${pathName}.${language}`, "string", {
        nonEmpty: true,
      });
  }

  function typeBlock(value, pathName, nullable = false) {
    if (value === null && nullable) return;
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        nullable ? "objet ou null" : "objet",
        actualType(value),
      );
      return;
    }
    field(value, "type", `${pathName}.type`, "string", { nonEmpty: true });
    names(value.names, `${pathName}.names`);
  }

  function region(value, pathName) {
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "objet",
        actualType(value),
      );
      return;
    }
    field(value, "id", `${pathName}.id`, "string", { nonEmpty: true });
    field(value, "slug", `${pathName}.slug`, "string", { nonEmpty: true });
    field(value, "generation", `${pathName}.generation`, "number");
    names(value.names, `${pathName}.names`);
  }

  function move(value, pathName) {
    if (actualType(value) !== "object") {
      add(pathName, "type", "objet attaque", actualType(value));
      return;
    }
    for (const key of ["id", "slug"])
      field(value, key, `${pathName}.${key}`, "string", { nonEmpty: true });
    for (const key of ["power", "energy", "durationMs"])
      field(value, key, `${pathName}.${key}`, "number");
    typeBlock(value.type, `${pathName}.type`);
    names(value.names, `${pathName}.names`);
    const combat = field(value, "combat", `${pathName}.combat`, "object");
    if (actualType(combat) === "object") {
      for (const key of ["energy", "power", "turns"])
        field(combat, key, `${pathName}.combat.${key}`, "number");
      field(combat, "buffs", `${pathName}.combat.buffs`, "object", {
        nullable: true,
      });
    }
  }

  function moveDictionary(value, pathName) {
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "objet non vide",
        actualType(value),
      );
      return;
    }
    if (Object.keys(value).length === 0)
      add(pathName, "empty", "objet non vide", "vide");
    for (const [moveId, moveData] of Object.entries(value))
      move(moveData, `${pathName}.${moveId}`);
  }

  function eliteMoves(value, pathName) {
    if (Array.isArray(value)) return;
    moveDictionary(value, pathName);
  }

  function pvp(value, pathName) {
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "objet non vide",
        actualType(value),
      );
      return;
    }
    if (Object.keys(value).length === 0)
      add(pathName, "empty", "objet non vide", "vide");
    for (const [league, leagueData] of Object.entries(value)) {
      const leaguePath = `${pathName}.${league}`;
      if (actualType(leagueData) !== "object") {
        add(leaguePath, "type", "objet ligue", actualType(leagueData));
        continue;
      }
      field(leagueData, "tierRank", `${leaguePath}.tierRank`, "string", {
        nonEmpty: true,
      });
      const rank1 = field(leagueData, "rank1", `${leaguePath}.rank1`, "object");
      if (actualType(rank1) === "object") {
        const ivs = field(rank1, "ivs", `${leaguePath}.rank1.ivs`, "object");
        if (actualType(ivs) === "object") {
          for (const key of ["attack", "defense", "stamina"])
            field(ivs, key, `${leaguePath}.rank1.ivs.${key}`, "number");
        }
        field(rank1, "level", `${leaguePath}.rank1.level`, "number");
        field(rank1, "cp", `${leaguePath}.rank1.cp`, "number");
      }
      const movesets = field(
        leagueData,
        "bestMovesets",
        `${leaguePath}.bestMovesets`,
        "object",
      );
      if (actualType(movesets) === "object") {
        field(movesets, "fast", `${leaguePath}.bestMovesets.fast`, "string", {
          nonEmpty: true,
        });
        field(
          movesets,
          "charged",
          `${leaguePath}.bestMovesets.charged`,
          "array",
          { nonEmpty: true },
        );
      }
    }
  }

  function assets(value, pathName) {
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "objet",
        actualType(value),
      );
      return;
    }
    field(value, "image", `${pathName}.image`, "string", { nonEmpty: true });
    field(value, "shinyImage", `${pathName}.shinyImage`, "string", {
      nonEmpty: true,
    });
  }

  function evolution(value, pathName) {
    for (const key of ["id", "slug", "formId", "form"])
      field(value, key, `${pathName}.${key}`, "string", { nonEmpty: true });
    field(value, "candies", `${pathName}.candies`, "number");
    field(value, "item", `${pathName}.item`, "object", { nullable: true });
    field(value, "quests", `${pathName}.quests`, "array");
  }

  function mega(value, pathName) {
    if (actualType(value) !== "object") {
      add(pathName, "type", "objet Méga / Primo", actualType(value));
      return;
    }
    for (const key of ["id", "slug", "formId", "form"])
      field(value, key, `${pathName}.${key}`, "string", { nonEmpty: true });
    names(value.names, `${pathName}.names`);
    const size = field(value, "size", `${pathName}.size`, "object");
    if (actualType(size) === "object")
      for (const key of ["height", "weight"])
        field(size, key, `${pathName}.size.${key}`, "number");
    for (const key of ["catchRate", "fleeRate", "energyCost"])
      field(value, key, `${pathName}.${key}`, "number");
    const availability = field(
      value,
      "availability",
      `${pathName}.availability`,
      "object",
    );
    if (actualType(availability) === "object") {
      for (const key of [
        "released",
        "shinyReleased",
        "tradable",
        "pokemonHomeTransfer",
      ])
        field(availability, key, `${pathName}.availability.${key}`, "boolean");
    }
    const maxCp = field(value, "maxCp", `${pathName}.maxCp`, "object");
    if (actualType(maxCp) === "object") {
      for (const key of [
        "maxLevel50",
        "maxLevel40",
        "weatherBoostLevel25",
        "raidLevel20",
        "researchLevel15",
      ])
        field(maxCp, key, `${pathName}.maxCp.${key}`, "number");
    }
    const stats = field(value, "stats", `${pathName}.stats`, "object");
    if (actualType(stats) === "object")
      for (const key of ["stamina", "attack", "defense"])
        field(stats, key, `${pathName}.stats.${key}`, "number");
    typeBlock(value.primaryType, `${pathName}.primaryType`);
    typeBlock(value.secondaryType, `${pathName}.secondaryType`, true);
    assets(value.assets, `${pathName}.assets`);
  }

  function pokemon(value, profile, pathName = "") {
    const prefix = pathName ? `${pathName}.` : "";
    for (const key of ["id", "formId", "slug", "dexId", "form"])
      field(value, key, `${prefix}${key}`, "string", { nonEmpty: true });
    for (const key of ["dexNr", "generation"])
      field(value, key, `${prefix}${key}`, "number");
    names(value.names, `${prefix}names`);
    region(value.region, `${prefix}region`);
    const size = field(value, "size", `${prefix}size`, "object");
    if (actualType(size) === "object")
      for (const key of ["height", "weight"])
        field(size, key, `${prefix}size.${key}`, "number");
    field(value, "weatherBoost", `${prefix}weatherBoost`, "array", {
      nonEmpty: true,
    });
    for (const key of [
      "buddyDistance",
      "catchRate",
      "fleeRate",
      "megaEnergyReward",
    ])
      field(value, key, `${prefix}${key}`, "number");
    for (const [blockName, keys] of [
      ["captureRewards", ["candy", "stardust"]],
      ["secondChargeMoveCost", ["candy", "stardust"]],
      ["stats", ["stamina", "attack", "defense"]],
      [
        "maxCp",
        [
          "maxLevel50",
          "maxLevel40",
          "weatherBoostLevel25",
          "raidLevel20",
          "researchLevel15",
        ],
      ],
    ]) {
      const block = field(value, blockName, `${prefix}${blockName}`, "object");
      if (actualType(block) === "object")
        for (const key of keys)
          field(block, key, `${prefix}${blockName}.${key}`, "number");
    }
    const availability = field(
      value,
      "availability",
      `${prefix}availability`,
      "object",
    );
    if (actualType(availability) === "object") {
      for (const key of [
        "released",
        "shinyReleased",
        "tradable",
        "pokemonHomeTransfer",
        "shadow",
        "dynamax",
        "gigantamax",
        "apex",
      ]) {
        field(availability, key, `${prefix}availability.${key}`, "boolean");
      }
    }
    pvp(value.pvp, `${prefix}pvp`);
    typeBlock(value.primaryType, `${prefix}primaryType`);
    typeBlock(value.secondaryType, `${prefix}secondaryType`, true);
    field(value, "pokemonClass", `${prefix}pokemonClass`, "string", {
      nullable: true,
    });
    moveDictionary(value.quickMoves, `${prefix}quickMoves`);
    moveDictionary(value.cinematicMoves, `${prefix}cinematicMoves`);
    if (value.eliteQuickMoves === undefined)
      add(`${prefix}eliteQuickMoves`, "missing", "tableau ou objet", "absent");
    else eliteMoves(value.eliteQuickMoves, `${prefix}eliteQuickMoves`);
    if (value.eliteCinematicMoves === undefined)
      add(
        `${prefix}eliteCinematicMoves`,
        "missing",
        "tableau ou objet",
        "absent",
      );
    else eliteMoves(value.eliteCinematicMoves, `${prefix}eliteCinematicMoves`);
    assets(value.assets, `${prefix}assets`);

    const evolutions = field(
      value,
      "evolutions",
      `${prefix}evolutions`,
      "array",
    );
    if (Array.isArray(evolutions)) {
      if (
        (profile === "base" || profile === "intermediate") &&
        evolutions.length === 0
      ) {
        add(`${prefix}evolutions`, "empty", "au moins une évolution", "vide");
      }
      evolutions.forEach((item, index) =>
        evolution(item, `${prefix}evolutions[${index}]`),
      );
    }

    field(value, "hasMegaEvolution", `${prefix}hasMegaEvolution`, "boolean");
    field(
      value,
      "hasGigantamaxEvolution",
      `${prefix}hasGigantamaxEvolution`,
      "boolean",
    );
    const regionForms = field(
      value,
      "regionForms",
      `${prefix}regionForms`,
      actualType(value.regionForms) === "object" ? "object" : "array",
    );
    if (actualType(regionForms) === "object") {
      for (const [id, formData] of Object.entries(regionForms))
        pokemon(formData, "form", `${prefix}regionForms.${id}`);
    }
    const megas = field(
      value,
      "megaEvolutions",
      `${prefix}megaEvolutions`,
      actualType(value.megaEvolutions) === "object" ? "object" : "array",
    );
    if (
      value.hasMegaEvolution === true &&
      actualType(megas) === "object" &&
      Object.keys(megas).length === 0
    ) {
      add(
        `${prefix}megaEvolutions`,
        "empty",
        "au moins une Méga / Primo",
        "vide",
      );
    }
    if (actualType(megas) === "object")
      for (const [id, megaData] of Object.entries(megas))
        mega(megaData, `${prefix}megaEvolutions.${id}`);
    const assetForms = field(
      value,
      "assetForms",
      `${prefix}assetForms`,
      "array",
    );
    if (Array.isArray(assetForms)) {
      assetForms.forEach((asset, index) => {
        const assetPath = `${prefix}assetForms[${index}]`;
        field(asset, "form", `${assetPath}.form`, "string", { nullable: true });
        field(asset, "costume", `${assetPath}.costume`, "string", {
          nullable: true,
        });
        field(asset, "isFemale", `${assetPath}.isFemale`, "boolean");
        field(asset, "image", `${assetPath}.image`, "string", {
          nonEmpty: true,
        });
        field(asset, "shinyImage", `${assetPath}.shinyImage`, "string", {
          nonEmpty: true,
        });
      });
    }
  }

  return { issues, pokemon, mega };
}

function evolutionProfile(data, incomingIds) {
  const hasIncoming = incomingIds.has(data.formId) || incomingIds.has(data.id);
  const hasOutgoing =
    Array.isArray(data.evolutions) && data.evolutions.length > 0;
  if (!hasIncoming && hasOutgoing) return "base";
  if (hasIncoming && hasOutgoing) return "intermediate";
  if (hasIncoming && !hasOutgoing) return "final";
  return "single";
}

function buildChecklist() {
  const sources = [];
  for (const file of fs
    .readdirSync(pokemonDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(pokemonDir, name))) {
    sources.push({ file, kind: "pokemon", data: readJson(file) });
  }
  for (const file of listJsonFiles(formsDir).sort()) {
    const data = readJson(file);
    sources.push({
      file,
      kind: String(data.form || "").startsWith("mega") ? "mega" : "form",
      data,
    });
  }

  const dedicatedMegaIds = new Set(
    sources
      .filter((source) => source.kind === "mega")
      .map(
        (source) =>
          `${source.data.dexId}:${source.data.formId || source.data.id}`,
      ),
  );
  for (const source of sources.filter((item) => item.kind === "pokemon")) {
    if (actualType(source.data.megaEvolutions) !== "object") continue;
    for (const [megaId, megaData] of Object.entries(
      source.data.megaEvolutions,
    )) {
      if (
        dedicatedMegaIds.has(
          `${source.data.dexId}:${megaData.formId || megaData.id || megaId}`,
        )
      )
        continue;
      sources.push({
        file: source.file,
        kind: "mega",
        data: {
          dexId: source.data.dexId,
          generation: source.data.generation,
          formId: megaData.formId || megaData.id || megaId,
          form:
            megaData.form || (megaId.includes("PRIMAL") ? "primal" : "mega"),
          ...megaData,
        },
      });
    }
  }

  const incomingIds = new Set();
  for (const source of sources.filter((source) => source.kind !== "mega")) {
    for (const evolutionData of source.data.evolutions || []) {
      incomingIds.add(evolutionData.formId);
      incomingIds.add(evolutionData.id);
    }
  }

  return sources.map(({ file, kind, data }) => {
    const validator = createValidator();
    const profile =
      kind === "mega" ? "mega" : evolutionProfile(data, incomingIds);
    if (kind === "mega") validator.mega(data, "");
    else validator.pokemon(data, profile);
    for (const issue of validator.issues)
      issue.path = issue.path.replace(/^\./, "");
    const name =
      data.names?.French ||
      data.names?.English ||
      data.slug ||
      data.id ||
      path.basename(file);
    return {
      key: `${kind}:${path.relative(rootDir, file)}`,
      kind,
      profile,
      name,
      dexId: data.dexId || path.basename(file).slice(0, 4),
      generation: data.generation || null,
      form: data.form || "normal",
      file: path.relative(rootDir, file),
      image: data.assets?.image || null,
      shinyImage: data.assets?.shinyImage || null,
      primaryType: data.primaryType?.type || null,
      secondaryType: data.secondaryType?.type || null,
      stats: data.stats || null,
      maxCp: data.maxCp || null,
      availability: data.availability || null,
      pvpLeagues:
        data.pvp && typeof data.pvp === "object" ? Object.keys(data.pvp) : [],
      quickMoveCount:
        data.quickMoves && typeof data.quickMoves === "object"
          ? Object.keys(data.quickMoves).length
          : 0,
      chargedMoveCount:
        data.cinematicMoves && typeof data.cinematicMoves === "object"
          ? Object.keys(data.cinematicMoves).length
          : 0,
      evolutionCount: Array.isArray(data.evolutions)
        ? data.evolutions.length
        : 0,
      complete: validator.issues.length === 0,
      issues: validator.issues,
    };
  });
}

function detailForKey(key) {
  const separator = key.indexOf(":");
  const kind = key.slice(0, separator);
  const relativeFile = key.slice(separator + 1);
  const file = path.resolve(rootDir, relativeFile);
  if (!file.startsWith(rootDir) || !fs.existsSync(file)) return null;
  const data = readJson(file);

  if (kind === "mega" && relativeFile.startsWith("data/pokemon/")) {
    const mega = Object.values(data.megaEvolutions || {})[0];
    return mega
      ? { ...mega, dexId: data.dexId, generation: data.generation }
      : data;
  }
  return data;
}

module.exports = { buildChecklist, detailForKey };
