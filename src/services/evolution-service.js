const { Pokemon } = require("../models");
const { findPokemon } = require("./pokemon-service");

function evolutionIds(pokemon) {
  return (pokemon.data?.evolutions || [])
    .map((evolution) => evolution.targetFormId || evolution.formId || evolution.id)
    .filter(Boolean);
}

function previousEvolutionFilter(pokemon) {
  return {
    $or: [
      { "data.evolutions.targetFormId": pokemon.formId },
      { "data.evolutions.formId": pokemon.formId },
      { "data.evolutions.id": pokemon.id },
    ],
  };
}

async function directEvolutions(identifier) {
  const pokemon = await findPokemon(identifier);
  const ids = evolutionIds(pokemon);
  const evolutions = ids.length
    ? await Pokemon.find({ $or: [{ formId: { $in: ids } }, { id: { $in: ids } }] }).lean()
    : [];
  const previous = await Pokemon.find(previousEvolutionFilter(pokemon)).lean();
  return { pokemon, previous, evolutions };
}

async function evolutionChain(identifier) {
  const start = await findPokemon(identifier);
  const visited = new Set();
  const nodes = [];
  const queue = [start];

  while (queue.length) {
    const current = queue.shift();
    if (!current || visited.has(current.key)) continue;
    visited.add(current.key);
    nodes.push(current);
    const ids = evolutionIds(current);
    const [next, previous] = await Promise.all([
      ids.length
        ? Pokemon.find({ $or: [{ formId: { $in: ids } }, { id: { $in: ids } }] }).lean()
        : [],
      Pokemon.find(previousEvolutionFilter(current)).lean(),
    ]);
    queue.push(...next, ...previous);
  }
  return nodes.sort((a, b) => a.dexNr - b.dexNr);
}

module.exports = { directEvolutions, evolutionChain };
