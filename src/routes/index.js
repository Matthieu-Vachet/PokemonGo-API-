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
        mega: "/api/v1/mega",
        gigantamax: "/api/v1/gigantamax",
        types: "/api/v1/types",
        regions: "/api/v1/regions",
        generations: "/api/v1/generations",
        compare: "/api/v1/compare/pokemon?ids=charizard,blastoise",
        stats: "/api/v1/stats/global",
      },
    },
  });
});

router.use("/pokemon", pokemon);
router.use("/search", search);
router.use("/moves", moves);
router.use("/pvp", pvp);
router.use("/compare", compare);
router.use("/stats", stats);
router.use("/meta", meta);
router.use("/", smart);
router.use("/mega", forms.mega);
router.use("/gigantamax", forms.gigantamax);
router.use("/regional", forms.regional);
router.use("/types", catalogs.types);
router.use("/regions", catalogs.regions);
router.use("/generations", catalogs.generations);

module.exports = router;
