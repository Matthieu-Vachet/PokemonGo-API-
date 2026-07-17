const express = require("express");
const pokemon = require("./pokemon");
const moves = require("./moves");
const search = require("./search");
const pvp = require("./pvp");
const compare = require("./compare");
const stats = require("./stats");
const meta = require("./meta");
const catalogs = require("./catalogs");
const forms = require("./forms");
const smart = require("./smart");
const backgrounds = require("./backgrounds");
const shadow = require("./shadow");
const stickers = require("./stickers");
const shuffle = require("./shuffle");
const weather = require("./weather");
const candy = require("./candy");
const raids = require("./raids");
const eggs = require("./eggs");
const maxBattles = require("./max-battles");
const items = require("./items");
const rocket = require("./rocket");
const rocketTexts = require("./rocket-texts");
const research = require("./research");
const shiny = require("./shiny");
const pvpRankings = require("./pvp-rankings");
const bestAttackers = require("./best-attackers");
const pokemonIdentityMappings = require("./pokemon-identity-mappings");
const pokemonIdentities = require("./pokemon-identities");
const gameMaster = require("./game-master");
const dynamaxImages = require("./dynamax-images");
const communityDays = require("./community-days");
const eventsHistory = require("./events-history");

const router = express.Router();

router.get("/", (_request, response) => {
  response.json({
    data: {
      name: "Pokémon GO API",
      version: "v1",
      documentation: "/api-docs",
      swagger: "/swagger",
      routes: {
        pokemon: "/api/v1/pokemon",
        search: "/api/v1/search?q=dracaufeu",
        moves: "/api/v1/moves",
        pvp: "/api/v1/pvp/great/rankings",
        pvpRankings: "/api/v1/pvp-rankings?league=great",
        bestAttackers: "/api/v1/best-attackers?type=FIRE&level=40&metric=edps",
        mega: "/api/v1/mega",
        dynamax: "/api/v1/dynamax",
        gigantamax: "/api/v1/gigantamax",
        types: "/api/v1/types",
        weather: "/api/v1/weather",
        candy: "/api/v1/candy",
        raids: "/api/v1/raids",
        eggs: "/api/v1/eggs",
        maxBattles: "/api/v1/max-battles",
        items: "/api/v1/items",
        rocket: "/api/v1/rocket",
        rocketTexts: "/api/v1/rocket-texts",
        research: "/api/v1/research",
        communityDays: "/api/v1/community-days",
        eventsHistory: "/api/v1/events/history",
        regions: "/api/v1/regions",
        generations: "/api/v1/generations",
        compare: "/api/v1/compare/pokemon?ids=charizard,blastoise",
        stats: "/api/v1/stats/global",
        backgrounds: "/api/v1/backgrounds",
        shadow: "/api/v1/shadow",
        stickers: "/api/v1/stickers",
        shuffle: "/api/v1/shuffle",
      },
    },
  });
});

router.use("/pokemon", pokemon);
router.use("/backgrounds", backgrounds);
router.use("/shadow", shadow);
router.use("/stickers", stickers);
router.use("/shuffle", shuffle);
router.use("/weather", weather);
router.use("/candy", candy);
router.use("/raids", raids);
router.use("/admin/raids", raids);
router.use("/eggs", eggs);
router.use("/admin/eggs", eggs);
router.use("/max-battles", maxBattles);
router.use("/admin/max-battles", maxBattles);
router.use("/items", items);
router.use("/rocket", rocket);
router.use("/admin/rocket", rocket);
router.use("/rocket-texts", rocketTexts);
router.use("/research", research);
router.use("/admin/research", research);
// Shiny reste privé et volontairement absent d'OpenAPI.
router.use("/shiny", shiny);
router.use("/admin/shiny", shiny);
// Les classements PvPoke sont publics; seules les mutations /admin restent protégées.
router.use("/pvp-rankings", pvpRankings);
router.use("/admin/pvp-rankings", pvpRankings);
// Les classements PvE sont publics; seules les mutations /admin restent protégées.
router.use("/best-attackers", bestAttackers);
router.use("/admin/best-attackers", bestAttackers);
// Diagnostic privé de résolution Game Master.
router.use("/pokemon-identity-mappings", pokemonIdentityMappings);
router.use("/admin/pokemon-identity-mappings", pokemonIdentityMappings);
// Référentiel canonique privé, administré exclusivement depuis le Dashboard.
router.use("/admin/pokemon-identities", pokemonIdentities);
// Explorer Game Master strictement privé, absent de la découverte et de l'OpenAPI publics.
router.use("/admin/game-master", gameMaster);
// Scraping d'images Dynamax strictement privé, sans route publique ni dataset Pokémon.
router.use("/admin/dynamax-images", dynamaxImages);
router.use("/community-days", communityDays);
router.use("/events/history", eventsHistory);
router.use("/search", search);
router.use("/moves", moves);
router.use("/pvp", pvp);
router.use("/compare", compare);
router.use("/stats", stats);
router.use("/meta", meta);
router.use("/", smart);
router.use("/mega", forms.mega);
router.use("/dynamax", forms.dynamax);
router.use("/gigantamax", forms.gigantamax);
router.use("/regional", forms.regional);
router.use("/types", catalogs.types);
router.use("/regions", catalogs.regions);
router.use("/generations", catalogs.generations);

module.exports = router;
