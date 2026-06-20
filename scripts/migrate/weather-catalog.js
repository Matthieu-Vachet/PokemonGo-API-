const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");

const write = process.argv.includes("--write");
const typesDir = dataPath("types");
const typesIndex = path.join(typesDir, "types.json");
const weatherDir = dataPath("weather");
const weatherIndex = path.join(weatherDir, "weather.json");
const remoteBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/weather";
const weatherFiles = {
  sunny: "1.png",
  rain: "2.png",
  partlyCloudy: "3.png",
  cloudy: "4.png",
  windy: "5.png",
  snow: "6.png",
  fog: "7.png",
};

function read(file, fallback = null) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const types = read(typesIndex, []);
const existingWeather = new Map(
  read(weatherIndex, []).map((weather) => [weather.id, weather]),
);
for (const type of types) {
  if (type.weatherBoost && typeof type.weatherBoost === "object")
    existingWeather.set(type.weatherBoost.id, type.weatherBoost);
}

const weather = Object.entries(weatherFiles).map(([id, filename]) => {
  const source = existingWeather.get(id) || {};
  return {
    id,
    slug: id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
    names: source.names || {},
    assets: {
      icon: `${remoteBase}/${filename}`,
    },
    boostedTypes: types
      .filter((type) => (type.weatherBoost?.id || type.weatherBoost) === id)
      .map((type) => type.id),
    assetName: source.assetName || id,
  };
});

const changed = [];
for (const type of types) {
  const next = {
    ...type,
    weatherBoost: type.weatherBoost?.id || type.weatherBoost,
  };
  const file = path.join(typesDir, `${type.slug}.json`);
  if (!same(read(file), next)) {
    changed.push(relativeToApp(file));
    if (write) writeJson(file, next);
  }
}

const nextTypes = types.map((type) => ({
  ...type,
  weatherBoost: type.weatherBoost?.id || type.weatherBoost,
}));
if (!same(types, nextTypes)) {
  changed.push(relativeToApp(typesIndex));
  if (write) writeJson(typesIndex, nextTypes);
}

for (const entry of weather) {
  const file = path.join(weatherDir, `${entry.slug}.json`);
  if (!same(read(file), entry)) {
    changed.push(relativeToApp(file));
    if (write) writeJson(file, entry);
  }
}
if (!same(read(weatherIndex), weather)) {
  changed.push(relativeToApp(weatherIndex));
  if (write) writeJson(weatherIndex, weather);
}

console.log(
  JSON.stringify(
    {
      mode: write ? "write" : "dry-run",
      weather: weather.length,
      types: types.length,
      changedFiles: changed.length,
      changed,
    },
    null,
    2,
  ),
);
