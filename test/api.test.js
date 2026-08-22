const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const mongoose = require("mongoose");
const request = require("supertest");

mongoose.set("bufferCommands", false);

const { createApp } = require("../src/app");
const { dataPath } = require("../src/lib/data-repository");
const { normalizeLeague } = require("../src/lib/pvp");
const { attachPokemonAssets, buildPokemonFilter } = require("../src/services/pokemon-service");
const { presentPokemon } = require("../src/services/pokemon-presenter");
const { collectAllDocuments } = require("../src/sync/source-reader");
const {
  EXCLUDED_CURRENT_DATASET_COLLECTIONS,
  STATIC_SYNC_COLLECTIONS,
} = require("../src/sync/sync-service");
const {
  buildSuggestedPatch,
  buildChecklist,
  detailForKey,
  validateSourceData,
} = require("../apps/checklist/server/engine");
const { assetAudit, catalog } = require("../apps/checklist/server/workshop");

const app = createApp();

function withAdminSecret(value) {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = value;
  return () => {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  };
}

function readDataJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(dataPath(...String(relativePath).split("/")), "utf8"),
  );
}

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

test("GET /api/v1/meta expose les versions applicative, Data et schéma", async () => {
  const response = await request(app).get("/api/v1/meta").expect(200);
  const dataVersion = readDataJson("version.json");
  assert.equal(response.body.meta.apiVersion, require("../package.json").version);
  assert.equal(response.body.meta.dataVersion, dataVersion.dataVersion);
  assert.equal(response.body.meta.schemaVersion, dataVersion.schemaVersion);
  assert.equal(response.body.meta.generatedAt, dataVersion.generatedAt);
  assert.equal(response.body.meta.dataAppVersion, dataVersion.appVersion);
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
  assert.ok(response.body.paths["/api/v1/shuffle"]);
  assert.ok(response.body.paths["/api/v1/shuffle/{identifier}"]);
  assert.ok(response.body.paths["/api/v1/pokemon/{identifier}/shuffle"]);
  assert.ok(response.body.paths["/api/v1/weather"]);
  assert.ok(response.body.paths["/api/v1/weather/{identifier}"]);
  assert.ok(response.body.paths["/api/v1/weather/{identifier}/pokemon"]);
  assert.ok(response.body.paths["/api/v1/weather/{identifier}/types"]);
  assert.ok(response.body.paths["/api/v1/weather/{identifier}/moves"]);
  assert.ok(response.body.paths["/api/v1/raids"]);
  assert.ok(response.body.paths["/api/v1/eggs"]);
  assert.ok(response.body.paths["/api/v1/max-battles"]);
  assert.ok(response.body.paths["/api/v1/rocket"]);
  assert.ok(response.body.paths["/api/v1/research"]);
  assert.equal(response.body.paths["/api/v1/shiny"], undefined);
  assert.ok(response.body.paths["/api/v1/pvp-rankings"]);
  assert.ok(response.body.paths["/api/v1/pvp-rankings/{league}/{speciesId}/teammates"]);
  assert.ok(response.body.paths["/api/v1/gbl-calendar"]);
  assert.ok(response.body.paths["/api/v1/best-attackers"]);
  assert.ok(response.body.paths["/api/v1/best-defenders"]);
  assert.ok(response.body.paths["/api/v1/meta"]);
  assert.equal(response.body.paths["/api/v1/costume-audit"], undefined);
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

test("les GET current refusent tout fallback JSON quand MongoDB est indisponible", async () => {
  for (const [path, domain] of [
    ["/api/v1/raids", "raids"],
    ["/api/v1/eggs", "eggs"],
    ["/api/v1/max-battles", "max-battles"],
    ["/api/v1/rocket", "rocket"],
    ["/api/v1/research", "research"],
    ["/api/v1/pvp-rankings", "pvp-rankings"],
    ["/api/v1/gbl-calendar", "gbl-calendar"],
    ["/api/v1/best-attackers", "best-attackers"],
    ["/api/v1/best-defenders", "best-defenders"],
  ]) {
    const response = await request(app).get(`${path}?source=file`).expect(503);
    assert.deepEqual(response.body, {
      success: false,
      source: "mongodb",
      error: "MONGODB_UNAVAILABLE",
      message: `MongoDB n'est pas disponible pour le domaine ${domain}.`,
      domain,
    });
  }
});

test("le Shiny Tracker prive exige toujours le secret admin", async () => {
  const previous = process.env.API_ADMIN_SECRET;
  process.env.API_ADMIN_SECRET = "test-secret";
  try {
    await request(app).get("/api/v1/shiny").expect(401);
    await request(app).get("/api/v1/shiny/demo/history").expect(401);
  } finally {
    if (previous === undefined) delete process.env.API_ADMIN_SECRET;
    else process.env.API_ADMIN_SECRET = previous;
  }
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

test("POST /api/v1/pokemon exige le secret admin avant le refus read-only", async () => {
  const restoreSecret = withAdminSecret("test-secret");
  const missing = await request(app).post("/api/v1/pokemon").send({}).expect(401);
  assert.equal(missing.body.error.code, "ADMIN_SECRET_REQUIRED");

  const invalid = await request(app)
    .post("/api/v1/pokemon")
    .set("x-api-admin-secret", "wrong-secret")
    .send({})
    .expect(403);
  assert.equal(invalid.body.error.code, "ADMIN_SECRET_INVALID");

  const readOnly = await request(app)
    .post("/api/v1/pokemon")
    .set("x-api-admin-secret", "test-secret")
    .send({})
    .expect(405);
  restoreSecret();
  assert.equal(readOnly.body.error.code, "READ_ONLY_API");
});

test("une route inconnue retourne une erreur structurée", async () => {
  const response = await request(app).get("/inconnue").expect(404);
  assert.equal(response.body.error.code, "ROUTE_NOT_FOUND");
  assert.ok(response.body.error.requestId);
});

test("les familles d'assets invalides sont refusées avant toute lecture MongoDB", async () => {
  const response = await request(app)
    .get("/api/v1/pokemon/bulbasaur/assets/monolithe")
    .expect(400);
  assert.equal(response.body.error.code, "INVALID_ASSET_FAMILY");
});

test("OpenAPI expose les includes et les ressources d'assets séparées", async () => {
  const response = await request(app).get("/api-docs.json").expect(200);
  const paths = response.body.paths;
  assert.ok(paths["/api/v1/pokemon/{identifier}/assets"]);
  assert.ok(paths["/api/v1/pokemon/{identifier}/assets/{family}"]);
  const familyParameter = paths["/api/v1/pokemon/{identifier}/assets/{family}"].get.parameters
    .find((parameter) => parameter.name === "family");
  assert.deepEqual(familyParameter.schema.enum, [
    "home",
    "shuffle",
    "variants",
    "location-cards",
  ]);
});

test("les sources JSON sont lisibles et dédupliquées", () => {
  const data = collectAllDocuments();
  const assetFamiliesByKey = new Map(
    data.pokemonAssetFamilies.map((asset) => [`${asset.family}:${asset.formId}`, asset.payload]),
  );
  assert.ok(data.pokemon.length >= 1000);
  assert.equal(data.pokemonAssets.length, data.pokemon.length);
  assert.equal(data.pokemonAssetFamilies.length, 3030);
  assert.ok(data.moves.length >= 250);
  assert.equal(data.types.length, 18);
  assert.equal(data.weather.length, 7);
  assert.equal(data.regions.length, 10);
  assert.equal(new Set(data.pokemon.map((pokemon) => pokemon.key)).size, data.pokemon.length);
  assert.ok(data.pokemon.every((pokemon) => Array.isArray(pokemon.data.quickMoves)));
  const muk = data.pokemon.find((pokemon) => pokemon.key === "MUK");
  assert.deepEqual(muk.data.legacyQuickMoves, ["ACID_FAST"]);
  assert.deepEqual(muk.legacyMoveIds, ["ACID_FAST"]);
  assert.equal(muk.eliteMoveIds.includes("ACID_FAST"), false);
  assert.ok(data.weather.every((weather) => weather.assets.icon.includes("/weather/")));
  assert.ok(
    data.types.every(
      (type) =>
        typeof type.data.weatherBoost === "string" &&
        data.weather.some((weather) => weather.id === type.data.weatherBoost),
    ),
  );
  const bulbasaur = data.pokemon.find((pokemon) => pokemon.key === "BULBASAUR");
  const bulbasaurCore = data.pokemonAssets.find((asset) => asset.formId === "BULBASAUR");
  const bulbasaurHome = assetFamiliesByKey.get("home:BULBASAUR");
  const bulbasaurShuffle = assetFamiliesByKey.get("shuffle:BULBASAUR");
  assert.equal(bulbasaur.generation, 1);
  assert.equal(bulbasaur.regionId, "KANTO");
  assert.equal(bulbasaur.data.region.names.French, "Kanto");
  assert.equal(bulbasaur.data.assets, undefined);
  assert.match(bulbasaur.data.assetsRef, /data\/assets\/core\/normal\/0001-bulbasaur\.assets\.json/);
  assert.equal(bulbasaurCore.sourceFile, "data/assets/core/normal/0001-bulbasaur.assets.json");
  assert.equal(bulbasaurCore.assetRefs.home, "data/assets/home/normal/0001-bulbasaur.home.json");
  assert.equal(bulbasaurHome.source, "pokemon-home");
  assert.ok(Array.isArray(bulbasaurHome.variants));
  assert.equal(bulbasaurHome.variants.length, 0);
  assert.equal(bulbasaurShuffle.source, "pokemon-shuffle");
  assert.ok(bulbasaurShuffle.variants.length >= 1);
  assert.ok(
    bulbasaurShuffle.variants.every(
      (asset) => asset.form === "normal" && !asset.filename.includes("_dynamax"),
    ),
  );
  const eevee = data.pokemon.find((pokemon) => pokemon.key === "EEVEE");
  const citySafari = assetFamiliesByKey.get(`location-cards:${eevee.formId}`).find(
    (card) => card.name === "City Safari Barcelona",
  );
  assert.ok(citySafari);
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
  const unreleasedShadow = data.pokemon.find(
    (pokemon) => pokemon.data.availability.shadow === false,
  );
  assert.ok(unreleasedShadow);
  assert.equal(unreleasedShadow.data.shadow, null);
});

test("le sync JSON global exclut tous les datasets current dynamiques", () => {
  const data = collectAllDocuments();
  const dynamicDocumentKeys = ["raids", "eggs", "maxBattles", "research", "rocket"];

  assert.deepEqual(EXCLUDED_CURRENT_DATASET_COLLECTIONS, [
    "raids",
    "eggs",
    "maxbattles",
    "researches",
    "rockets",
  ]);
  assert.ok(dynamicDocumentKeys.every((key) => !Object.hasOwn(data, key)));
  assert.ok(
    EXCLUDED_CURRENT_DATASET_COLLECTIONS.every(
      (collection) => !STATIC_SYNC_COLLECTIONS.includes(collection),
    ),
  );
});

test("les types, statuts PvP dédiés et formes Max sont normalisés", () => {
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
    "raidLevel20",
    "researchLevel15",
    "weatherBoostLevel25",
  ]);
  assert.ok(dynamax.moveIds.includes("VINE_WHIP_FAST"));
  assert.deepEqual(dynamax.pvpLeagues, []);
  assert.equal(dynamax.data.pvpRecord.leagues.great.status, "UNSUPPORTED_FORM");
  assert.equal(data.pokemon.filter((pokemon) => pokemon.kind === "dynamax").length, 127);
  const maxMoves = data.moves.filter((move) => move.kind === "max");
  assert.ok(maxMoves.length >= 18);
  assert.equal(new Set(maxMoves.map((move) => move.id)).size, maxMoves.length);
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
    "raidLevel20",
    "researchLevel15",
    "weatherBoostLevel25",
  ]);
  assert.ok(data.moves.some((move) => move.kind === "max"));
  assert.ok(data.moves.some((move) => move.kind === "gmax"));
  const bulbasaur = data.pokemon.find((pokemon) => pokemon.key === "BULBASAUR");
  assert.deepEqual(bulbasaur.data.dynamaxForms, ["BULBASAUR_DYNAMAX"]);
  const venusaur = data.pokemon.find((pokemon) => pokemon.key === "VENUSAUR");
  assert.deepEqual(venusaur.data.gigantamaxForms, ["VENUSAUR_GIGANTAMAX"]);
  const toxtricityAmped = data.pokemon.find(
    (pokemon) => pokemon.key === "TOXTRICITY_AMPED",
  );
  assert.deepEqual(toxtricityAmped.data.dynamaxForms, [
    "TOXTRICITY_AMPED_DYNAMAX",
  ]);
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
  assert.equal(typeof detail.maxCp.raidLevel20, "number");
  assert.ok(detail.quickMoves.length >= 1);
  assert.ok(detail.cinematicMoves.length >= 1);
  assert.equal(typeof detail.pvp, "object");
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
  const reference = incomplete || bulbasaur;
  assert.ok(reference.quality.score >= 0 && reference.quality.score <= 100);
  if (incomplete) {
    assert.ok(incomplete.issueCategories.length >= 1);
    assert.equal(
      incomplete.quality.missing + incomplete.quality.invalid,
      incomplete.issues.length,
    );
  } else {
    assert.equal(reference.complete, true);
    assert.deepEqual(reference.issueCategories, []);
  }
  assert.equal(bulbasaur.assets.go, true);
  assert.equal(bulbasaur.assets.home, true);
  assert.equal(bulbasaur.assets.homeVariants, 0);
  assert.ok(bulbasaur.assets.shuffleVariants >= 1);
  assert.equal(typeof bulbasaur.assets.locationCards, "number");
  assert.equal(typeof bulbasaur.assets.duplicateUrls, "number");
  assert.equal(typeof bulbasaur.assets.incompletePairs, "number");
});

test("les formes séparées sont référencées sans données dupliquées", () => {
  const data = collectAllDocuments();
  assert.equal(buildChecklist().length, data.pokemon.length);
  const venusaur = data.pokemon.find((pokemon) => pokemon.key === "VENUSAUR");
  const mega = data.pokemon.find((pokemon) => pokemon.key === "VENUSAUR_MEGA");
  assert.deepEqual(venusaur.data.megaEvolutions, ["VENUSAUR_MEGA"]);
  assert.deepEqual(mega.sourceFiles, [
    "data/pokemon/mega/0003-venusaur-mega.json",
    "data/pvp/pokemon/mega/0003-venusaur-mega.pvp.json",
  ]);
  assert.equal(mega.data.formId, "VENUSAUR_MEGA");
});

test("les régions et générations sont centralisées dans leurs catalogues", () => {
  const bulbasaur = readDataJson("data/pokemon/normal/0001-bulbasaur.json");
  const rattataAlola = readDataJson("data/pokemon/alola/0019-rattata-alola.json");
  const venusaurMega = readDataJson("data/pokemon/mega/0003-venusaur-mega.json");
  const bulbasaurDynamax = readDataJson("data/pokemon/dynamax/0001-bulbasaur-dynamax.json");

  assert.equal(bulbasaur.regionId, "KANTO");
  assert.equal(bulbasaur.region, undefined);
  assert.equal(bulbasaur.generation, undefined);
  assert.equal(rattataAlola.regionId, "ALOLA");
  assert.equal(rattataAlola.region, undefined);
  assert.equal(rattataAlola.generation, undefined);
  assert.equal(venusaurMega.generation, undefined);
  assert.equal(bulbasaurDynamax.generation, undefined);
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
  assert.equal(data.weather.length, 7);
  assert.ok(data.types.every((type) => type.assets.icon.includes("/Types/ico_")));
  assert.ok(
    data.types.every((type) => type.assets.background.includes("/TypeBackgrounds/")),
  );
  assert.equal(data.stickers.length, 1667);
  assert.ok(data.moves.length > 400);
  assert.ok(data.weather.every((weather) => weather.assets.icon.includes("/weather/")));

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

test("la bibliothèque d'assets expose les icônes Pokémon Shuffle", async () => {
  const audit = await assetAudit("1");
  assert.ok(audit.totals.shuffleFiles >= 10000);
  assert.ok(audit.shuffleAssets.length >= 1);
  assert.ok(
    audit.shuffleAssets.every((asset) => asset.url.includes("/pokemonShuffle/")),
  );
});

test("les assets Shuffle sont associés une seule fois à leur forme exacte", () => {
  const data = collectAllDocuments().pokemonAssetFamilies.filter(
    (document) => document.family === "shuffle",
  );
  data.forEach((pokemon) => {
    const filenames = (pokemon.payload?.variants || []).map(
      (asset) => asset.filename,
    );
    assert.equal(new Set(filenames).size, filenames.length);
  });

  const rattataAlola = data.find((pokemon) => pokemon.formId === "RATTATA_ALOLA");
  assert.ok(
    rattataAlola.payload.variants.every((asset) =>
      asset.filename.includes("_rattata_alola"),
    ),
  );
  const venusaurMega = data.find((pokemon) => pokemon.formId === "VENUSAUR_MEGA");
  assert.ok(
    venusaurMega.payload.variants.every(
      (asset) => asset.form === "mega" && !asset.filename.endsWith("_dynamax.png"),
    ),
  );
  const bulbasaurDynamax = data.find(
    (pokemon) => pokemon.formId === "BULBASAUR_DYNAMAX",
  );
  assert.ok(
    bulbasaurDynamax.payload.variants.every(
      (asset) => asset.state === "dynamax",
    ),
  );
});

test("une forme Pokémon Home peut déclarer une liste de variantes vide", () => {
  const unownA = readDataJson("data/pokemon/forms/0201-unown-a.json");
  const issues = validateSourceData(
    unownA,
    "data/pokemon/forms/0201-unown-a.json",
    "form",
  );
  assert.ok(!issues.some((issue) => issue.path === "assets.home.variants"));
});

test("assetsRef est obligatoire pour une forme sortie ou non sortie", () => {
  const unreleased = readDataJson("data/pokemon/forms/0327-spinda-10.json");
  const released = readDataJson("data/pokemon/forms/0327-spinda-00.json");
  const unreleasedIssues = validateSourceData(
    unreleased,
    "data/pokemon/forms/0327-spinda-10.json",
    "form",
  );
  const releasedIssues = validateSourceData(
    { ...released, assetsRef: null },
    "data/pokemon/forms/0327-spinda-00.json",
    "form",
  );
  const missingUnreleasedIssues = validateSourceData(
    { ...unreleased, assetsRef: null },
    "data/pokemon/forms/0327-spinda-10.json",
    "form",
  );
  assert.ok(!unreleasedIssues.some((issue) => issue.path === "assetsRef"));
  assert.ok(missingUnreleasedIssues.some((issue) => issue.path === "assetsRef"));
  assert.ok(releasedIssues.some((issue) => issue.path === "assetsRef"));
});

test("une copie embarquée est diagnostiquée et ne remplace pas le core", () => {
  const released = structuredClone(
    readDataJson("data/pokemon/forms/0201-unown-a.json"),
  );
  released.assets = { image: "https://provider.invalid/wrong.png" };
  const issues = validateSourceData(
    released,
    "data/pokemon/forms/0201-unown-a.json",
    "form",
  );
  assert.ok(issues.some((issue) => issue.issue === "LEGACY_EMBEDDED_ASSET_DUPLICATE"));
  assert.ok(!issues.some((issue) => issue.path === "assets.image"));
});

test("la checklist exige les champs propres à chaque famille Pokémon", () => {
  const cases = [
    {
      source: readDataJson("data/pokemon/normal/0001-bulbasaur.json"),
      file: "data/pokemon/normal/0001-bulbasaur.json",
      kind: "pokemon",
      removed: "size",
    },
    {
      source: readDataJson("data/pokemon/alola/0019-rattata-alola.json"),
      file: "data/pokemon/alola/0019-rattata-alola.json",
      kind: "form",
      removed: "baseFormId",
    },
    {
      source: readDataJson("data/pokemon/mega/0003-venusaur-mega.json"),
      file: "data/pokemon/mega/0003-venusaur-mega.json",
      kind: "mega",
      removed: "dexId",
    },
    {
      source: readDataJson("data/pokemon/dynamax/0001-bulbasaur-dynamax.json"),
      file: "data/pokemon/dynamax/0001-bulbasaur-dynamax.json",
      kind: "dynamax",
      removed: "assetsRef",
    },
    {
      source: readDataJson("data/pokemon/dynamax/0001-bulbasaur-dynamax.json"),
      file: "data/pokemon/dynamax/0001-bulbasaur-dynamax.json",
      kind: "dynamax",
      removed: "evolutions",
    },
  ];

  for (const testCase of cases) {
    const source = structuredClone(testCase.source);
    delete source[testCase.removed];
    const issues = validateSourceData(source, testCase.file, testCase.kind);
    assert.ok(
      issues.some((issue) => issue.path === testCase.removed),
      `${testCase.file} doit signaler ${testCase.removed}`,
    );
  }
});

test("les anciennes attaques embarquées sont présentées comme références", () => {
  const pokemon = presentPokemon({
    data: {
      quickMoves: {
        VINE_WHIP_FAST: { id: "VINE_WHIP_FAST", power: 6 },
      },
      cinematicMoves: ["POWER_WHIP"],
      legacyQuickMoves: {
        ACID_FAST: { id: "ACID_FAST" },
      },
    },
  });
  assert.deepEqual(pokemon.data.quickMoves, ["VINE_WHIP_FAST"]);
  assert.deepEqual(pokemon.data.cinematicMoves, ["POWER_WHIP"]);
  assert.deepEqual(pokemon.data.legacyQuickMoves, ["ACID_FAST"]);
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

test("le provider Pokémon transmet exclusivement le candy du core", () => {
  const candy = {
    familyId: 1,
    image: "https://assets.test/candy/1.png",
    xlImage: "https://assets.test/xl_candy/1.png",
    primaryColor: { r: 1, g: 2, b: 3, a: 1 },
    secondaryColor: { r: 4, g: 5, b: 6, a: 1 },
  };
  const coreCandy = { ...candy, familyId: 999 };
  const fromPokemon = attachPokemonAssets({ data: { assetsRef: "data/assets/core/normal/0001.assets.json", assets: { candy } } }, { assets: { candy: coreCandy } });
  assert.deepEqual(fromPokemon.data.assets.candy, coreCandy);
  assert.equal(fromPokemon.data.assetsRef, "data/assets/core/normal/0001.assets.json");
  const fromAssetDocument = attachPokemonAssets({ data: { assetsRef: "data/assets/core/normal/0001.assets.json" } }, { assets: { candy } });
  assert.deepEqual(fromAssetDocument.data.assets.candy, candy);

  const fromCanonicalJson = attachPokemonAssets({
    sourceFiles: ["data/pokemon/0001-bulbasaur.json"],
    data: { assetsRef: "data/assets/core/normal/0001-bulbasaur.assets.json" },
  }, { assets: { candy } });
  assert.equal(fromCanonicalJson.data.assets.candy.xlImage, candy.xlImage);
});
