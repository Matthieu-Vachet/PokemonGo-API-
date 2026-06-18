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
