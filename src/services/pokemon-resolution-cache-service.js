let revision = 0;
const invalidators = new Set();

function pokemonResolutionRevision() {
  return revision;
}

function registerPokemonResolutionInvalidator(invalidator) {
  if (typeof invalidator !== "function") throw new TypeError("Un invalidateur de cache doit être une fonction.");
  invalidators.add(invalidator);
  return () => invalidators.delete(invalidator);
}

function invalidatePokemonResolutionCaches(reason = "identity-mutation") {
  revision += 1;
  for (const invalidate of invalidators) invalidate({ revision, reason });
  return revision;
}

module.exports = {
  invalidatePokemonResolutionCaches,
  pokemonResolutionRevision,
  registerPokemonResolutionInvalidator,
};
