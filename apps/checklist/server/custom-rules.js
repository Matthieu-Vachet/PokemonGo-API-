const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { dataPath } = require("../../../src/lib/data-repository");

const rulesDir = dataPath("checklist");
const rulesFile = path.join(rulesDir, "custom-rules.json");
const allowedKinds = [
  "pokemon",
  "form",
  "mega",
  "dynamax",
  "gigantamax",
];
const allowedTypes = [
  "presence",
  "string",
  "number",
  "boolean",
  "object",
  "array",
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function actualType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function createError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function ensureStore() {
  if (!fs.existsSync(rulesDir)) fs.mkdirSync(rulesDir, { recursive: true });
  if (!fs.existsSync(rulesFile)) {
    fs.writeFileSync(
      rulesFile,
      `${JSON.stringify({ version: 1, updatedAt: null, rules: [] }, null, 2)}\n`,
    );
  }
}

function readStore() {
  ensureStore();
  const parsed = JSON.parse(fs.readFileSync(rulesFile, "utf8"));
  return {
    version: 1,
    updatedAt: parsed.updatedAt || null,
    rules: Array.isArray(parsed.rules) ? parsed.rules : [],
  };
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(rulesFile, `${JSON.stringify(store, null, 2)}\n`);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pathParts(pathName) {
  return String(pathName || "")
    .trim()
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);
}

function setNested(target, pathName, value) {
  const parts = pathParts(pathName);
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (actualType(cursor[part]) !== "object") cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function placeholderForType(type) {
  if (type === "presence") return null;
  if (type === "string") return "";
  if (type === "number") return 0;
  if (type === "boolean") return false;
  if (type === "object") return {};
  if (type === "array") return [];
  throw createError(`Type non supporté: ${type}`);
}

function expectedLabel(template) {
  const type = actualType(template);
  if (template === null) return "clé présente";
  if (type === "object") return "objet";
  if (type === "array") {
    if (template.length === 1) return `tableau de ${expectedLabel(template[0])}`;
    return "tableau";
  }
  return type;
}

function normalizeAppliesTo(appliesTo) {
  const values = Array.isArray(appliesTo)
    ? appliesTo
    : typeof appliesTo === "string" && appliesTo.trim()
      ? [appliesTo.trim()]
      : [];
  const normalized = [...new Set(values.filter((value) => allowedKinds.includes(value)))];
  return normalized.length ? normalized : [...allowedKinds];
}

function parseTemplateSource(source) {
  const text = String(source || "").trim();
  if (!text) throw createError("Le modèle de règle est vide.");
  const candidates = [];
  if (text.startsWith("{") || text.startsWith("[")) candidates.push(text);
  else candidates.push(`{${text}}`);
  if (!candidates.includes(text)) candidates.push(text);

  for (const candidate of candidates) {
    try {
      return clone(JSON.parse(candidate));
    } catch {}
  }

  for (const candidate of candidates) {
    try {
      const parsed = vm.runInNewContext(
        `(${candidate})`,
        Object.create(null),
        { timeout: 250 },
      );
      if (parsed === undefined || typeof parsed === "function")
        throw createError("Le modèle doit produire un objet JSON simple.");
      return clone(parsed);
    } catch {}
  }

  throw createError(
    "Impossible de lire le modèle. Utilise un objet JSON ou un bloc du style description: { fr: \"\", en: \"\" }.",
  );
}

function parseTemplateInput(input) {
  if (actualType(input) === "object" || Array.isArray(input)) return clone(input);
  return parseTemplateSource(input);
}

function buildTemplateFromPath(pathName, expectedType) {
  const parts = pathParts(pathName);
  if (!parts.length) throw createError("Le chemin de clé est obligatoire.");
  const template = {};
  setNested(template, parts.join("."), placeholderForType(expectedType));
  return template;
}

function buildRuleId(name, pathName, existingId = "") {
  if (String(existingId || "").trim()) return String(existingId).trim();
  const base = slugify(name) || slugify(pathName) || "regle-checklist";
  return `${base}-${Date.now()}`;
}

function normalizeRuleInput(input, previous = null) {
  const templateSource = String(input.templateSource || "").trim();
  const pathName = String(input.path || "").trim();
  const now = new Date().toISOString();

  let mode = "path";
  let template;
  let expectedType = "presence";

  if (actualType(input.template) === "object" || Array.isArray(input.template) || templateSource) {
    mode = "template";
    template = parseTemplateInput(input.template ?? templateSource);
    if (actualType(template) !== "object")
      throw createError("Le modèle complet doit être un objet à la racine.");
  } else {
    expectedType = String(input.expectedType || "presence").trim();
    if (!allowedTypes.includes(expectedType))
      throw createError(
        `Type attendu invalide. Choisis parmi: ${allowedTypes.join(", ")}`,
      );
    template = buildTemplateFromPath(pathName, expectedType);
  }

  const name =
    String(input.name || "").trim() ||
    (mode === "path" ? pathName : Object.keys(template).join(", ")) ||
    "Règle checklist";
  if (!name) throw createError("Le nom de la règle est obligatoire.");

  return {
    id: buildRuleId(name, pathName, previous?.id || input.id),
    name,
    enabled: input.enabled !== false,
    appliesTo: normalizeAppliesTo(input.appliesTo),
    mode,
    path: mode === "path" ? pathName : null,
    expectedType: mode === "path" ? expectedType : null,
    enforceNonEmpty: Boolean(input.enforceNonEmpty),
    template,
    templateSource:
      mode === "template" && templateSource
        ? templateSource
        : JSON.stringify(template, null, 2),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };
}

function listCustomRules() {
  return readStore().rules.map((rule) => clone(rule));
}

function enabledCustomRules() {
  return listCustomRules().filter((rule) => rule.enabled !== false);
}

function previewCustomRule(input) {
  return normalizeRuleInput(input);
}

function saveCustomRule(input) {
  const store = readStore();
  const index = store.rules.findIndex((rule) => rule.id === input.id);
  const previous = index >= 0 ? store.rules[index] : null;
  const normalized = normalizeRuleInput(input, previous);
  if (index >= 0) store.rules[index] = normalized;
  else store.rules.unshift(normalized);
  store.updatedAt = normalized.updatedAt;
  writeStore(store);
  return normalized;
}

function toggleCustomRule({ id, enabled }) {
  const store = readStore();
  const index = store.rules.findIndex((rule) => rule.id === id);
  if (index < 0) throw createError("Règle introuvable.");
  store.rules[index] = {
    ...store.rules[index],
    enabled: enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  store.updatedAt = store.rules[index].updatedAt;
  writeStore(store);
  return clone(store.rules[index]);
}

function deleteCustomRule({ id }) {
  const store = readStore();
  const index = store.rules.findIndex((rule) => rule.id === id);
  if (index < 0) throw createError("Règle introuvable.");
  const [removed] = store.rules.splice(index, 1);
  store.updatedAt = new Date().toISOString();
  writeStore(store);
  return clone(removed);
}

function addRuleIssue(addIssue, rule, pathName, issue, expected, actual, suggested) {
  addIssue(pathName, issue, expected, actual, {
    category: "custom",
    ruleId: rule.id,
    ruleName: rule.name,
    suggested: clone(suggested),
  });
}

function validateNode(value, template, pathName, rule, addIssue) {
  const expected = expectedLabel(template);
  const currentType = actualType(value);

  if (template === null) {
    if (value === undefined)
      addRuleIssue(addIssue, rule, pathName, "missing", expected, "absent", null);
    return;
  }

  if (Array.isArray(template)) {
    if (value === undefined) {
      addRuleIssue(addIssue, rule, pathName, "missing", expected, "absent", template);
      return;
    }
    if (!Array.isArray(value)) {
      addRuleIssue(addIssue, rule, pathName, "type", expected, currentType, template);
      return;
    }
    if (rule.enforceNonEmpty && value.length === 0) {
      addRuleIssue(addIssue, rule, pathName, "empty", "tableau non vide", "vide", template);
    }
    if (template.length === 1) {
      value.forEach((item, index) =>
        validateNode(item, template[0], `${pathName}[${index}]`, rule, addIssue),
      );
    }
    return;
  }

  if (actualType(template) === "object") {
    if (value === undefined) {
      addRuleIssue(addIssue, rule, pathName, "missing", expected, "absent", template);
      return;
    }
    if (actualType(value) !== "object") {
      addRuleIssue(addIssue, rule, pathName, "type", expected, currentType, template);
      return;
    }
    if (rule.enforceNonEmpty && Object.keys(value).length === 0) {
      addRuleIssue(addIssue, rule, pathName, "empty", "objet non vide", "vide", template);
    }
    for (const [key, childTemplate] of Object.entries(template)) {
      const childPath = pathName ? `${pathName}.${key}` : key;
      validateNode(value?.[key], childTemplate, childPath, rule, addIssue);
    }
    return;
  }

  if (value === undefined) {
    addRuleIssue(addIssue, rule, pathName, "missing", expected, "absent", template);
    return;
  }
  if (currentType !== actualType(template)) {
    addRuleIssue(addIssue, rule, pathName, "type", expected, currentType, template);
    return;
  }
  if (
    rule.enforceNonEmpty &&
    typeof value === "string" &&
    value.trim() === ""
  ) {
    addRuleIssue(addIssue, rule, pathName, "empty", "string non vide", "vide", template);
  }
}

function appliesToKind(rule, kind) {
  return Array.isArray(rule.appliesTo) && rule.appliesTo.includes(kind);
}

function applyCustomRules(data, kind, addIssue, rules = enabledCustomRules()) {
  for (const rule of rules) {
    if (rule.enabled === false || !appliesToKind(rule, kind)) continue;
    for (const [key, template] of Object.entries(rule.template || {}))
      validateNode(data?.[key], template, key, rule, addIssue);
  }
}

module.exports = {
  allowedKinds,
  allowedTypes,
  applyCustomRules,
  deleteCustomRule,
  enabledCustomRules,
  listCustomRules,
  previewCustomRule,
  rulesFile,
  saveCustomRule,
  toggleCustomRule,
};
