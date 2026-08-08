function usableImage(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  if (/^https?:/i.test(normalized)) {
    try {
      const url = new URL(normalized);
      return url.hostname ? normalized : null;
    } catch {
      return null;
    }
  }
  if (/^data:/i.test(normalized))
    return /^data:image\//i.test(normalized) ? normalized : null;
  if (/^[a-z][a-z\d+.-]*:/i.test(normalized)) return null;
  return normalized;
}

function isMegaPokemon(document = {}) {
  const data = document.data || document;
  const form = String(document.form || data.form || data.formId || "").toUpperCase();
  return document.kind === "mega" || form.includes("MEGA") || form.includes("PRIMAL");
}

function firstImage(candidates) {
  for (const [value, source] of candidates) {
    const image = usableImage(value);
    if (image) return { image, source, status: "matched", reason: null };
  }
  return {
    image: null,
    source: "missing",
    status: "missing-asset",
    reason: "POKEMON_ASSET_NOT_FOUND",
  };
}

function resolvePreferredPokemonAsset(document = {}, options = {}) {
  const data = document.data || document;
  const assets = data.assets || {};
  const shiny = options.shiny === true;
  if (isMegaPokemon(document)) {
    return firstImage([
      [shiny ? assets.shinyImage : assets.image, "pokemon-go-mega"],
      [shiny ? assets.home?.shinyImage : assets.home?.image, "home-mega"],
      [shiny ? assets.portraitShiny : assets.portrait, "mega-fallback"],
    ]);
  }
  return firstImage([
    [shiny ? assets.portraitShiny : assets.portrait, "portrait-assets"],
    [shiny ? assets.home?.shinyImage : assets.home?.image, "home-assets"],
    [shiny ? assets.shinyImage : assets.image, "primary-assets"],
  ]);
}

module.exports = {
  isMegaPokemon,
  resolvePreferredPokemonAsset,
  usableImage,
};
