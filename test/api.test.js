const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { createApp } = require("../src/app");
const { normalizeLeague } = require("../src/lib/pvp");
const { normalizeWeatherId } = require("../src/lib/weather");
const { buildPokemonFilter } = require("../src/services/pokemon-service");
const { presentPokemon } = require("../src/services/pokemon-presenter");
const { collectAllDocuments } = require("../src/sync/source-reader");
const {
  buildSuggestedPatch,
  buildChecklist,
  detailForKey,
  validateSourceData,
} = require("../apps/checklist/server/engine");
const { catalog } = require("../apps/checklist/server/workshop");

const app = createApp();

test("GET / présente l'API", async () => {
  const response = await request(app).get("/").expect(200);
  assert.equal(response.body.data.name, "Pokémon GO API");
  assert.equal(response.body.data.api, "/api/v1");
});

test("GET /api/v1 présente les routes v1", async () => {
  const response = await request(app).get("/api/v1").expect(200);
  assert.equal(response.body.data.version, "v1");
  assert.match(response.body.data.routes.pokemon, /pokemon/);
});

test("GET /api-docs.json fournit OpenAPI 3", async () => {
  const response = await request(app).get("/api-docs.json").expect(200);
  assert.equal(response.body.openapi, "3.0.3");
  assert.ok(response.body.paths["/api/v1/pokemon"]);
  assert.ok(response.body.paths["/api/v1/pvp/{league}/{identifier}"]);
  assert.ok(response.body.paths["/api/v1/backgrounds"]);
  assert.ok(response.body.paths["/api/v1/backgrounds/{id}/pokemon"]);
  assert.ok(response.body.paths["/api/v1/pokemon/{identifier}/backgrounds"]);
  assert.ok(response.body.paths["/api/v1/shadow"]);
  assert.ok(response.body.paths["/api/v1/shadow/{identifier}"]);
  assert.ok(response.body.paths["/api/v1/pokemon/{identifier}/shadow"]);
  assert.ok(response.body.paths["/api/v1/stickers"]);
  assert.ok(response.body.paths["/api/v1/stickers/{id}"]);
  assert.ok(response.body.paths["/api/v1/weather"]);
  assert.ok(response.body.paths["/api/v1/weather/{identifier}"]);
});

test("GET /api/v1/stickers expose le catalogue des stickers", async () => {
  const list = await request(app).get("/api/v1/stickers?q=2023collab&limit=5").expect(200);
  assert.ok(list.body.data.length > 0);
  assert.ok(list.body.data.every((sticker) => sticker.image.includes("/Stickers/")));
  const detail = await request(app)
    .get("/api/v1/stickers/sticker-2023collab-1")
    .expect(200);
  assert.equal(detail.body.data.filename, "sticker_2023collab_1.png");
});

test("GET /api-docs fournit la documentation Redoc", async () => {
  const response = await request(app).get("/api-docs").expect(200);
  assert.match(response.headers["content-type"], /text\/html/);
  assert.match(response.text, /<redoc/);
  assert.match(response.text, /cdn\.redoc\.ly/);
  assert.match(response.text, /id="endpoint-tree"/);
  assert.match(response.text, /scrollToEndpoint/);
  assert.doesNotMatch(response.text, /native-scrollbars/);
  assert.doesNotMatch(response.text, /endpoint-jump/);
  assert.match(response.text, /endpoint-select/);
  assert.match(response.text, /redoc\/v2\.5\.0/);
});

test("GET /swagger fournit Swagger UI", async () => {
  const response = await request(app).get("/swagger/").expect(200);
  assert.match(response.text, /SwaggerUIBundle/);
  assert.match(response.text, /unpkg\.com\/swagger-ui-dist/);
});

test("GET /health indique un état dégradé sans MongoDB", async () => {
  const response = await request(app).get("/health").expect(503);
  assert.equal(response.body.data.status, "degraded");
});

test("une route inconnue retourne une erreur structurée", async () => {
  const response = await request(app).get("/inconnue").expect(404);
  assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
  assert.ok(response.body.error.requestId);
});

test("les sources JSON sont lisibles et dédupliquées", () => {
  const data = collectAllDocuments();
  assert.ok(data.pokemon.length >= 1000);
  assert.ok(data.moves.length >= 250);
  assert.equal(data.types.length, 18);
  assert.equal(data.weather.length, 7);
  assert.equal(new Set(data.pokemon.map((pokemon) => pokemon.key)).size, data.pokemon.length);
  assert.ok(data.pokemon.every((pokemon) => Array.isArray(pokemon.data.quickMoves)));
  const bulbasaur = data.pokemon.find((pokemon) => pokemon.key === "BULBASAUR");
  assert.equal(bulbasaur.data.assets.home.source, "pokemon-home");
  assert.ok(bulbasaur.data.assets.home.variants.length >= 1);
  const eevee = data.pokemon.find((pokemon) => pokemon.key === "EEVEE");
  const citySafari = eevee.data.assets.locationCards.find(
    (card) => card.id === "lc_CitySafari2023_barcelona_2023",
  );
  assert.equal(citySafari.date, "October 13th - 14th 2023");
  assert.deepEqual(citySafari.eligibleForms, ["Eevee (Explorer Hat)"]);
  assert.match(citySafari.image, /\/LocationCards\//);
  const bulbasaurShadow = bulbasaur.data.shadow;
  assert.equal(bulbasaurShadow.firstReleaseDate, "2019-07-22");
  assert.deepEqual(bulbasaurShadow.purificationCost, { stardust: 3000, candy: 3 });
  assert.deepEqual(bulbasaurShadow.catchCp.normal, { min: 198, max: 251 });
  assert.equal(bulbasaur.data.availability.shadow, true);
  const helioptile = data.pokemon.find((pokemon) => pokemon.key === "HELIOPTILE");
  assert.equal(helioptile.data.availability.shadow, true);
  const rookidee = data.pokemon.find((pokemon) => pokemon.key === "ROOKIDEE");
  assert.equal(rookidee.data.availability.shadow, false);
  assert.equal(rookidee.data.shadow, undefined);
});

test("les météos et leurs boosts de types sont normalisés", () => {
  const data = collectAllDocuments();
  const weatherByType = new Map(
    data.weather.flatMap((weather) =>
      weather.boostedTypes.map((type) => [type, weather.id]),
    ),
  );
  for (const pokemon of data.pokemon) {
    const expected = [
      ...new Set(pokemon.types.map((type) => weatherByType.get(type)).filter(Boolean)),
    ];
    assert.deepEqual(pokemon.weatherBoost, expected, pokemon.key);
  }
  assert.equal(normalizeWeatherId("rainy"), "rain");
  assert.equal(normalizeWeatherId("partyCloudy"), "partlyCloudy");
  assert.deepEqual(buildPokemonFilter({ weather: "partly-cloudy" }).weatherBoost, {
    $in: ["partlyCloudy"],
  });
});

test("les types, PvP null et formes Max sont normalisés", () => {
  const data = collectAllDocuments();
  const caterpie = data.pokemon.find((pokemon) => pokemon.key === "CATERPIE");
  const dynamax = data.pokemon.find((pokemon) => pokemon.key === "BULBASAUR_DYNAMAX");
  const toxtricity = data.pokemon.find(
    (pokemon) => pokemon.key === "TOXTRICITY_AMPED_DYNAMAX",
  );
  const urshifu = data.pokemon.find(
    (pokemon) => pokemon.key === "URSHIFU_RAPID_STRIKE_DYNAMAX",
  );
  const gmax = data.pokemon.find((pokemon) => pokemon.key === "VENUSAUR_GIGANTAMAX");
  assert.equal(caterpie.data.primaryType, "BUG");
  assert.equal(caterpie.data.secondaryType, null);
  assert.deepEqual(caterpie.pvpLeagues, []);
  assert.equal(dynamax.kind, "dynamax");
  assert.deepEqual(dynamax.maxMoveIds, ["MAX_OVERGROWTH", "MAX_STRIKE"]);
  assert.equal(dynamax.baseFormId, "BULBASAUR");
  assert.equal(dynamax.slug, "bulbasaur-dynamax");
  assert.deepEqual(Object.keys(dynamax.maxCp).sort(), [
    "maxBattlesLevel20",
    "maxLevel40",
    "maxLevel50",
  ]);
  assert.equal(dynamax.maxCp.raidLevel20, undefined);
  assert.deepEqual(dynamax.moveIds, []);
  assert.deepEqual(dynamax.pvpLeagues, []);
  assert.equal(data.pokemon.filter((pokemon) => pokemon.kind === "dynamax").length, 127);
  assert.equal(data.moves.filter((move) => move.kind === "max").length, 18);
  assert.equal(toxtricity.baseFormId, "TOXTRICITY_AMPED");
  assert.deepEqual(toxtricity.maxMoveIds, ["MAX_LIGHTNING", "MAX_OOZE"]);
  assert.equal(urshifu.baseFormId, "URSHIFU_RAPID_STRIKE");
  assert.deepEqual(urshifu.maxMoveIds, ["MAX_GEYSER", "MAX_KNUCKLE"]);
  assert.equal(gmax.kind, "gigantamax");
  assert.deepEqual(gmax.maxMoveIds, ["GMAX_VINE_LASH"]);
  assert.equal(gmax.baseFormId, "VENUSAUR");
  assert.equal(gmax.slug, "venusaur-gigantamax");
  assert.deepEqual(Object.keys(gmax.maxCp).sort(), [
    "maxBattlesLevel20",
    "maxLevel40",
    "maxLevel50",
  ]);
  assert.ok(data.moves.some((move) => move.kind === "max"));
  assert.ok(data.moves.some((move) => move.kind === "gmax"));
  assert.ok(
    data.moves.some(
      (move) =>
        move.id === "VINE_WHIP_FAST" &&
        move.slug === "vine-whip-fast" &&
        move.legacySlugs.includes("vine_whip_fast"),
    ),
  );
});

test("la checklist affiche les formes Max héritées sans dupliquer leur source", () => {
  const checklist = buildChecklist();
  const dynamax = checklist.find((entry) => entry.kind === "dynamax");
  assert.equal(dynamax.name, "Bulbizarre");
  assert.equal(dynamax.primaryType, "GRASS");
  assert.ok(dynamax.image);
  assert.equal(dynamax.maxMoveCount, 2);
  assert.equal(dynamax.complete, true);
  assert.equal(dynamax.quality.score, 100);
  assert.deepEqual(dynamax.issueCategories, []);
  assert.equal(typeof dynamax.assets.home, "boolean");

  const detail = detailForKey(dynamax.key);
  assert.equal(detail.names.French, "Bulbizarre");
  assert.equal(detail.sourceData.baseFormId, "BULBASAUR");
  assert.equal(detail.sourceData.slug, "bulbasaur-dynamax");
  assert.equal(detail.sourceData.inherits, undefined);
  assert.equal(detail.sourceData.evolutions[0].targetFormId, "IVYSAUR_DYNAMAX");
  assert.deepEqual(detail.maxCp, detail.sourceData.maxCp);
  assert.equal(detail.maxCp.raidLevel20, undefined);
  assert.deepEqual(detail.quickMoves, []);
  assert.deepEqual(detail.cinematicMoves, []);
  assert.equal(detail.pvp, null);
  assert.deepEqual(
    Object.values(detail.moveDetails.maxMoves).map((move) => move.id),
    ["MAX_OVERGROWTH", "MAX_STRIKE"],
  );
});

test("la checklist calcule les scores, catégories et diagnostics d'assets", () => {
  const checklist = buildChecklist();
  const incomplete = checklist.find((entry) => !entry.complete);
  const bulbasaur = checklist.find(
    (entry) => entry.kind === "pokemon" && entry.dexId === "0001",
  );
  assert.ok(incomplete.quality.score >= 0 && incomplete.quality.score < 100);
  assert.ok(incomplete.issueCategories.length >= 1);
  assert.equal(
    incomplete.quality.missing + incomplete.quality.invalid,
    incomplete.issues.length,
  );
  assert.equal(bulbasaur.assets.go, true);
  assert.equal(bulbasaur.assets.home, true);
  assert.ok(bulbasaur.assets.homeVariants >= 1);
  assert.equal(typeof bulbasaur.assets.locationCards, "number");
  assert.equal(typeof bulbasaur.assets.duplicateUrls, "number");
  assert.equal(typeof bulbasaur.assets.incompletePairs, "number");
});

test("l'assistant JSON couvre chaque problème détecté", () => {
  const checklist = buildChecklist();
  const hasPath = (target, pathName) => {
    const parts = String(pathName)
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean);
    let value = target;
    for (const part of parts) {
      if (
        value === null ||
        value === undefined ||
        !Object.prototype.hasOwnProperty.call(value, part)
      )
        return false;
      value = value[part];
    }
    return true;
  };

  for (const entry of checklist) {
    assert.deepEqual(
      entry.suggestedPatch,
      buildSuggestedPatch(entry.issues, entry.kind),
    );
    for (const issue of entry.issues)
      assert.ok(
        hasPath(entry.suggestedPatch, issue.path),
        `${entry.key}: ${issue.path} absent du patch`,
      );
  }

  const completeGigantamax = checklist.find(
    (entry) =>
      entry.form === "gigantamax" &&
      entry.key.toLowerCase().includes("butterfree"),
  );
  assert.equal(completeGigantamax.complete, true);
  assert.deepEqual(completeGigantamax.suggestedPatch, {});
});

test("l'atelier expose les icônes de types et valide les références", () => {
  const data = catalog();
  assert.equal(data.types.length, 18);
  assert.ok(data.types.every((type) => type.assets.icon.includes("/Types/ico_")));
  assert.ok(
    data.types.every((type) => type.assets.background.includes("/TypeBackgrounds/")),
  );
  assert.equal(data.stickers.length, 1667);
  assert.ok(data.moves.length > 400);

  const source = detailForKey(
    buildChecklist().find((entry) => entry.kind === "pokemon").key,
  ).sourceData;
  const issues = validateSourceData(
    { ...source, quickMoves: ["ATTAQUE_INCONNUE"] },
    "data/pokemon/test.json",
    "pokemon",
  );
  assert.ok(
    issues.some(
      (issue) =>
        issue.path === "quickMoves[0]" &&
        issue.expected === "identifiant présent dans data/moves",
    ),
  );
});

test("les anciennes attaques embarquées sont présentées comme références", () => {
  const pokemon = presentPokemon({
    data: {
      quickMoves: {
        VINE_WHIP_FAST: { id: "VINE_WHIP_FAST", power: 6 },
      },
      cinematicMoves: ["POWER_WHIP"],
    },
  });
  assert.deepEqual(pokemon.data.quickMoves, ["VINE_WHIP_FAST"]);
  assert.deepEqual(pokemon.data.cinematicMoves, ["POWER_WHIP"]);
});

test("les alias de ligue PvP sont normalisés", () => {
  assert.equal(normalizeLeague("great"), "greatLeague");
  assert.equal(normalizeLeague("MASTERLEAGUE"), "masterLeague");
  assert.throws(() => normalizeLeague("inconnue"), /Ligue PvP invalide/);
});

test("les filtres numériques invalides sont refusés", () => {
  assert.throws(() => buildPokemonFilter({ maxCpMin: "abc" }), /Valeur numérique invalide/);
  assert.throws(
    () => buildPokemonFilter({ catchRateMin: "10", catchRateMax: "5" }),
    /inférieur ou égal/,
  );
});
