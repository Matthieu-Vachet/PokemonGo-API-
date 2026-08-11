const fs = require("fs");
const path = require("path");
const { appRoot: rootDir, dataPath, dataPathFromRelative, relativeToApp } = require("../../src/lib/data-repository");
const cheerio = require("cheerio");

const pokemonDir = dataPath("data", "pokemon", "normal");
const reportFile = dataPath("operations", "reports", "imports", "shadow-pokemon-import-report.json");
const source =
  "https://bulbapedia.bulbagarden.net/wiki/List_of_Shadow_Pok%C3%A9mon_in_Pok%C3%A9mon_GO";
const today = new Date("2026-06-14T23:59:59Z");

async function fetchPage() {
  const response = await fetch(source, {
    headers: { "user-agent": "PokemonGo-API Shadow importer" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${source}`);
  return response.text();
}

function range(value) {
  const numbers = String(value).match(/\d+/g)?.map(Number) || [];
  return numbers.length >= 2 ? { min: numbers[0], max: numbers[1] } : null;
}

function isoDate(value) {
  const parsed = new Date(`${value} 12:00:00 UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function variantId(cell, dexId) {
  const image = cell.find("img").first().attr("src") || "";
  const match = image.match(new RegExp(`GO${dexId}([^./]*)\\.png`, "i"));
  return match?.[1] || "normal";
}

function parseRows(html) {
  const $ = cheerio.load(html);
  const rows = [];
  $("table")
    .eq(1)
    .find("tr")
    .slice(1)
    .each((_, row) => {
      const cells = $(row).children("td");
      if (cells.length < 6) return;
      const dexId = $(cells[0]).text().trim();
      const releaseDateText = $(cells[5]).text().trim().replace(/\s+/g, " ");
      const releaseDate = isoDate(releaseDateText);
      const catchCpCell = $(cells[3]);
      const normal = range(catchCpCell.clone().find("i").remove().end().text());
      const weatherBoosted = range(catchCpCell.find("i").text());
      const costs = $(cells[4]).text().match(/[\d,]+/g)?.map((value) => Number(value.replaceAll(",", ""))) || [];
      rows.push({
        dexNr: Number(dexId),
        dexId,
        name: $(cells[2]).text().trim().replace(/\s+/g, " "),
        variant: variantId($(cells[1]), dexId),
        catchCp: { normal, weatherBoosted },
        purificationCost: {
          stardust: costs[0] ?? null,
          candy: costs[1] ?? null,
        },
        releaseDate,
        releaseDateText,
        released: Boolean(releaseDate && new Date(`${releaseDate}T23:59:59Z`) <= today),
      });
    });
  return rows;
}

function orderedPokemon(pokemon, shadow) {
  const result = {};
  for (const [key, value] of Object.entries(pokemon)) {
    if (key === "shadow") continue;
    if (key === "stats" && shadow) result.shadow = shadow;
    result[key] = value;
  }
  if (!("stats" in pokemon) && shadow) result.shadow = shadow;
  return result;
}

async function main() {
  const write = process.argv.includes("--write");
  const rows = parseRows(await fetchPage());
  const releasedRows = rows.filter((row) => row.released);
  const futureRows = rows.filter((row) => row.releaseDate && !row.released);
  const unknownDateRows = rows.filter((row) => !row.releaseDate);
  const byDex = new Map();
  for (const row of releasedRows) {
    if (!byDex.has(row.dexNr)) byDex.set(row.dexNr, []);
    byDex.get(row.dexNr).push(row);
  }

  let changedPokemon = 0;
  const shadowEnabled = [];
  const shadowDisabled = [];
  for (const file of fs.readdirSync(pokemonDir).filter((entry) => entry.endsWith(".json"))) {
    const fullPath = path.join(pokemonDir, file);
    const pokemon = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const variants = byDex.get(pokemon.dexNr) || [];
    const isShadowReleased = variants.length > 0;
    const previous = pokemon.availability?.shadow === true;
    if (isShadowReleased && !previous) shadowEnabled.push(file);
    if (!isShadowReleased && previous) shadowDisabled.push(file);
    const availability = {
      ...(pokemon.availability || {}),
      shadow: isShadowReleased,
    };
    const shadow = isShadowReleased
      ? {
          released: true,
          firstReleaseDate: variants
            .map((variant) => variant.releaseDate)
            .sort()[0],
          purificationCost: variants[0].purificationCost,
          catchCp: variants[0].catchCp,
          variants: variants.map(({ released, dexNr, dexId, ...variant }) => variant),
          source,
        }
      : null;
    const next = orderedPokemon({ ...pokemon, availability }, shadow);
    if (JSON.stringify(next) === JSON.stringify(pokemon)) continue;
    changedPokemon += 1;
    if (write) fs.writeFileSync(fullPath, `${JSON.stringify(next, null, 2)}\n`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source,
    asOf: today.toISOString().slice(0, 10),
    write,
    sourceRows: rows.length,
    releasedRows: releasedRows.length,
    releasedDexNumbers: byDex.size,
    futureRows,
    unknownDateRows,
    shadowEnabled,
    shadowDisabled,
    changedPokemon,
  };
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `${write ? "Écriture" : "Simulation"}: ${byDex.size} numéros Pokédex Shadow sortis, ` +
      `${changedPokemon} fiches à modifier, +${shadowEnabled.length} / -${shadowDisabled.length}.`,
  );
  if (shadowEnabled.length) console.log(`À activer:\n${shadowEnabled.join("\n")}`);
  if (shadowDisabled.length) console.log(`À désactiver:\n${shadowDisabled.join("\n")}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
