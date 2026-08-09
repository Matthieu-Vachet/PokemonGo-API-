const MOVE_FIELDS = [
  "quickMoves",
  "cinematicMoves",
  "eliteQuickMoves",
  "eliteCinematicMoves",
  "legacyQuickMoves",
  "legacyCinematicMoves",
];

function moveIds(value) {
  if (Array.isArray(value)) {
    return value
      .map((move) => (typeof move === "string" ? move : move?.id))
      .filter(Boolean);
  }
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function normalizedPokemonData(data) {
  if (!data || typeof data !== "object") return data;
  const normalized = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      MOVE_FIELDS.includes(key) ? moveIds(value) : value,
    ]),
  );
  if (normalized.maxBattle) {
    normalized.maxBattle = {
      ...normalized.maxBattle,
      moves: moveIds(normalized.maxBattle.moves),
    };
  }
  return normalized;
}

function presentPokemon(document) {
  if (!document || typeof document !== "object") return document;
  return {
    ...document,
    data: normalizedPokemonData(document.data),
  };
}

function presentPokemonList(documents) {
  return documents.map(presentPokemon);
}

module.exports = {
  moveIds,
  normalizedPokemonData,
  presentPokemon,
  presentPokemonList,
};
