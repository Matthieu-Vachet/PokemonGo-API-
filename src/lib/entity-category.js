const CATEGORY_DIRECTORIES = Object.freeze({
  NORMAL: "normal",
  FORM: "forms",
  MEGA: "mega",
  DYNAMAX: "dynamax",
  GIGANTAMAX: "gigantamax",
});

function token(value) { return String(value || "").trim().toUpperCase(); }
function sourceIsForm(sourceFile) { return String(sourceFile || "").replace(/\\/g, "/").replace(/^data\//, "").startsWith("pokemon-forms/"); }

function classifyEntity(entity, { sourceFile = null } = {}) {
  const form = token(entity.form).toLowerCase();
  const formId = token(entity.formId || entity.id);
  const baseFormId = token(entity.baseFormId || entity.id);
  const signals = [];
  if (["mega", "mega-x", "mega-y", "primal"].includes(form) || /_(?:MEGA(?:_[XY])?|PRIMAL)$/.test(formId)) signals.push("MEGA");
  if (form === "dynamax" || /_DYNAMAX$/.test(formId)) signals.push("DYNAMAX");
  if (form === "gigantamax" || /_GIGANTAMAX$/.test(formId)) signals.push("GIGANTAMAX");
  const unique = [...new Set(signals)];
  if (unique.length > 1) return { category: null, directory: null, ambiguous: true, signals: unique, diagnostic: "ENTITY_CLASSIFICATION_AMBIGUOUS" };
  const category = unique[0] || (formId !== baseFormId || sourceIsForm(sourceFile) ? "FORM" : "NORMAL");
  return { category, directory: CATEGORY_DIRECTORIES[category], ambiguous: false, signals: unique.length ? unique : [category] };
}

function stem(entity) {
  return `${entity.dexId}-${String(entity.formId || entity.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function resolveCanonicalReference(entity, { family, sourceFile = null } = {}) {
  const classification = classifyEntity(entity, { sourceFile });
  if (classification.ambiguous) throw new Error(`${entity.formId}: ENTITY_CLASSIFICATION_AMBIGUOUS`);
  if (family === "pvp") return `pvp/pokemon/${classification.directory}/${stem(entity)}.pvp.json`;
  if (family === "core") return `pokemon-assets/core/${classification.directory}/${stem(entity)}.assets.json`;
  const suffix = { home: "home", shuffle: "shuffle", variants: "variants", "location-cards": "location-cards" }[family];
  if (!suffix) throw new Error(`Famille inconnue : ${family}`);
  return `pokemon-assets/${family}/${classification.directory}/${stem(entity)}.${suffix}.json`;
}

function categoryFromReference(reference) {
  const directory = String(reference || "").replace(/\\/g, "/").split("/")[2];
  return Object.entries(CATEGORY_DIRECTORIES).find(([, value]) => value === directory)?.[0] || null;
}

module.exports = { CATEGORY_DIRECTORIES, categoryFromReference, classifyEntity, resolveCanonicalReference };
