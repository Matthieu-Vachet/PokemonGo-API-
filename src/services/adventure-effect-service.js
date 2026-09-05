const fs = require("node:fs");
const path = require("node:path");
const { ApiError } = require("../lib/api-error");
const { dataRoot } = require("../lib/data-repository");
const adventureEffectGenerator = require("../../runtime-data/PokemonGo-Data/tooling/scripts/generators/generateAdventureEffects.js");

const EFFECTS_ROOT = path.join(dataRoot, "data", "adventure-effects", "effects");
const LOCALES = new Set(["en", "de", "es", "pt", "fr", "nl"]);

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

function listFiles(directory) {
  return fs.readdirSync(directory).filter((file) => file.endsWith(".adventure-effect.json")).sort().map((file) => path.join(directory, file));
}

function effectsCatalog() {
  return listFiles(EFFECTS_ROOT).map(readJson).sort((left, right) => left.id.localeCompare(right.id));
}

function moveFile(moveRef) {
  const root = path.join(dataRoot, "data", "moves");
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name, `${moveRef}.json`);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function normalizeLocale(value) {
  const locale = String(value || "en").trim().toLowerCase().split(/[-_]/)[0];
  if (!LOCALES.has(locale)) throw new ApiError(400, `Locale non supportée : ${value}`, "ADVENTURE_EFFECT_LOCALE_INVALID", { supportedLocales: [...LOCALES] });
  return locale;
}

function localized(effect, requestedLocale) {
  const requested = normalizeLocale(requestedLocale);
  const requestedValue = effect.localization[requested];
  const resolved = requestedValue?.description ? requested : "en";
  return {
    requestedLocale: requested,
    resolvedLocale: resolved,
    fallbackUsed: resolved !== requested,
    ...(effect.localization[resolved] || effect.localization.en),
  };
}

function hydrate(effect, locale = "en") {
  const file = moveFile(effect.moveRef);
  return {
    ...effect,
    localized: localized(effect, locale),
    move: file ? readJson(file) : null,
    pokemon: effect.pokemonRefs.map((reference) => readJson(path.join(dataRoot, reference.pokemonRef))),
  };
}

function validateIdentifier(value) {
  const identifier = String(value || "").trim();
  if (!identifier || !/^[a-zA-Z0-9_-]+$/.test(identifier)) throw new ApiError(400, "Identifiant Adventure Effect invalide.", "ADVENTURE_EFFECT_ID_INVALID");
  return identifier;
}

function findEffect(identifier) {
  const value = validateIdentifier(identifier);
  const upper = value.toUpperCase();
  const slug = value.toLowerCase().replace(/_/g, "-");
  const effect = effectsCatalog().find((entry) => entry.id === upper || entry.slug === slug);
  if (!effect) throw new ApiError(404, `Effet d’aventure introuvable : ${value}`, "ADVENTURE_EFFECT_NOT_FOUND");
  return effect;
}

function listEffects(query = {}) {
  const locale = normalizeLocale(query.locale || "en");
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 25));
  const type = String(query.type || "").toUpperCase();
  const moveRef = String(query.moveRef || "").toUpperCase();
  const pokemonId = String(query.pokemonId || "").toUpperCase();
  const formId = String(query.formId || "").toUpperCase();
  const search = String(query.q || "").trim().toLocaleLowerCase(locale);
  const filtered = effectsCatalog().filter((effect) => {
    if (type && effect.effectType !== type) return false;
    if (moveRef && effect.moveRef !== moveRef) return false;
    if (pokemonId && !effect.pokemonRefs.some((ref) => ref.pokemonId === pokemonId)) return false;
    if (formId && !effect.pokemonRefs.some((ref) => ref.formId === formId)) return false;
    if (search && ![effect.id, effect.slug, effect.moveRef, ...Object.values(effect.localization).map((item) => item.name)].join(" ").toLocaleLowerCase(locale).includes(search)) return false;
    return true;
  });
  return { items: filtered.slice((page - 1) * limit, page * limit).map((effect) => hydrate(effect, locale)), total: filtered.length, page, limit, locale };
}

function effectsForPokemon(identifier, query = {}) {
  const value = validateIdentifier(identifier);
  const upper = value.toUpperCase().replace(/-/g, "_");
  const slug = value.toLowerCase();
  const formId = String(query.formId || "").toUpperCase();
  const matches = effectsCatalog().filter((effect) => effect.pokemonRefs.some((reference) => {
    const pokemon = readJson(path.join(dataRoot, reference.pokemonRef));
    const identityMatch = [reference.pokemonId, reference.formId, pokemon.id, pokemon.formId].includes(upper) || pokemon.slug === slug || String(pokemon.dexNr) === value;
    return identityMatch && (!formId || reference.formId === formId);
  }));
  return matches.map((effect) => hydrate(effect, query.locale || "en"));
}

function effectForMove(identifier, query = {}) {
  const value = validateIdentifier(identifier);
  const upper = value.toUpperCase().replace(/-/g, "_");
  const slug = value.toLowerCase();
  const effect = effectsCatalog().find((entry) => entry.moveRef === upper || entry.moveRef.toLowerCase().replace(/_/g, "-") === slug);
  if (!effect) throw new ApiError(404, `Aucun Effet d’aventure pour l’attaque : ${value}`, "MOVE_ADVENTURE_EFFECT_NOT_FOUND");
  return hydrate(effect, query.locale || "en");
}

async function synchronizeAdventureEffects() {
  const report = await adventureEffectGenerator.run({ write: false, check: false, offline: false, rootDir: dataRoot });
  return {
    status: report.status,
    summary: `${report.effectsMapped}/${report.effectsFound} effets mappés · ${report.added.length} ajout(s) · ${report.modified.length} modification(s) · ${report.removed.length} suppression(s)`,
    report,
  };
}

module.exports = { effectForMove, effectsCatalog, effectsForPokemon, findEffect, hydrate, listEffects, normalizeLocale, synchronizeAdventureEffects };
