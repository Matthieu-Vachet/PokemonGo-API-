export const typeLabels = {
  BUG: "Insecte",
  DARK: "Ténèbres",
  DRAGON: "Dragon",
  ELECTRIC: "Électrik",
  FAIRY: "Fée",
  FIGHTING: "Combat",
  FIRE: "Feu",
  FLYING: "Vol",
  GHOST: "Spectre",
  GRASS: "Plante",
  GROUND: "Sol",
  ICE: "Glace",
  NORMAL: "Normal",
  POISON: "Poison",
  PSYCHIC: "Psy",
  ROCK: "Roche",
  STEEL: "Acier",
  WATER: "Eau",
};

export const typeColors = {
  BUG: "#91c12f",
  DARK: "#5a5465",
  DRAGON: "#0b6dc3",
  ELECTRIC: "#f4d23c",
  FAIRY: "#ec8fe6",
  FIGHTING: "#ce416b",
  FIRE: "#ff9d55",
  FLYING: "#89aae3",
  GHOST: "#5269ad",
  GRASS: "#63bc5a",
  GROUND: "#d97845",
  ICE: "#73cec0",
  NORMAL: "#919aa2",
  POISON: "#aa6bc8",
  PSYCHIC: "#fa7179",
  ROCK: "#c5b78c",
  STEEL: "#5a8ea2",
  WATER: "#5090d6",
};

export function catalogItem(items, id) {
  return (items || []).find((item) => item.id === id || item.type === id || item.slug === id);
}

export function typeName(type, catalog = []) {
  const item = catalogItem(catalog, type);
  return item?.names?.French || typeLabels[type] || type || "-";
}

export function typeIcon(type, catalog = []) {
  return catalogItem(catalog, type)?.assets?.icon || null;
}

export function typeBackground(type, catalog = []) {
  return catalogItem(catalog, type)?.assets?.background || null;
}

function firstImage(items = [], predicate = () => true) {
  const list = Array.isArray(items) ? items : [];
  return list.find((item) => predicate(item) && (item?.image || item?.shinyImage));
}

export function preferredPokemonImage(entry = {}, options = {}) {
  const kind = String(entry.kind || "").toLowerCase();
  const form = String(entry.form || "").toLowerCase();
  const preferShiny = Boolean(options.preferShiny);
  const shuffleVariants = Array.isArray(entry.assets?.shuffle?.variants)
    ? entry.assets.shuffle.variants
    : Array.isArray(entry.shuffleVariants)
      ? entry.shuffleVariants
      : [];
  const homeVariants = Array.isArray(entry.assets?.home?.variants)
    ? entry.assets.home.variants
    : Array.isArray(entry.homeVariants)
      ? entry.homeVariants
      : [];

  const matchingShuffle =
    firstImage(shuffleVariants, (asset) =>
      !asset?.shiny &&
      [asset.form, asset.state, ...(asset.tags || []), ...(asset.codes || [])]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .some((value) => value === form || value === kind),
    ) || firstImage(shuffleVariants, (asset) => !asset?.shiny) || firstImage(shuffleVariants);

  const matchingHome =
    firstImage(homeVariants, (asset) =>
      Boolean(kind === "gigantamax" ? asset?.gigantamax : true) &&
      [asset.detail, asset.view, asset.form, asset.genderCode]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase())
        .some((value) => value.includes(form) || value.includes(kind)),
    ) || firstImage(homeVariants);

  if (kind === "dynamax") return matchingShuffle?.image || entry.shuffleImage || entry.image || entry.homeImage || null;
  if (kind === "gigantamax")
    return matchingHome?.image || entry.homeImage || matchingShuffle?.image || entry.shuffleImage || entry.image || null;
  if (kind === "mega") return entry.homeImage || entry.image || matchingHome?.image || matchingShuffle?.image || null;
  if (kind === "form") return entry.image || matchingHome?.image || entry.homeImage || matchingShuffle?.image || null;

  return (
    (preferShiny ? entry.shinyImage : null) ||
    entry.image ||
    entry.homeImage ||
    matchingHome?.image ||
    matchingShuffle?.image ||
    null
  );
}

export function pokemonVariantLabel(entry = {}) {
  const kind = String(entry.kind || "").toLowerCase();
  const form = String(entry.form || "normal").toLowerCase();
  if (kind === "mega") return "Méga";
  if (kind === "dynamax") return "Dynamax";
  if (kind === "gigantamax") return "Gigamax";
  if (kind === "form" && form !== "normal") return form.charAt(0).toUpperCase() + form.slice(1);
  return "Normal";
}
