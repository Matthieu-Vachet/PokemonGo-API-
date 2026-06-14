const aliases = new Map(
  Object.entries({
    sunny: "sunny",
    clear: "sunny",
    partlycloudy: "partlyCloudy",
    partycloudy: "partlyCloudy",
    cloudy: "cloudy",
    rain: "rain",
    rainy: "rain",
    snow: "snow",
    snowy: "snow",
    windy: "windy",
    fog: "fog",
    foggy: "fog",
  }),
);

function normalizeWeatherId(value) {
  const key = String(value || "")
    .trim()
    .replace(/[-_\s]/g, "")
    .toLowerCase();
  return aliases.get(key) || String(value || "").trim();
}

module.exports = { normalizeWeatherId };
