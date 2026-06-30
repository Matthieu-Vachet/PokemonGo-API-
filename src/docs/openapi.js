const { env } = require("../config/env");

const examples = {
  pokemon: {
    key: "CHARIZARD",
    kind: "pokemon",
    id: "CHARIZARD",
    formId: "CHARIZARD",
    slug: "charizard",
    dexNr: 6,
    dexId: "0006",
    form: "normal",
    generation: 1,
    regionId: "KANTO",
    names: { English: "Charizard", French: "Dracaufeu" },
    types: ["FIRE", "FLYING"],
    stats: { attack: 223, defense: 173, stamina: 186 },
    availability: {
      released: true,
      shinyReleased: true,
      shadowShinyReleased: true,
      shadow: true,
    },
    shinyAvailability: {
      releaseDate: "2018-05-19",
      event: "Community Day",
      source: "https://www.margxt.fr/guide-liste-des-pokemon-shiny-disponibles-dans-pokemon-go/",
      matchedName: "Dracaufeu",
    },
    shadowShinyAvailability: {
      releaseDate: "2020-07-10",
      event: "GO Fest Battle Challenge",
      source: "https://www.margxt.fr/liste-des-pokemon-obscurs-et-chromatiques-shiny-dans-pokemon-go/",
      matchedName: "Dracaufeu",
    },
    assets: {
      image: "https://raw.githubusercontent.com/.../pokemon/0006.png",
      shinyImage: "https://raw.githubusercontent.com/.../pokemon/0006-shiny.png",
      assetsRef: "pokemon-assets/normal/0006-charizard.assets.json",
    },
  },
  move: {
    id: "BLAST_BURN",
    slug: "blast-burn",
    kind: "charged",
    elite: true,
    type: "FIRE",
    names: { English: "Blast Burn", French: "Rafale Feu" },
  },
  candy: {
    familyId: 1,
    image: "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/candy/1.png",
    primaryColor: { r: 128, g: 210, b: 118, a: 1 },
    secondaryColor: { r: 52, g: 145, b: 80, a: 1 },
    pokemon: [{ dexId: "0001", name: "Bulbizarre", form: "normal" }],
  },
  raids: {
    currentList: {
      ultra_beast: [],
      mega: [
        {
          id: "PIDGEOT",
          form: "PIDGEOT_MEGA",
          level: "mega",
          names: { English: "Mega Pidgeot", French: "Méga-Roucarnage" },
          shiny: true,
          types: ["Normal", "Flying"],
          weather: ["partlyCloudy", "windy"],
          cpRange: [1151, 1216],
          cpRangeBoost: [1439, 1521],
        },
      ],
      lvl5: [],
      lvl3: [],
      lvl1: [],
      shadow_lvl5: [],
      shadow_lvl3: [],
      shadow_lvl1: [],
    },
  },
  eggs: {
    currentEggsList: {
      "1km": [
        {
          id: "BULBASAUR",
          form: "BULBASAUR",
          names: { English: "Bulbasaur", French: "Bulbizarre" },
          shiny: true,
          types: ["Grass", "Poison"],
          rarity: 4,
          cp: 637,
        },
      ],
      "2km": [],
      "5km": [],
      "5km_adventure_sync": [],
      "7km": [],
      "7km_route_gift": [],
      "10km": [],
      "10km_adventure_sync": [],
      "12km": [],
    },
  },
  maxBattles: {
    currentMaxBattle: {
      Tier1: [
        {
          id: "COMBEE",
          form: "COMBEE_DYNAMAX",
          names: { English: "Combee", French: "Apitrini" },
          shiny: true,
          types: ["Bug", "Flying"],
          tier: "Tier1",
          cpRange: [251, 282],
        },
      ],
    },
  },
  item: {
    id: "ITEM_ULTRA_BALL",
    templateId: "ITEM_ULTRA_BALL",
    itemId: "ITEM_ULTRA_BALL",
    category: "pokeball",
    itemType: "pokeball",
    names: { English: "Ultra Ball", French: "Hyper Ball" },
    description: { English: "A high-performance Poké Ball.", French: "Une Ball très performante." },
    asset: "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/items/ultra_ball.png",
    assetKey: "ultra_ball",
  },
  rocketText: {
    id: "grunt_fire_female_combat_grunt_quote_fire",
    textKey: "combat_grunt_quote_fire",
    trainerType: "grunt",
    gender: "female",
    type: "FIRE",
    character: null,
    texts: {
      English: "Do you know how hot Pokémon fire breath can get?",
      French: "Sais-tu à quel point le souffle de feu des Pokémon peut être chaud ?",
    },
    textVariants: {
      English: ["Do you know how hot Pokémon fire breath can get?"],
      French: ["Sais-tu à quel point le souffle de feu des Pokémon peut être chaud ?"],
    },
  },
  rocket: {
    currentRocketList: {
      giovanni: [],
      leaders: {
        arlo: [
          {
            trainer: "Arlo",
            trainerType: "leader",
            slots: { slot1: [], slot2: [], slot3: [] },
            rewards: [],
            assets: { trainerImage: "/ui/rocket/leader-arlo.webp" },
          },
        ],
      },
      grunts: [],
    },
  },
  research: {
    currentResearchList: {
      fieldResearch: [
        {
          task: "Catch 7 Pokémon",
          category: "fieldResearch",
          rewardType: "pokemon",
          reward: {
            id: "MAGIKARP",
            form: "MAGIKARP",
            names: { English: "Magikarp", French: "Magicarpe" },
            shiny: true,
            cpRange: [99, 117],
          },
        },
      ],
      eventResearch: [],
      specialResearch: [],
      timedResearch: [],
    },
  },
};

const errorResponse = {
  description: "Erreur API structurée",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: {
        error: {
          code: "POKEMON_NOT_FOUND",
          message: "Pokémon introuvable : missingno",
          requestId: "8f636d5a-0ac1-4fea-9ad2-9980ee14ca4b",
        },
      },
    },
  },
};

function parameter(name, location, example, description, schema = {}) {
  return {
    name,
    in: location,
    required: location === "path",
    description,
    schema: { type: "string", ...schema },
    example,
  };
}

function requiredParameter(name, location, example, description, schema = {}) {
  return { ...parameter(name, location, example, description, schema), required: true };
}

const page = parameter("page", "query", 1, "Numéro de page.", {
  type: "integer",
  minimum: 1,
  default: 1,
});
const limit = parameter("limit", "query", 25, "Résultats par page, maximum 100.", {
  type: "integer",
  minimum: 1,
  maximum: 100,
  default: 25,
});

function dataResponse(example = examples.pokemon, description = "Ressource trouvée") {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/DataResponse" },
        example: { data: example },
      },
    },
  };
}

function listResponse(example = examples.pokemon) {
  return {
    description: "Liste paginée",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/PaginatedResponse" },
        example: {
          data: [example],
          meta: { page: 1, limit: 25, total: 1, pages: 1 },
        },
      },
    },
  };
}

function operation(tag, summary, {
  description,
  parameters = [],
  response,
  errors = true,
} = {}) {
  const get = {
      tags: [tag],
      summary,
      description,
      parameters,
      responses: {
        200: response || dataResponse(),
        ...(errors ? { 400: errorResponse, 404: errorResponse } : {}),
      },
  };
  return { get };
}

function detail(tag, summary, example, {
  name = "identifier",
  description = "Slug, ID, formId ou numéro Pokédex.",
  parameters = [],
  response,
} = {}) {
  return operation(tag, summary, {
    parameters: [parameter(name, "path", example, description), ...parameters],
    response,
  });
}

function list(tag, summary, parameters = [], example = examples.pokemon) {
  return operation(tag, summary, {
    parameters: [page, limit, ...parameters],
    response: listResponse(example),
  });
}

function createOpenApi() {
  const api = env.apiBasePath;
  const specification = {
    openapi: "3.0.3",
    info: {
      title: "Pokémon GO API",
      version: "1.3.0",
      description:
        "Référence complète de l'API Pokémon GO francophone. Les routes GET publiques restent accessibles sans secret. Les routes privées, internes ou d'écriture exigent le header x-api-admin-secret alimenté par API_ADMIN_SECRET côté serveur. Pour exécuter les requêtes depuis le navigateur, utilisez [Swagger UI](/swagger).",
      license: { name: "ISC" },
    },
    servers: [
      { url: "/", description: "Serveur actuel" },
      { url: env.publicUrl, description: env.isProduction ? "Production" : "Local" },
    ],
    tags: [
      ["System", "État et découverte de l'API."],
      ["Pokémon", "Pokédex, formes, filtres et PC."],
      ["Recherche", "Recherche globale multilingue."],
      ["Évolutions", "Évolutions directes, chaînes et conditions."],
      ["Méga", "Méga-Évolutions et Primo-Résurgences."],
      ["Dynamax", "Formes Dynamax et capacités Max."],
      ["Gigantamax", "Formes Gigantamax."],
      ["PvP", "Classements, IV et movesets par ligue."],
      ["Attaques", "Attaques rapides, chargées et élite."],
      ["Types", "Types, faiblesses, résistances et Pokémon associés."],
      ["Météo", "Météos Pokémon GO, icônes et ressources boostées."],
      ["Candy", "Couleurs et images de bonbons groupées par famille d'évolution."],
      ["Raids", "Boss de raids Pokemon GO actifs enrichis depuis les donnees locales."],
      ["Oeufs", "Eclosions Pokemon GO actives enrichies depuis les donnees locales."],
      ["Max Battles", "Boss Max Battle Pokemon GO actifs enrichis depuis les donnees locales."],
      ["Rocket", "Lineups Team GO Rocket actifs enrichis depuis les donnees locales."],
      ["Research", "Quetes Research Pokemon GO actives enrichies depuis les donnees locales."],
      ["Régions", "Régions et Pokémon associés."],
      ["Générations", "Générations et Pokémon associés."],
      ["Comparaison", "Comparaison de Pokémon."],
      ["Statistiques", "Statistiques globales et classements."],
      ["Collection", "Routes adaptées aux outils de collection."],
      ["Raid", "Suggestions de contres Raid."],
      ["Assets", "Images et variantes visuelles."],
      ["Backgrounds", "Backgrounds de lieu et spéciaux, dates et Pokémon éligibles."],
      ["Shadow", "Sorties Obscures, coûts de purification, Catch CP et variantes."],
      ["Stickers", "Catalogue des stickers Pokémon GO disponibles comme assets."],
      ["Shuffle", "Icônes Pokémon Shuffle associées à leur fiche exacte."],
      ["Métadonnées", "Filtres publics disponibles pour explorer l'API."],
    ].map(([name, description]) => ({ name, description })),
    paths: {
      "/health": operation("System", "Vérifier la connexion MongoDB", {
        errors: false,
        response: dataResponse({
          status: "ok",
          database: "connected",
          uptimeSeconds: 120,
          timestamp: "2026-06-07T20:00:00.000Z",
        }),
      }),
      [api]: operation("System", "Découvrir les routes principales", {
        errors: false,
        response: dataResponse({
          name: "Pokémon GO API",
          version: "v1",
          documentation: "/api-docs",
          routes: { pokemon: "/api/v1/pokemon", search: "/api/v1/search?q=dracaufeu" },
        }),
      }),
      [`${api}/pokemon`]: list("Pokémon", "Lister et combiner les filtres Pokémon", [
        parameter("q", "query", "dracaufeu", "Nom multilingue, slug, ID ou formId."),
        parameter("generation", "query", "1", "Une ou plusieurs générations séparées par des virgules."),
        parameter("region", "query", "KANTO", "Une ou plusieurs régions."),
        parameter("type", "query", "FIRE,FLYING", "Types recherchés."),
        parameter("matchAllTypes", "query", true, "Exiger tous les types indiqués.", { type: "boolean" }),
        parameter("primaryType", "query", "FIRE", "Type principal."),
        parameter("secondaryType", "query", "FLYING", "Type secondaire."),
        parameter("form", "query", "normal", "Forme précise."),
        parameter("kind", "query", "pokemon", "Catégorie : pokemon, regional, mega, gigantamax ou form."),
        parameter("weather", "query", "sunny", "Météo qui booste le Pokémon."),
        parameter("move", "query", "BLAST_BURN", "ID d'une attaque apprise."),
        parameter("pvpLeague", "query", "greatLeague", "Ligue PvP disponible."),
        parameter("released", "query", true, "Filtrer les Pokémon sortis.", { type: "boolean" }),
        parameter("shinyReleased", "query", true, "Filtrer les chromatiques sortis.", { type: "boolean" }),
        parameter("shadowShinyReleased", "query", true, "Filtrer les Obscurs chromatiques sortis.", { type: "boolean" }),
        parameter("shadow", "query", true, "Filtrer les formes obscures.", { type: "boolean" }),
        parameter("mega", "query", true, "Filtrer les Méga.", { type: "boolean" }),
        parameter("gigantamax", "query", true, "Filtrer les Gigantamax.", { type: "boolean" }),
        parameter("buddyDistanceMin", "query", 1, "Distance buddy minimale.", { type: "number" }),
        parameter("catchRateMin", "query", 0.1, "Taux de capture minimal.", { type: "number" }),
        parameter("maxCpMin", "query", 2500, "PC niveau 50 minimal.", { type: "number" }),
        parameter("sort", "query", "-maxCp.maxLevel50,dexNr", "Tri autorisé, préfixer par - pour décroissant."),
        parameter("include", "query", "data", "Ajouter `data` pour inclure le JSON source complet."),
      ]),
      [`${api}/pokemon/random`]: operation("Pokémon", "Retourner un Pokémon aléatoire", {
        parameters: [parameter("released", "query", true, "Limiter aux Pokémon sortis.", { type: "boolean" })],
      }),
      [`${api}/pokemon/slug/{value}`]: detail("Pokémon", "Rechercher par slug", "charizard", { name: "value", description: "Slug anglais en minuscules." }),
      [`${api}/pokemon/id/{value}`]: detail("Pokémon", "Rechercher par ID", "CHARIZARD", { name: "value", description: "ID technique en majuscules." }),
      [`${api}/pokemon/dex/{value}`]: detail("Pokémon", "Rechercher par numéro Pokédex", 6, { name: "value", description: "Numéro Pokédex.", response: listResponse() }),
      [`${api}/pokemon/form-id/{value}`]: detail("Pokémon", "Rechercher par formId", "CHARIZARD", { name: "value", description: "Identifiant technique de forme.", response: listResponse() }),
      [`${api}/pokemon/{identifier}`]: detail("Pokémon", "Afficher une fiche Pokémon", "charizard", {
        parameters: [
          parameter("form", "query", "normal", "Choisir une forme en cas d'ambiguïté."),
          parameter("kind", "query", "pokemon", "Choisir une catégorie en cas d'ambiguïté."),
        ],
      }),
      [`${api}/pokemon/{identifier}/forms`]: detail("Pokémon", "Lister toutes les formes", "charizard", { response: listResponse() }),
      [`${api}/pokemon/{identifier}/evolutions`]: detail("Évolutions", "Afficher pré-évolutions et évolutions directes", "charmeleon"),
      [`${api}/pokemon/{identifier}/evolution-chain`]: detail("Évolutions", "Afficher la chaîne d'évolution complète", "charizard", { response: listResponse() }),
      [`${api}/pokemon/{identifier}/cp`]: detail("Pokémon", "Calculer les PC par niveau et IV", "charizard", {
        parameters: [
          parameter("level", "query", 50, "Niveau de 1 à 50, par pas de 0,5. Omettre pour obtenir tous les niveaux.", { type: "number", minimum: 1, maximum: 50 }),
          parameter("attackIv", "query", 15, "IV attaque.", { type: "integer", minimum: 0, maximum: 15 }),
          parameter("defenseIv", "query", 15, "IV défense.", { type: "integer", minimum: 0, maximum: 15 }),
          parameter("staminaIv", "query", 15, "IV endurance.", { type: "integer", minimum: 0, maximum: 15 }),
        ],
        response: dataResponse({ pokemon: "CHARIZARD", level: 50, ivs: { attack: 15, defense: 15, stamina: 15 }, cp: 3266 }),
      }),
      [`${api}/pokemon/{identifier}/assets`]: detail("Assets", "Afficher tous les assets d'une fiche", "pikachu"),
      [`${api}/pokemon/{identifier}/backgrounds`]: detail("Backgrounds", "Afficher les backgrounds éligibles d'un Pokémon", "eevee"),
      [`${api}/pokemon/{identifier}/shadow`]: detail("Shadow", "Afficher les données Shadow d'un Pokémon", "bulbasaur"),
      [`${api}/pokemon/{identifier}/shuffle`]: detail("Shuffle", "Afficher les assets Shuffle d'un Pokémon ou d'une forme", "bulbasaur"),
      [`${api}/pokemon/{identifier}/moves`]: detail("Attaques", "Afficher les attaques détaillées d'un Pokémon", "bulbasaur", {
        response: dataResponse({
          quickMoves: [examples.move],
          cinematicMoves: [],
          eliteQuickMoves: [],
          eliteCinematicMoves: [],
        }),
      }),
      [`${api}/search`]: operation("Recherche", "Rechercher Pokémon et attaques en français ou autre langue", {
        parameters: [
          requiredParameter("q", "query", "dracaufeu", "Recherche d'au moins deux caractères.", { minLength: 2 }),
          parameter("limit", "query", 20, "Maximum de résultats par catégorie.", { type: "integer", maximum: 50 }),
        ],
        response: dataResponse({ pokemon: [examples.pokemon], moves: [] }),
      }),
      [`${api}/moves`]: list("Attaques", "Lister et filtrer les attaques", [
        parameter("q", "query", "rafale feu", "Nom multilingue ou ID."),
        parameter("kind", "query", "charged", "Type d'attaque : fast ou charged.", { enum: ["fast", "charged"] }),
        parameter("elite", "query", true, "Attaque disponible en version élite.", { type: "boolean" }),
        parameter("type", "query", "FIRE", "Type de l'attaque."),
        parameter("sort", "query", "-power,id", "Tri : id, slug, power, energy, durationMs ou statistiques combat."),
      ], examples.move),
      [`${api}/moves/{identifier}`]: detail("Attaques", "Afficher une attaque", "BLAST_BURN", { description: "ID technique ou slug.", response: dataResponse(examples.move) }),
      [`${api}/moves/{identifier}/pokemon`]: detail("Attaques", "Lister les Pokémon apprenant une attaque", "BLAST_BURN", { description: "ID technique de l'attaque.", response: listResponse() }),
      [`${api}/mega`]: list("Méga", "Lister les Méga et Primo"),
      [`${api}/mega/{identifier}`]: detail("Méga", "Afficher une Méga ou Primo", "charizard", { parameters: [parameter("form", "query", "mega-x", "Forme Méga souhaitée.")] }),
      [`${api}/dynamax`]: list("Dynamax", "Lister les Dynamax"),
      [`${api}/dynamax/{identifier}`]: detail("Dynamax", "Afficher un Dynamax", "bulbasaur"),
      [`${api}/gigantamax`]: list("Gigantamax", "Lister les Gigantamax"),
      [`${api}/gigantamax/{identifier}`]: detail("Gigantamax", "Afficher un Gigantamax", "charizard"),
      [`${api}/regional`]: list("Pokémon", "Lister les formes régionales"),
      [`${api}/regional/{identifier}`]: detail("Pokémon", "Afficher une forme régionale", "raichu", { parameters: [parameter("form", "query", "alola", "Forme régionale souhaitée.")] }),
      [`${api}/types`]: operation("Types", "Lister les 18 types", { response: dataResponse([{ id: "FIRE", names: { English: "Fire", French: "Feu" } }]) }),
      [`${api}/types/{identifier}`]: detail("Types", "Afficher faiblesses et résistances d'un type", "FIRE", { description: "ID du type en anglais.", response: dataResponse({ id: "FIRE", names: { English: "Fire", French: "Feu" } }) }),
      [`${api}/types/{identifier}/pokemon`]: detail("Types", "Lister les Pokémon d'un type", "FIRE", { description: "ID du type en anglais.", response: listResponse() }),
      [`${api}/weather`]: operation("Météo", "Lister les 7 météos Pokémon GO", {
        response: dataResponse([{ id: "sunny", names: { French: "Ensoleillé" }, assets: { icon: "https://raw.githubusercontent.com/.../weather/1.png" }, boostedTypes: ["FIRE", "GRASS", "GROUND"] }]),
      }),
      [`${api}/weather/{identifier}`]: detail("Météo", "Afficher une météo", "sunny", {
        description: "Identifiant ou slug météo.",
      }),
      [`${api}/weather/{identifier}/pokemon`]: detail("Météo", "Lister les Pokémon boostés par une météo", "sunny", {
        description: "Identifiant ou slug météo.",
        response: listResponse(),
      }),
      [`${api}/weather/{identifier}/types`]: detail("Météo", "Lister les types boostés par une météo", "sunny", {
        description: "Identifiant ou slug météo.",
        response: listResponse({ id: "FIRE", names: { French: "Feu" } }),
      }),
      [`${api}/weather/{identifier}/moves`]: detail("Météo", "Lister les attaques boostées par une météo via leur type", "sunny", {
        description: "Identifiant ou slug météo.",
        response: listResponse(examples.move),
      }),
      [`${api}/candy`]: operation("Candy", "Lister les bonbons par famille Pokémon", {
        parameters: [
          page,
          limit,
          parameter("q", "query", "bulbizarre", "Recherche par familyId, nom, slug ou numéro Pokédex."),
          parameter("familyId", "query", 1, "Limiter à une famille précise.", { type: "integer" }),
        ],
        response: listResponse(examples.candy),
      }),
      [`${api}/candy/{familyId}`]: detail("Candy", "Afficher une famille de bonbon", 1, {
        name: "familyId",
        description: "FamilyId partagé par le Pokémon de base et ses évolutions.",
        response: dataResponse(examples.candy),
      }),
      [`${api}/candy/{familyId}/pokemon`]: detail("Candy", "Lister les Pokémon associés à un bonbon", 1, {
        name: "familyId",
        description: "FamilyId partagé par le Pokémon de base et ses évolutions.",
        response: listResponse(examples.pokemon),
      }),
      [`${api}/raids`]: operation("Raids", "Afficher les boss de raids Pokemon GO actuels", {
        parameters: [
          parameter("source", "query", "file", "`file` par defaut ou `mongo` si l'import admin a ete execute."),
        ],
        response: dataResponse(examples.raids),
      }),
      [`${api}/eggs`]: operation("Oeufs", "Afficher les eclosions d'oeufs Pokemon GO actuelles", {
        parameters: [
          parameter("source", "query", "file", "`file` par defaut ou `mongo` si l'import admin a ete execute."),
        ],
        response: dataResponse(examples.eggs),
      }),
      [`${api}/max-battles`]: operation("Max Battles", "Afficher les Max Battles Pokemon GO actuelles", {
        parameters: [
          parameter("source", "query", "file", "`file` par defaut ou `mongo` si l'import admin a ete execute."),
        ],
        response: dataResponse(examples.maxBattles),
      }),
      [`${api}/items`]: operation("Items", "Lister les objets canoniques Pokemon GO", {
        parameters: [
          page,
          limit,
          parameter("q", "query", "Ultra Ball", "Recherche texte sur les noms, IDs et assetKey."),
          parameter("category", "query", "pokeball", "Filtrer par categorie item."),
          parameter("itemType", "query", "pokeball", "Filtrer par type item."),
        ],
        response: listResponse(examples.item),
      }),
      [`${api}/items/{identifier}`]: detail("Items", "Afficher un objet", "ITEM_ULTRA_BALL", {
        description: "ID, itemId, templateId ou assetKey.",
        response: dataResponse(examples.item),
      }),
      [`${api}/rocket`]: operation("Rocket", "Afficher les lineups Team GO Rocket actuels", {
        parameters: [
          parameter("source", "query", "file", "`file` par defaut ou `mongo` si l'import admin a ete execute."),
        ],
        response: dataResponse(examples.rocket),
      }),
      [`${api}/rocket-texts`]: operation("Rocket Texts", "Lister les textes traduits Team GO Rocket", {
        parameters: [
          page,
          limit,
          parameter("trainerType", "query", "grunt", "Filtrer par type de trainer."),
          parameter("type", "query", "FIRE", "Filtrer par type Pokemon associe."),
          parameter("character", "query", "giovanni", "Filtrer par personnage si disponible."),
        ],
        response: listResponse(examples.rocketText),
      }),
      [`${api}/rocket-texts/{identifier}`]: detail("Rocket Texts", "Afficher un texte Rocket", "grunt_fire_female_combat_grunt_quote_fire", {
        description: "ID stable ou textKey officiel.",
        response: dataResponse(examples.rocketText),
      }),
      [`${api}/research`]: operation("Research", "Afficher les quetes Research Pokemon GO actuelles", {
        parameters: [
          parameter("source", "query", "file", "`file` par defaut ou `mongo` si l'import admin a ete execute."),
        ],
        response: dataResponse(examples.research),
      }),
      [`${api}/regions`]: operation("Régions", "Lister les régions", { response: dataResponse([{ id: "KANTO", generation: 1, names: { French: "Kanto" } }]) }),
      [`${api}/regions/{identifier}`]: detail("Régions", "Afficher une région", "KANTO", { description: "ID ou slug de région." }),
      [`${api}/regions/{identifier}/pokemon`]: detail("Régions", "Lister les Pokémon d'une région", "KANTO", { description: "ID de région.", response: listResponse() }),
      [`${api}/generations`]: operation("Générations", "Lister les générations", { response: dataResponse([{ id: "KANTO", generation: 1 }]) }),
      [`${api}/generations/{identifier}`]: detail("Générations", "Afficher une génération", 1, { description: "Numéro de génération ou identifiant régional." }),
      [`${api}/generations/{identifier}/pokemon`]: detail("Générations", "Lister les Pokémon d'une génération", 1, { description: "Numéro de génération.", response: listResponse() }),
      [`${api}/pvp/{league}/rankings`]: detail("PvP", "Classement paginé d'une ligue", "great", {
        name: "league",
        description: "Alias accepté : little, great, ultra ou master.",
        parameters: [page, limit],
        response: listResponse(),
      }),
      [`${api}/pvp/{league}/top`]: detail("PvP", "Meilleurs Pokémon d'une ligue", "ultra", {
        name: "league",
        description: "Alias accepté : little, great, ultra ou master.",
        parameters: [page, limit],
        response: listResponse(),
      }),
      [`${api}/pvp/{league}/{identifier}`]: operation("PvP", "Afficher rang, IV et moveset PvP", {
        parameters: [
          parameter("league", "path", "great", "Alias accepté : little, great, ultra ou master.", { enum: ["little", "great", "ultra", "master"] }),
          parameter("identifier", "path", "venusaur", "Slug, ID, formId ou numéro Pokédex."),
        ],
      }),
      [`${api}/compare/pokemon`]: operation("Comparaison", "Comparer de 2 à 10 Pokémon", {
        parameters: [
          requiredParameter("ids", "query", "charizard,blastoise,venusaur", "Identifiants séparés par des virgules."),
          parameter("level", "query", 50, "Niveau utilisé pour comparer les PC.", { type: "number", minimum: 1, maximum: 50 }),
        ],
        response: listResponse(),
      }),
      [`${api}/stats/global`]: operation("Statistiques", "Afficher les statistiques globales", {
        errors: false,
        response: dataResponse({ totals: { pokemon: 1416, moves: 282, types: 18, regions: 10, generations: 10 } }),
      }),
      [`${api}/stats/top/{metric}`]: detail("Statistiques", "Classer les Pokémon selon une statistique", "attack", {
        name: "metric",
        description: "Statistique : attack, defense, stamina ou cp.",
        parameters: [limit],
        response: listResponse(),
      }),
      [`${api}/availability/{flag}`]: detail("Pokémon", "Lister selon une disponibilité", "shinyReleased", {
        name: "flag",
        description: "released, shinyReleased, shadowShinyReleased, tradable, pokemonHomeTransfer, shadow, apex, dynamax, gigantamax ou mega.",
        response: listResponse(),
      }),
      [`${api}/assets/{identifier}`]: detail("Assets", "Afficher les images normales, shiny et variantes", "pikachu"),
      [`${api}/backgrounds`]: operation("Backgrounds", "Lister le catalogue des backgrounds", {
        parameters: [
          parameter("type", "query", "location", "Type : location ou special.", { enum: ["location", "special"] }),
          parameter("date", "query", "2025", "Recherche libre dans la période du background."),
        ],
        response: listResponse({
          id: "lc_GoFest2025_paris",
          name: "Pokémon GO Fest 2025: Paris",
          type: "location",
          date: "June 13th - 15th 2025",
          eligibleForms: ["Eevee (Explorer Hat)"],
          image: "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/LocationCards/lc_GoFest2025_paris.png",
        }),
      }),
      [`${api}/backgrounds/{id}/pokemon`]: detail("Backgrounds", "Lister les Pokémon éligibles à un background", "lc_GoFest2025_paris", {
        name: "id",
        description: "Identifiant construit à partir du nom du fichier dans LocationCards.",
        response: listResponse(),
      }),
      [`${api}/shadow`]: list("Shadow", "Lister les Pokémon Shadow déjà sortis", [
        parameter("variant", "query", "A", "Identifiant de variante Bulbapedia, par exemple A pour certaines formes régionales ou Apex."),
        parameter("releasedFrom", "query", "2025-01-01", "Première date de sortie minimale, format YYYY-MM-DD."),
        parameter("releasedTo", "query", "2025-12-31", "Première date de sortie maximale, format YYYY-MM-DD."),
      ]),
      [`${api}/shadow/{identifier}`]: detail("Shadow", "Afficher les données Shadow détaillées", "bulbasaur"),
      [`${api}/stickers`]: operation("Stickers", "Lister et rechercher les stickers", {
        parameters: [
          page,
          limit,
          parameter("q", "query", "collab", "Recherche dans l'identifiant, le fichier ou la catégorie."),
          parameter("category", "query", "2023collab", "Catégorie déduite du nom de fichier."),
        ],
        response: listResponse({
          id: "sticker-2023collab-1",
          filename: "sticker_2023collab_1.png",
          category: "2023collab",
          image: "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/Stickers/sticker_2023collab_1.png",
        }),
      }),
      [`${api}/stickers/{id}`]: detail("Stickers", "Afficher un sticker", "sticker-2023collab-1", {
        name: "id",
        description: "Identifiant du sticker construit depuis son nom de fichier.",
      }),
      [`${api}/shuffle`]: operation("Shuffle", "Lister et filtrer les assets Pokémon Shuffle associés", {
        parameters: [
          page,
          limit,
          parameter("q", "query", "bulbasaur", "Recherche dans le nom du fichier."),
          parameter("state", "query", "shadow", "État : normal, event, shadow, purified, mega, dynamax ou gigantamax."),
          parameter("form", "query", "alola", "Forme JSON à laquelle l'asset est associé."),
          parameter("shiny", "query", true, "Limiter aux assets chromatiques.", { type: "boolean" }),
        ],
        response: listResponse({
          pokemon: { key: "BULBASAUR", formId: "BULBASAUR", dexId: "0001", form: "normal" },
          asset: {
            id: "0001_bulbasaur_shadow",
            filename: "0001_bulbasaur_shadow.png",
            state: "shadow",
            shiny: false,
          },
        }),
      }),
      [`${api}/shuffle/{identifier}`]: detail("Shuffle", "Afficher les assets Shuffle d'une fiche", "venusaur-mega"),
      [`${api}/collection/checklist`]: operation("Collection", "Créer une checklist de collection", {
        parameters: [
          parameter("shiny", "query", true, "Uniquement les shiny sortis.", { type: "boolean" }),
          parameter("shadow", "query", false, "Uniquement les formes obscures.", { type: "boolean" }),
          parameter("shadowShiny", "query", true, "Uniquement les Obscurs chromatiques sortis.", { type: "boolean" }),
          parameter("tradable", "query", true, "Uniquement les Pokémon échangeables.", { type: "boolean" }),
        ],
        response: listResponse(),
      }),
      [`${api}/evolutions/special`]: operation("Évolutions", "Lister les évolutions spéciales", {
        parameters: [parameter("kind", "query", "item", "Condition : item ou buddy.", { enum: ["item", "buddy"] })],
        response: listResponse(),
      }),
      [`${api}/raid/counters/{defenderType}`]: detail("Raid", "Suggérer des contres selon le type du boss", "FIRE", {
        name: "defenderType",
        description: "Type principal du boss en anglais.",
        parameters: [limit],
        response: listResponse(),
      }),
      [`${api}/meta/filters`]: operation("Métadonnées", "Lister toutes les valeurs de filtre disponibles", { errors: false }),
    },
    components: {
      securitySchemes: {
        AdminSecret: {
          type: "apiKey",
          in: "header",
          name: "x-api-admin-secret",
          description:
            "Secret serveur requis pour les routes privées, internes ou d'écriture.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              required: ["code", "message", "requestId"],
              properties: {
                code: { type: "string", example: "POKEMON_NOT_FOUND" },
                message: { type: "string", example: "Pokémon introuvable : missingno" },
                requestId: { type: "string", format: "uuid" },
              },
            },
          },
        },
        DataResponse: {
          type: "object",
          properties: { data: { type: "object", additionalProperties: true } },
        },
        PaginatedResponse: {
          type: "object",
          properties: {
            data: { type: "array", items: { type: "object", additionalProperties: true } },
            meta: {
              type: "object",
              properties: {
                page: { type: "integer", example: 1 },
                limit: { type: "integer", example: 25 },
                total: { type: "integer", example: 1416 },
                pages: { type: "integer", example: 57 },
              },
            },
          },
        },
      },
    },
  };

  for (const [path, methods] of Object.entries(specification.paths)) {
    const operation = methods.get;
    operation.operationId = `get-${path
      .replace(/^\//, "")
      .replace(/[{}]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")}`;

    let examplePath = path;
    const query = new URLSearchParams();
    for (const item of operation.parameters || []) {
      if (item.example === undefined) continue;
      if (item.in === "path") {
        examplePath = examplePath.replace(`{${item.name}}`, encodeURIComponent(String(item.example)));
      }
      if (item.in === "query" && item.required) query.set(item.name, String(item.example));
    }
    const relativeUrl = `${examplePath}${query.size ? `?${query}` : ""}`;
    const absoluteUrl = `${env.publicUrl}${relativeUrl}`;
    operation["x-codeSamples"] = [
      { lang: "Shell", label: "curl", source: `curl "${absoluteUrl}"` },
      {
        lang: "JavaScript",
        label: "JavaScript",
        source: `const response = await fetch("${absoluteUrl}");\nconst result = await response.json();\nconsole.log(result);`,
      },
      {
        lang: "Python",
        label: "Python",
        source: `import requests\n\nresult = requests.get("${absoluteUrl}").json()\nprint(result)`,
      },
    ];
  }

  specification["x-tagGroups"] = [
    { name: "Commencer", tags: ["System", "Recherche"] },
    { name: "Pokédex", tags: ["Pokémon", "Évolutions", "Méga", "Dynamax", "Gigantamax", "Shadow", "Assets", "Backgrounds", "Candy", "Stickers", "Shuffle"] },
    { name: "Combat", tags: ["PvP", "Raid", "Attaques", "Types", "Statistiques", "Comparaison"] },
    { name: "Univers", tags: ["Régions", "Générations", "Collection"] },
    { name: "Données vivantes", tags: ["Items", "Rocket Texts"] },
    { name: "Métadonnées publiques", tags: ["Métadonnées"] },
  ];

  return specification;
}

module.exports = { createOpenApi };
