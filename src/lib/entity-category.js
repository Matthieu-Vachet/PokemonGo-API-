const CATEGORY_DIRECTORIES = Object.freeze({
  NORMAL: "normal",
  ALOLA: "alola",
  GALAR: "galar",
  HISUI: "hisui",
  PALDEA: "paldea",
  FORM: "forms",
  MEGA: "mega",
  PRIMAL: "primal",
  DYNAMAX: "dynamax",
  GIGANTAMAX: "gigantamax",
});
const DIRECTORY_CATEGORIES = Object.freeze(Object.fromEntries(
  Object.entries(CATEGORY_DIRECTORIES).map(([category, directory]) => [directory, category]),
));
const REGIONAL_FORMS = Object.freeze({
  ALOLA: ["alola", "alolan"],
  GALAR: ["galar", "galarian"],
  HISUI: ["hisui", "hisuian"],
  PALDEA: ["paldea", "paldean"],
});

function normalizedToken(value) { return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function identityToken(value) { return String(value || "").trim().toUpperCase(); }

function classifyPokemonEntity(entity, { isAlternative = false } = {}) {
  if (!entity || typeof entity !== "object") return { category: null, directory: null, ambiguous: true, signals: [], diagnostic: "ENTITY_CLASSIFICATION_AMBIGUOUS" };
  const form = normalizedToken(entity.form);
  const formId = identityToken(entity.formId || entity.id);
  const baseFormId = identityToken(entity.baseFormId || entity.id);
  const distinctIdentity = Boolean(formId && baseFormId && formId !== baseFormId);
  const signals = new Set();
  for (const [category, aliases] of Object.entries(REGIONAL_FORMS)) {
    if (distinctIdentity && aliases.includes(form)) signals.add(category);
  }
  for (const [category, expression] of [
    ["ALOLA", /_(?:ALOLA|ALOLAN)(?:_|$)/],
    ["GALAR", /_(?:GALAR|GALARIAN)(?:_|$)/],
    ["HISUI", /_(?:HISUI|HISUIAN)(?:_|$)/],
    ["PALDEA", /_(?:PALDEA|PALDEAN)(?:_|$)/],
  ]) if (expression.test(`${formId}_`)) signals.add(category);
  if (["mega", "mega-x", "mega-y"].includes(form) || /_MEGA(?:_[XY])?$/.test(formId)) signals.add("MEGA");
  if (form === "primal" || /_PRIMAL$/.test(formId)) signals.add("PRIMAL");
  if (form === "dynamax" || /_DYNAMAX$/.test(formId)) signals.add("DYNAMAX");
  if (form === "gigantamax" || /_GIGANTAMAX$/.test(formId)) signals.add("GIGANTAMAX");
  const unique = [...signals];
  if (unique.length > 1) return { category: null, directory: null, ambiguous: true, signals: unique, diagnostic: "ENTITY_CLASSIFICATION_AMBIGUOUS" };
  const alternative = distinctIdentity || isAlternative || (form && form !== "normal" && !Object.values(REGIONAL_FORMS).flat().includes(form));
  const category = unique[0] || (alternative ? "FORM" : "NORMAL");
  return { category, directory: CATEGORY_DIRECTORIES[category], ambiguous: false, signals: unique.length ? unique : [category], diagnostic: null };
}

function canonicalStem(entity) {
  return `${String(entity.dexId || entity.dexNr || "").padStart(4, "0")}-${normalizedToken(entity.slug || entity.formId || entity.id)}`;
}

function resolveEntityPath({ domain, family, category, entity }) {
  const categoryKey = category ? String(category).toUpperCase() : null;
  const classification = categoryKey
    ? { category: categoryKey, directory: CATEGORY_DIRECTORIES[categoryKey], ambiguous: false }
    : classifyPokemonEntity(entity);
  if (classification.ambiguous || !classification.directory) throw new Error(`${entity.formId}: ENTITY_CLASSIFICATION_AMBIGUOUS`);
  const entityStem = canonicalStem(entity);
  if (domain === "pokemon") return `data/pokemon/${classification.directory}/${entityStem}.json`;
  if (domain === "pvp") return `data/pvp/pokemon/${classification.directory}/${entityStem}.pvp.json`;
  const suffix = { home: "home", shuffle: "shuffle", variants: "variants", "location-cards": "location-cards" }[family];
  if (family === "core") return `data/assets/core/${classification.directory}/${entityStem}.assets.json`;
  if (!suffix) throw new Error(`Famille inconnue : ${family}`);
  return `data/assets/${family}/${classification.directory}/${entityStem}.${suffix}.json`;
}

function resolveCanonicalReference(entity, { domain = null, family = null, category = null } = {}) {
  return resolveEntityPath({ domain: domain || (family === "pvp" ? "pvp" : "assets"), family, category, entity });
}

function categoryFromReference(reference) {
  const match = String(reference || "").replace(/\\/g, "/").match(/^data\/(?:pokemon|pvp\/pokemon|assets\/[^/]+)\/([^/]+)\//);
  return match ? DIRECTORY_CATEGORIES[match[1]] || null : null;
}

const classifyEntity = classifyPokemonEntity;
module.exports = { CATEGORY_DIRECTORIES, canonicalStem, categoryFromReference, classifyEntity, classifyPokemonEntity, resolveCanonicalReference, resolveEntityPath };
