const fs = require("fs");
const path = require("path");
const { buildCpByLevel } = require("../../../src/lib/pokemon-cp");

const rootDir = process.cwd();
const pokemonDir = path.join(rootDir, "data", "pokemon");
const formsDir = path.join(rootDir, "data", "pokemon-forms");
const movesDir = path.join(rootDir, "data", "moves");
const languages = [
  "English",
  "German",
  "French",
  "Italian",
  "Japanese",
  "Korean",
  "Spanish",
];
const copySuffix = / \d+\.json$/;

function listJsonFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(entryPath);
    return entry.isFile() &&
      entry.name.endsWith(".json") &&
      !copySuffix.test(entry.name) &&
      entry.name !== "index.json"
      ? [entryPath]
      : [];
  });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function buildMoveCatalog() {
  return new Map(
    listJsonFiles(movesDir).map((file) => {
      const move = readJson(file);
      return [move.id, move];
    }),
  );
}

function resolveMoves(value, catalog) {
  const ids = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? Object.keys(value)
      : [];
  return Object.fromEntries(
    ids.map((id) => [id, catalog.get(id) || { id }]),
  );
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
    if (typeof value === "string" && value.trim()) return;
    add(
      pathName,
      value === undefined ? "missing" : "type",
      nullable ? "identifiant ou null" : "identifiant de type",
      actualType(value),
    );
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
    const combat = field(value, "combat", `${pathName}.combat`, "object", {
      nullable: true,
    });
    if (actualType(combat) === "object") {
      for (const key of ["energy", "power", "turns"])
        field(combat, key, `${pathName}.combat.${key}`, "number");
      field(combat, "buffs", `${pathName}.combat.buffs`, "object", {
        nullable: true,
      });
    }
  }

  function moveDictionary(value, pathName, allowEmpty = false) {
    if (Array.isArray(value)) {
      if (!allowEmpty && value.length === 0)
        add(pathName, "empty", "au moins un identifiant d'attaque", "vide");
      value.forEach((moveId, index) => {
        if (typeof moveId !== "string" || moveId.trim() === "")
          add(
            `${pathName}[${index}]`,
            "type",
            "identifiant d'attaque",
            actualType(moveId),
          );
      });
      return;
    }
    if (actualType(value) !== "object") {
      add(
        pathName,
        value === undefined ? "missing" : "type",
        "tableau d'identifiants",
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
    moveDictionary(value, pathName, true);
  }

  function pvp(value, pathName) {
    if (value === null) return;
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
    for (const league of [
      "littleCup",
      "greatLeague",
      "ultraLeague",
      "masterLeague",
    ]) {
      const leagueData = value[league];
      const leaguePath = `${pathName}.${league}`;
      if (leagueData === undefined) {
        add(leaguePath, "missing", "objet ligue ou null", "absent");
        continue;
      }
      if (leagueData === null) continue;
      if (actualType(leagueData) !== "object") {
        add(leaguePath, "type", "objet ligue ou null", actualType(leagueData));
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
    if (value.home !== undefined) homeAssets(value.home, `${pathName}.home`);
  }

  function homeAssets(value, pathName) {
    if (actualType(value) !== "object") {
      add(pathName, "type", "objet d'assets Pokémon Home", actualType(value));
      return;
    }
    field(value, "source", `${pathName}.source`, "string", { nonEmpty: true });
    field(value, "image", `${pathName}.image`, "string", {
      nonEmpty: true,
      nullable: true,
    });
    field(value, "shinyImage", `${pathName}.shinyImage`, "string", {
      nonEmpty: true,
      nullable: true,
    });
    const variants = field(value, "variants", `${pathName}.variants`, "array", {
      nonEmpty: true,
    });
    if (!Array.isArray(variants)) return;
    variants.forEach((variant, index) => {
      const variantPath = `${pathName}.variants[${index}]`;
      for (const key of ["formIndex", "gender", "genderCode", "detail", "view"])
        field(variant, key, `${variantPath}.${key}`, "string", { nonEmpty: true });
      field(variant, "gigantamax", `${variantPath}.gigantamax`, "boolean");
      if (variant.image !== undefined)
        field(variant, "image", `${variantPath}.image`, "string", { nonEmpty: true });
      if (variant.shinyImage !== undefined)
        field(variant, "shinyImage", `${variantPath}.shinyImage`, "string", {
          nonEmpty: true,
        });
      if (!variant.image && !variant.shinyImage)
        add(variantPath, "missing", "image ou shinyImage", "absent");
    });
  }

  function evolution(value, pathName) {
    field(value, "targetFormId", `${pathName}.targetFormId`, "string", {
      nonEmpty: true,
    });
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

  function maxForm(value, pathName = "") {
    const prefix = pathName ? `${pathName}.` : "";
    for (const key of ["id", "formId", "slug", "dexId", "form", "baseFormId"])
      field(value, key, `${prefix}${key}`, "string", { nonEmpty: true });
    for (const key of ["dexNr", "generation"])
      field(value, key, `${prefix}${key}`, "number");
    if (!["dynamax", "gigantamax"].includes(value.form))
      add(`${prefix}form`, "value", "dynamax ou gigantamax", value.form);

    const maxCp = field(value, "maxCp", `${prefix}maxCp`, "object");
    if (actualType(maxCp) === "object") {
      const allowedMaxCp = new Set([
        "maxLevel50",
        "maxLevel40",
        "maxBattlesLevel20",
      ]);
      for (const key of Object.keys(maxCp))
        if (!allowedMaxCp.has(key))
          add(
            `${prefix}maxCp.${key}`,
            "unexpected",
            "uniquement maxLevel50, maxLevel40, maxBattlesLevel20",
            "champ en trop",
          );
      for (const key of ["maxLevel50", "maxLevel40"])
        field(maxCp, key, `${prefix}maxCp.${key}`, "number");
      field(
        maxCp,
        "maxBattlesLevel20",
        `${prefix}maxCp.maxBattlesLevel20`,
        "number",
        { nullable: true },
      );
    }

    const maxBattle = field(value, "maxBattle", `${prefix}maxBattle`, "object");
    if (actualType(maxBattle) === "object") {
      for (const key of Object.keys(maxBattle))
        if (key !== "moves")
          add(
            `${prefix}maxBattle.${key}`,
            "unexpected",
            "uniquement moves",
            "champ en trop",
          );
      moveDictionary(maxBattle.moves, `${prefix}maxBattle.moves`);
    }
    if (value.availability !== undefined) {
      const availability = field(
        value,
        "availability",
        `${prefix}availability`,
        "object",
      );
      if (actualType(availability) === "object")
        for (const [key, flag] of Object.entries(availability))
          if (typeof flag !== "boolean")
            add(
              `${prefix}availability.${key}`,
              "type",
              "boolean",
              actualType(flag),
            );
    }
    if (value.assets !== undefined) assets(value.assets, `${prefix}assets`);
    if (value.evolutions !== undefined) {
      const evolutions = field(
        value,
        "evolutions",
        `${prefix}evolutions`,
        "array",
      );
      if (Array.isArray(evolutions))
        evolutions.forEach((item, index) =>
          evolution(item, `${prefix}evolutions[${index}]`),
        );
    }
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
    for (const key of ["buddyDistance", "catchRate", "fleeRate"])
      field(value, key, `${prefix}${key}`, "number");
    field(value, "megaEnergyReward", `${prefix}megaEnergyReward`, "number", {
      nullable: true,
    });
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

  return { issues, pokemon, mega, maxForm };
}

function validateSourceData(data, relativeFile = "", kindHint = "") {
  const validator = createValidator();
  const kind =
    relativeFile.startsWith("data/pokemon/") ? "pokemon" :
    kindHint ||
    (String(data.form || "").startsWith("mega")
      ? "mega"
      : ["dynamax", "gigantamax"].includes(data.form)
        ? data.form
        : "pokemon");
  if (kind === "mega" && relativeFile.startsWith("data/pokemon-forms/"))
    validator.mega(data, "");
  else if (kind === "dynamax" || kind === "gigantamax")
    validator.maxForm(data, "");
  else validator.pokemon(data, "single");
  for (const issue of validator.issues)
    issue.path = issue.path.replace(/^\./, "");
  const moveIds = new Set(buildMoveCatalog().keys());
  const formIds = new Set();
  for (const directory of [pokemonDir, formsDir]) {
    for (const file of listJsonFiles(directory)) {
      const source = readJson(file);
      for (const value of [source.id, source.formId, source.baseFormId])
        if (value) formIds.add(value);
      for (const form of [
        ...Object.values(source.regionForms || {}),
        ...Object.values(source.megaEvolutions || {}),
      ])
        for (const value of [form.id, form.formId])
          if (value) formIds.add(value);
    }
  }
  validator.issues.push(...referenceIssues(data, moveIds, formIds));
  return validator.issues;
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

function mergeInheritedForm(parent, form) {
  const isMaxForm = ["dynamax", "gigantamax"].includes(form.form);
  const merged = {
    ...parent,
    ...form,
    formId: form.formId || form.id || parent.formId,
    availability: {
      ...(parent.availability || {}),
      ...(form.availability || {}),
    },
    stats: form.stats || parent.stats,
    maxCp: isMaxForm
      ? form.maxCp || {}
      : form.maxCp === undefined
        ? parent.maxCp
        : form.maxCp,
    primaryType: form.primaryType || parent.primaryType,
    secondaryType:
      form.secondaryType === undefined ? parent.secondaryType : form.secondaryType,
    pvp: form.pvp === undefined ? parent.pvp : form.pvp,
    assets: {
      ...(parent.assets || {}),
      ...(form.assets || {}),
      home: form.assets?.home || parent.assets?.home,
    },
  };
  if (!isMaxForm) return merged;
  return {
    ...merged,
    quickMoves: form.quickMoves || [],
    cinematicMoves: form.cinematicMoves || [],
    eliteQuickMoves: form.eliteQuickMoves || [],
    eliteCinematicMoves: form.eliteCinematicMoves || [],
    pvp: form.pvp === undefined ? null : form.pvp,
    evolutions: form.evolutions || [],
    regionForms: form.regionForms || [],
    hasMegaEvolution: false,
    megaEvolutions: [],
    hasGigantamaxEvolution: form.form === "gigantamax",
  };
}

function issueCategory(pathName) {
  const path = String(pathName || "").toLowerCase();
  if (path.includes("asset") || path.includes("image")) return "assets";
  if (path.includes("pvp")) return "pvp";
  if (path.includes("move")) return "moves";
  if (path.includes("evolution") || path.includes("form")) return "forms";
  if (path.includes("name") || path.includes("region")) return "translations";
  if (path.includes("stat") || path.includes("maxcp")) return "stats";
  if (path.includes("size") || path.includes("height") || path.includes("weight"))
    return "size";
  if (
    path.includes("availability") ||
    path.includes("capture") ||
    path.includes("catch") ||
    path.includes("flee") ||
    path.includes("buddy") ||
    path.includes("weather")
  )
    return "gameplay";
  return "structure";
}

function qualitySummary(issues) {
  const categories = [...new Set(issues.map((issue) => issueCategory(issue.path)))];
  const missing = issues.filter((issue) => issue.issue === "missing").length;
  const invalid = issues.length - missing;
  const score = Math.max(0, Math.round(100 - missing * 3 - invalid * 5));
  return {
    score,
    categories,
    missing,
    invalid,
    priority: issues.length ? score * 100 - issues.length : -1,
  };
}

function patchPathParts(pathName) {
  return String(pathName)
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
}

function setPatchValue(target, pathName, value) {
  const parts = patchPathParts(pathName);
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];
    if (!cursor[part] || typeof cursor[part] !== "object")
      cursor[part] = typeof next === "number" ? [] : {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function suggestedValue(issue, kind = "pokemon") {
  const pvpLeague = {
    tierRank: "",
    rank1: {
      ivs: { attack: null, defense: null, stamina: null },
      level: null,
      cp: null,
    },
    bestMovesets: { fast: "", charged: [""] },
  };
  const templates = {
    size: { height: null, weight: null },
    availability:
      kind === "mega"
        ? {
            released: false,
            shinyReleased: false,
            tradable: false,
            pokemonHomeTransfer: false,
          }
        : {
            released: false,
            shinyReleased: false,
            tradable: false,
            pokemonHomeTransfer: false,
            shadow: false,
            dynamax: false,
            gigantamax: false,
            apex: false,
          },
    maxCp: {
      maxLevel50: null,
      maxLevel40: null,
      ...(kind === "dynamax" || kind === "gigantamax"
        ? { maxBattlesLevel20: null }
        : {
            weatherBoostLevel25: null,
            raidLevel20: null,
            researchLevel15: null,
          }),
    },
    stats: { stamina: null, attack: null, defense: null },
    captureRewards: { candy: null, stardust: null },
    secondChargeMoveCost: { candy: null, stardust: null },
    assets: { image: "", shinyImage: "" },
    region: {
      id: "",
      slug: "",
      generation: null,
      names: Object.fromEntries(languages.map((language) => [language, ""])),
    },
    names: Object.fromEntries(languages.map((language) => [language, ""])),
    maxBattle: { moves: [""] },
    pvp: {
      littleCup: null,
      greatLeague: null,
      ultraLeague: null,
      masterLeague: null,
    },
    littleCup: pvpLeague,
    greatLeague: pvpLeague,
    ultraLeague: pvpLeague,
    masterLeague: pvpLeague,
    rank1: {
      ivs: { attack: null, defense: null, stamina: null },
      level: null,
      cp: null,
    },
    ivs: { attack: null, defense: null, stamina: null },
    bestMovesets: { fast: "", charged: [""] },
    quickMoves: [""],
    cinematicMoves: [""],
    eliteQuickMoves: [],
    eliteCinematicMoves: [],
    evolutions: [
      { targetFormId: "", candies: null, item: null, quests: [] },
    ],
    regionForms: issue.expected.includes("object") ? {} : [],
    megaEvolutions: issue.expected.includes("object") ? {} : [],
    assetForms: [],
    weatherBoost: [""],
    quests: [],
    moves: [""],
    charged: [""],
  };
  const field = issue.path
    .replace(/\[\d+\]/g, "")
    .split(".")
    .filter(Boolean)
    .at(-1);
  if (Object.hasOwn(templates, field))
    return structuredClone(templates[field]);
  if (
    issue.expected.includes("array") ||
    issue.expected.includes("tableau")
  )
    return issue.expected.includes("au moins") ? [""] : [];
  if (issue.expected.includes("boolean")) return false;
  if (issue.expected.includes("number")) return null;
  if (
    issue.expected.includes("string") ||
    issue.expected.includes("identifiant")
  )
    return "";
  if (issue.expected.includes("object") || issue.expected.includes("objet"))
    return {};
  return null;
}

function buildSuggestedPatch(issues, kind = "pokemon") {
  const patch = {};
  for (const issue of [...issues].sort(
    (left, right) =>
      patchPathParts(left.path).length - patchPathParts(right.path).length,
  ))
    setPatchValue(patch, issue.path, suggestedValue(issue, kind));
  return patch;
}

function assetSummary(data) {
  const home = data.assets?.home || {};
  const homeVariants = Array.isArray(home.variants) ? home.variants : [];
  const goVariants = Array.isArray(data.assetForms) ? data.assetForms : [];
  const urls = [
    data.assets?.image,
    data.assets?.shinyImage,
    home.image,
    home.shinyImage,
    ...goVariants.flatMap((asset) => [asset.image, asset.shinyImage]),
    ...homeVariants.flatMap((asset) => [asset.image, asset.shinyImage]),
  ].filter(Boolean);
  return {
    go: Boolean(data.assets?.image),
    goShiny: Boolean(data.assets?.shinyImage),
    home: Boolean(home.image),
    homeShiny: Boolean(home.shinyImage),
    goVariants: goVariants.length,
    homeVariants: homeVariants.length,
    femaleVariants: homeVariants.filter((asset) =>
      ["fd", "fo"].includes(asset.genderCode),
    ).length,
    backViews: homeVariants.filter((asset) => asset.view === "back").length,
    duplicateUrls: urls.length - new Set(urls).size,
    incompletePairs: [...goVariants, ...homeVariants].filter(
      (asset) => Boolean(asset.image) !== Boolean(asset.shinyImage),
    ).length,
  };
}

function referenceIssues(data, moveIds, formIds) {
  const issues = [];
  const add = (pathName, expected, actual) =>
    issues.push({ path: pathName, issue: "reference", expected, actual });
  if (data.dexId && !/^\d{4}$/.test(data.dexId))
    add("dexId", "identifiant Pokédex sur 4 chiffres", data.dexId);
  if (
    Number.isFinite(data.dexNr) &&
    data.dexId &&
    Number(data.dexId) !== data.dexNr
  )
    add("dexNr", `même numéro que dexId (${Number(data.dexId)})`, data.dexNr);
  for (const block of [
    "quickMoves",
    "cinematicMoves",
    "eliteQuickMoves",
    "eliteCinematicMoves",
  ]) {
    const value = data[block];
    const ids = Array.isArray(value)
      ? value
      : value && typeof value === "object"
        ? Object.keys(value)
        : [];
    ids.forEach((id, index) => {
      if (!moveIds.has(id))
        add(
          `${block}${Array.isArray(value) ? `[${index}]` : `.${id}`}`,
          "identifiant présent dans data/moves",
          id,
        );
    });
  }
  const maxMoves = data.maxBattle?.moves;
  if (Array.isArray(maxMoves))
    maxMoves.forEach((id, index) => {
      if (!moveIds.has(id))
        add(`maxBattle.moves[${index}]`, "identifiant présent dans data/moves", id);
    });
  for (const [index, evolution] of (data.evolutions || []).entries()) {
    const target = evolution.targetFormId || evolution.formId || evolution.id;
    const inheritedTarget = String(target || "").replace(
      /_(DYNAMAX|GIGANTAMAX)$/,
      "",
    );
    if (target && !formIds.has(target) && !formIds.has(inheritedTarget))
      add(
        `evolutions[${index}].targetFormId`,
        "identifiant de forme existant",
        target,
      );
  }
  return issues;
}

function buildChecklist() {
  const sources = [];
  for (const file of fs
    .readdirSync(pokemonDir)
    .filter((name) => name.endsWith(".json") && !copySuffix.test(name))
    .sort()
    .map((name) => path.join(pokemonDir, name))) {
    sources.push({ file, kind: "pokemon", data: readJson(file) });
  }
  for (const file of listJsonFiles(formsDir).sort()) {
    const data = readJson(file);
    const form = String(data.form || "");
    sources.push({
      file,
      kind: form.startsWith("mega")
        ? "mega"
        : ["dynamax", "gigantamax"].includes(form)
          ? form
          : "form",
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
      incomingIds.add(evolutionData.targetFormId);
      incomingIds.add(evolutionData.formId);
      incomingIds.add(evolutionData.id);
    }
  }
  const parents = new Map();
  for (const source of sources.filter((source) => source.kind === "pokemon")) {
    parents.set(source.data.id, source.data);
    parents.set(source.data.formId, source.data);
    parents.set(source.data.dexId, source.data);
  }
  const moveIds = new Set(buildMoveCatalog().keys());
  const formIds = new Set();
  for (const source of sources) {
    for (const value of [source.data.id, source.data.formId, source.data.baseFormId])
      if (value) formIds.add(value);
    for (const mega of Object.values(source.data.megaEvolutions || {}))
      for (const value of [mega.id, mega.formId])
        if (value) formIds.add(value);
    for (const form of Object.values(source.data.regionForms || {}))
      for (const value of [form.id, form.formId])
        if (value) formIds.add(value);
  }

  return sources.map(({ file, kind, data }) => {
    const validator = createValidator();
    const profile =
      ["mega", "dynamax", "gigantamax"].includes(kind)
        ? kind
        : evolutionProfile(data, incomingIds);
    if (kind === "mega") validator.mega(data, "");
    else if (kind === "dynamax" || kind === "gigantamax")
      validator.maxForm(data, "");
    else validator.pokemon(data, profile);
    for (const issue of validator.issues)
      issue.path = issue.path.replace(/^\./, "");
    validator.issues.push(...referenceIssues(data, moveIds, formIds));
    const displayData =
      kind === "dynamax" || kind === "gigantamax"
        ? mergeInheritedForm(
            parents.get(data.baseFormId) ||
              parents.get(data.inherits) ||
              parents.get(data.id) ||
              {},
            data,
          )
        : data;
    const name =
      displayData.names?.French ||
      displayData.names?.English ||
      displayData.slug ||
      data.id ||
      path.basename(file);
    const quality = qualitySummary(validator.issues);
    return {
      key: `${kind}:${path.relative(rootDir, file)}`,
      kind,
      profile,
      name,
      dexId: data.dexId || path.basename(file).slice(0, 4),
      generation: displayData.generation || null,
      form: data.form || "normal",
      file: path.relative(rootDir, file),
      image: displayData.assets?.image || null,
      shinyImage: displayData.assets?.shinyImage || null,
      primaryType:
        typeof displayData.primaryType === "string"
          ? displayData.primaryType
          : displayData.primaryType?.type || null,
      secondaryType:
        typeof displayData.secondaryType === "string"
          ? displayData.secondaryType
          : displayData.secondaryType?.type || null,
      stats: displayData.stats || null,
      maxCp: displayData.maxCp || null,
      availability: displayData.availability || null,
      pvpLeagues:
        displayData.pvp && typeof displayData.pvp === "object"
          ? Object.entries(displayData.pvp)
              .filter(([, league]) => league !== null)
              .map(([league]) => league)
          : [],
      quickMoveCount:
        data.quickMoves && typeof data.quickMoves === "object"
          ? Object.keys(data.quickMoves).length
          : 0,
      chargedMoveCount:
        data.cinematicMoves && typeof data.cinematicMoves === "object"
          ? Object.keys(data.cinematicMoves).length
          : 0,
      maxMoveCount: Array.isArray(data.maxBattle?.moves)
        ? data.maxBattle.moves.length
        : 0,
      evolutionCount: Array.isArray(data.evolutions)
        ? data.evolutions.length
        : 0,
      complete: validator.issues.length === 0,
      issues: validator.issues,
      suggestedPatch: buildSuggestedPatch(validator.issues, kind),
      quality,
      issueCategories: quality.categories,
      assets: assetSummary(displayData),
    };
  });
}

function detailForKey(key) {
  const separator = key.indexOf(":");
  const kind = key.slice(0, separator);
  const relativeFile = key.slice(separator + 1);
  const file = path.resolve(rootDir, relativeFile);
  if (!file.startsWith(rootDir) || !fs.existsSync(file)) return null;
  const sourceData = readJson(file);
  let data = sourceData;

  if (relativeFile.startsWith("data/pokemon-forms/")) {
    const parent = fs
      .readdirSync(pokemonDir)
      .filter((name) => name.endsWith(".json") && !copySuffix.test(name))
      .map((name) => readJson(path.join(pokemonDir, name)))
      .find(
        (candidate) =>
          candidate.id === data.baseFormId ||
          candidate.formId === data.baseFormId ||
          candidate.id === data.inherits ||
          candidate.formId === data.inherits ||
          candidate.id === data.id ||
          (candidate.dexId === data.dexId && candidate.slug === data.slug),
      );
    if (parent) data = mergeInheritedForm(parent, data);
  }

  if (kind === "mega" && relativeFile.startsWith("data/pokemon/")) {
    const mega = Object.values(data.megaEvolutions || {})[0];
    data = mega
      ? { ...mega, dexId: data.dexId, generation: data.generation }
      : data;
  }
  const moveCatalog = buildMoveCatalog();
  return {
    ...data,
    sourceData,
    moveDetails: {
      quickMoves: resolveMoves(data.quickMoves, moveCatalog),
      cinematicMoves: resolveMoves(data.cinematicMoves, moveCatalog),
      eliteQuickMoves: resolveMoves(data.eliteQuickMoves, moveCatalog),
      eliteCinematicMoves: resolveMoves(data.eliteCinematicMoves, moveCatalog),
      maxMoves: resolveMoves(data.maxBattle?.moves, moveCatalog),
    },
    cpByLevel: buildCpByLevel(data.stats),
  };
}

module.exports = {
  assetSummary,
  buildSuggestedPatch,
  buildChecklist,
  detailForKey,
  issueCategory,
  qualitySummary,
  referenceIssues,
  validateSourceData,
};
