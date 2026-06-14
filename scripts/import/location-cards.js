const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const rootDir = path.resolve(__dirname, "../..");
const pokemonDir = path.join(rootDir, "data", "pokemon");
const cardsDir = path.join(rootDir, "asset", "LocationCards");
const reportFile = path.join(rootDir, "data", "location-cards-import-report.json");
const source = "https://www.serebii.net/pokemongo/backgrounds.shtml";
const imageBase =
  "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/LocationCards";

const replacements = new Map([
  ["airadv", "air adventures"],
  ["air adv", "air adventures"],
  ["gowa", "go wild area"],
  ["gofest", "go fest"],
  ["gotour", "go tour"],
  ["wcs", "pokemon world championships"],
  ["world championship", "pokemon world championships"],
  ["newyork", "new york"],
  ["jerseycity", "jersey city"],
  ["losangeles", "los angeles"],
  ["newtaipeicity", "new taipei city"],
  ["saopaulo", "sao paulo"],
  ["buenosaires", "buenos aires"],
  ["carfreeday", "car free day"],
  ["chunichidragons", "chunichi dragons"],
  ["hiroshimacarp", "hiroshima carp"],
  ["hokkaidofighters", "hokkaido fighters"],
  ["hanshintigers", "hanshin tigers"],
  ["rakuteneagles", "rakuten eagles"],
  ["softbankhawks", "softbank hawks"],
  ["yomiurigiants", "yomiuri giants"],
  ["zozomarine", "zozo marine"],
  ["arizonadiamondbacks", "arizona diamondbacks"],
  ["baltimoreorioles", "baltimore orioles"],
  ["bostonredsox", "boston red sox"],
  ["chicagowhitesox", "chicago white sox"],
  ["clevelandguardians", "cleveland guardians"],
  ["milwaukeebrewers", "milwaukee brewers"],
  ["minnesotatwins", "minnesota twins"],
  ["newyorkmets", "new york mets"],
  ["sanfranciscogiants", "san francisco giants"],
  ["tampabayrays", "tampa bay rays"],
  ["texasrangers", "texas rangers"],
  ["washingtonnationals", "washington nationals"],
  ["cherryblossomfest", "cherry blossom festival"],
  ["cherry blossom fest", "spring blossom festival"],
  ["waterfestival", "water festival"],
  ["fireworksfestival", "fireworks festival"],
  ["flowerfestival", "flower festival"],
  ["amusementpark", "amusement park"],
  ["stamprally", "stamp rally"],
  ["stamp rally", "pokemon go at"],
  ["taipei flower festival", "taipei floral picnic"],
  ["festivalofcolors", "festival of colors"],
  ["talesoftransformation", "tales of transformation"],
  ["delightfuldays", "delightful days"],
  ["mightandmastery", "might and mastery"],
  ["dueldestiny", "dual destiny"],
]);

const overrides = {
  lc_2026_ppk_001: "PokéPark KANTO",
  lc_2026_NPB_yokohamaStadium: "Yokohama Baystars",
  lc_AirAdv2024_bali: "Air Adventures Bali",
  lc_AirAdv2024_jakarta: "Air Adventures Jakarta",
  lc_AirAdv2024_surabaya: "Air Adventures Surabaya",
  lc_AirAdv2024_yogyakarta: "Air Adventures Yogyakarta",
  lc_CherryBlossomFest2025_yeouido: "Spring Blossom Festival",
  lc_CitySafari2024_hongkong: "City Safari Hong Kong",
  lc_CitySafari2024_incheon: "Safari Zone Incheon",
  lc_JejuAirAdv2023: "Air Adventures Jeju Island",
  lc_MLB_arizonaDiamondbacks: "Arizona Diamond Backs",
  lc_MLB_chicagoWhitesox: "Chicago White Sox",
  lc_NFL_cardinals: "NFL Cardinals",
  lc_OsakaEvent2025_01: "Expo 2025 - Osaka",
  lc_OsakaEvent2025_02: "Expo 2025 - Osaka 2",
  lc_OsakaEvent2025_03: "Suita City",
  lc_Paris2025_01: "Mega Evolution Paris",
  lc_Paris2025_02: "Mega Evolution Paris 2",
  lc_TokMun_koto: "GO Fest Tokyo Koto",
  lc_TokMun_minato: "GO Fest Tokyo Minato",
  lc_TokMun_shinagawa: "GO Fest Tokyo Shinagawa",
  lc_nagasaki2025: "GO Wild Area Nagasaki",
  lc_roadtrip2025_berlin: "Road Trip 2025 Berlin",
  lc_roadtrip2025_cologne: "Road Trip 2025 Cologne",
  lc_roadtrip2025_hague: "Road Trip 2025 The Hague",
  lc_roadtrip2025_london: "Road Trip 2025 London",
  lc_roadtrip2025_manchester: "Road Trip 2025 Manchester",
  lc_roadtrip2025_paris: "Road Trip 2025 Paris",
  lc_roadtrip2025_valencia: "Road Trip 2025 Valencia",
  lc_stampRally2025_Jeju: "Pokemon GO at Jeju Island",
  lc_taipeiAmusementPark_2025: "Taipei Children's Amusement Park",
  lc_taipeiFlowerFestival_2026: "Taipei Floral Picnic 2016",
  lc_pokopia2026: "Pokemon Pokopia",
  sb_2024_decemberCdRecap: "Community Day 2024",
  sb_Community_2026: "Community Day 2026",
  sb_Concierge2025: "Pokemon Concierge",
  sb_FestivalofColors_2026: "Festival of Colors",
  sb_GOWA_fukuoka: "GO Wild Area 2024",
  sb_GOWA2025_Global: "GO Wild Area 2025",
  sb_GoFest2024_wormhole_moon: "GO Fest 2024 Wormhole Umbra",
  sb_GoFest2024_wormhole_sun: "GO Fest 2024 Wormhole Radiance",
  sb_GoFest2025: "GO Fest 2025 Zamazenta",
  sb_GoFest2025_Eternatus: "Dark Skies",
  sb_GoTour2025_black: "GO Tour Unova Black",
  sb_GoTour2025_black_white: "GO Tour Unova Black White",
  sb_GoTour2025_enigma: "GO Tour Enigma",
  sb_GoTour2025_white: "GO Tour Unova White",
  sb_ObservatoryExhibitionTour: "Pokemon Astronomical Observatory",
  sb_Season17_DuelDestiny: "Dual Destiny",
  sb_Season18_MightAndMastery: "Might and Mastery",
  sb_Season19_DelightfulDays: "Delightful Days",
  sb_Season20_TalesOfTransformation: "Tales of Transformation",
  sb_TeamLeader_blue: "Team Mystic",
  sb_TeamLeader_red: "Team Valor",
  sb_TeamLeader_yellow: "Team Instinct",
};

function normalize(value) {
  let result = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/pokemon/gi, " pokemon ")
    .replace(/pokémon/gi, " pokemon ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .toLowerCase();
  for (const [from, to] of replacements) result = result.replaceAll(from, ` ${to} `);
  return result
    .replace(/\b(?:lc|sb|location|special|background|card|event)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter(Boolean));
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const shared = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  const coverage = shared / Math.min(a.size, b.size);
  const jaccard = shared / union;
  return coverage * 0.7 + jaccard * 0.3;
}

async function fetchPage() {
  const response = await fetch(source, {
    headers: { "user-agent": "PokemonGo-API location card importer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${source}`);
  return response.text();
}

function parseCards(html) {
  const $ = cheerio.load(html);
  const cards = [];
  $("table")
    .slice(1, 3)
    .each((tableIndex, table) => {
      const rows = $(table).find("tr").toArray();
      for (let rowIndex = 0; rowIndex < rows.length - 3; rowIndex += 4) {
        const nameCells = $(rows[rowIndex]).children("td.fooevo").toArray();
        const imageCells = $(rows[rowIndex + 1]).children("td").toArray();
        const dateCells = $(rows[rowIndex + 2]).children("td").toArray();
        const eligibleCells = $(rows[rowIndex + 3]).children("td.fooinfo").toArray();
        nameCells.forEach((cell, column) => {
          const name = $(cell).text().trim().replace(/\s+/g, " ");
          if (!name) return;
          const eligiblePokemon = $(eligibleCells[column])
            .find('a[href*="/pokemongo/pokemon/"]')
            .map((_, link) => {
              const match = ($(link).attr("href") || "").match(/\/(\d+)\.shtml$/);
              return match
                ? {
                    dexNr: Number(match[1]),
                    form: $(link).text().trim().replace(/\s+/g, " "),
                  }
                : null;
            })
            .get()
            .filter(Boolean);
          cards.push({
            name,
            type: tableIndex === 0 ? "location" : "special",
            date: $(dateCells[column]).text().trim().replace(/\s+/g, " "),
            serebiiImage: $(imageCells[column]).find("img").attr("src") || null,
            eligiblePokemon,
            eligibleDexNumbers: [...new Set(eligiblePokemon.map(({ dexNr }) => dexNr))],
          });
        });
      }
    });
  return cards;
}

function matchFile(file, cards) {
  const id = path.basename(file, ".png");
  const type = id.startsWith("sb_") ? "special" : "location";
  const candidates = cards.filter((card) => card.type === type);
  if (overrides[id]) {
    const exact = cards.find((card) => normalize(card.name) === normalize(overrides[id]));
    return exact ? { card: exact, score: 1, method: "override" } : null;
  }
  const ranked = candidates
    .map((card) => ({
      card,
      score: Math.max(similarity(id, card.name), similarity(id, card.serebiiImage)),
    }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  if (
    !best ||
    best.score < 0.68 ||
    (best.score < 0.86 && best.score - second.score < 0.045)
  )
    return null;
  return { ...best, method: "automatic" };
}

function orderedAssets(assets, locationCards) {
  const result = {};
  for (const [key, value] of Object.entries(assets || {})) {
    if (key !== "locationCards") result[key] = value;
  }
  result.locationCards = locationCards;
  return result;
}

async function main() {
  const write = process.argv.includes("--write");
  const html = await fetchPage();
  const cards = parseCards(html);
  const files = fs.readdirSync(cardsDir).filter((file) => file.endsWith(".png")).sort();
  const matched = [];
  const unmatched = [];

  for (const file of files) {
    const result = matchFile(file, cards);
    if (!result) {
      unmatched.push(file);
      continue;
    }
    matched.push({
      id: path.basename(file, ".png"),
      file,
      image: `${imageBase}/${encodeURIComponent(file)}`,
      ...result,
    });
  }

  const byDex = new Map();
  for (const match of matched) {
    for (const dexNr of match.card.eligibleDexNumbers) {
      if (!byDex.has(dexNr)) byDex.set(dexNr, []);
      const eligibleForms = [
        ...new Set(
          match.card.eligiblePokemon
            .filter((pokemon) => pokemon.dexNr === dexNr)
            .map((pokemon) => pokemon.form),
        ),
      ];
      byDex.get(dexNr).push({
        id: match.id,
        name: match.card.name,
        type: match.card.type,
        date: match.card.date,
        eligibleForms,
        image: match.image,
        source,
      });
    }
  }

  let changedPokemon = 0;
  for (const file of fs.readdirSync(pokemonDir).filter((entry) => entry.endsWith(".json"))) {
    const fullPath = path.join(pokemonDir, file);
    const pokemon = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const locationCards = (byDex.get(pokemon.dexNr) || []).sort(
      (left, right) => left.type.localeCompare(right.type) || left.name.localeCompare(right.name),
    );
    if (!locationCards.length) continue;
    const next = { ...pokemon, assets: orderedAssets(pokemon.assets, locationCards) };
    if (JSON.stringify(next) === JSON.stringify(pokemon)) continue;
    changedPokemon += 1;
    if (write) fs.writeFileSync(fullPath, `${JSON.stringify(next, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    write,
    serebiiCards: cards.length,
    localFiles: files.length,
    matchedFiles: matched.length,
    unmatchedFiles: unmatched,
    changedPokemon,
    matches: matched.map(({ id, file, card, score, method }) => ({
      id,
      file,
      name: card.name,
      type: card.type,
      date: card.date,
      eligibleDexNumbers: card.eligibleDexNumbers,
      eligiblePokemon: card.eligiblePokemon,
      score: Number(score.toFixed(3)),
      method,
    })),
    availableCards: cards.map(({ name, type, date, serebiiImage, eligibleDexNumbers }) => ({
      name,
      type,
      date,
      serebiiImage,
      eligibleDexNumbers,
    })),
  };
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `${write ? "Écriture" : "Simulation"}: ${matched.length}/${files.length} cartes associées, ` +
      `${changedPokemon} Pokémon ${write ? "modifiés" : "à modifier"}, ${unmatched.length} non associées.`,
  );
  if (unmatched.length) console.log(`Non associées:\n${unmatched.join("\n")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
