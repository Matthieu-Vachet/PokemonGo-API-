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
  },
  move: {
    id: "BLAST_BURN",
    slug: "blast-burn",
    kind: "charged",
    elite: true,
    type: "FIRE",
    names: { English: "Blast Burn", French: "Rafale Feu" },
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
      version: "1.0.0",
      description:
        "Référence complète de l'API Pokémon GO francophone. Chaque route contient des exemples fonctionnels. Pour exécuter les requêtes depuis le navigateur, utilisez [Swagger UI](/swagger).",
      license: { name: "ISC" },
    },
    servers: [{ url: env.publicUrl, description: env.isProduction ? "Production" : "Local" }],
    tags: [
      ["System", "État et découverte de l'API."],
      ["Pokémon", "Pokédex, formes, filtres et PC."],
      ["Recherche", "Recherche globale multilingue."],
      ["Évolutions", "Évolutions directes, chaînes et conditions."],
      ["Méga", "Méga-Évolutions et Primo-Résurgences."],
      ["Gigantamax", "Formes Gigantamax."],
      ["PvP", "Classements, IV et movesets par ligue."],
      ["Attaques", "Attaques rapides, chargées et élite."],
      ["Types", "Types, faiblesses, résistances et Pokémon associés."],
      ["Régions", "Régions et Pokémon associés."],
      ["Générations", "Générations et Pokémon associés."],
      ["Comparaison", "Comparaison de Pokémon."],
      ["Statistiques", "Statistiques globales et classements."],
      ["Collection", "Routes adaptées aux outils de collection."],
      ["Raid", "Suggestions de contres Raid."],
      ["Assets", "Images et variantes visuelles."],
      ["Métadonnées", "Filtres disponibles et synchronisation."],
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
        parameter("shinyReleased", "query", true, "Filtrer les shiny sortis.", { type: "boolean" }),
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
      [`${api}/gigantamax`]: list("Gigantamax", "Lister les Gigantamax"),
      [`${api}/gigantamax/{identifier}`]: detail("Gigantamax", "Afficher un Gigantamax", "charizard"),
      [`${api}/regional`]: list("Pokémon", "Lister les formes régionales"),
      [`${api}/regional/{identifier}`]: detail("Pokémon", "Afficher une forme régionale", "raichu", { parameters: [parameter("form", "query", "alola", "Forme régionale souhaitée.")] }),
      [`${api}/types`]: operation("Types", "Lister les 18 types", { response: dataResponse([{ id: "FIRE", names: { English: "Fire", French: "Feu" } }]) }),
      [`${api}/types/{identifier}`]: detail("Types", "Afficher faiblesses et résistances d'un type", "FIRE", { description: "ID du type en anglais.", response: dataResponse({ id: "FIRE", names: { English: "Fire", French: "Feu" } }) }),
      [`${api}/types/{identifier}/pokemon`]: detail("Types", "Lister les Pokémon d'un type", "FIRE", { description: "ID du type en anglais.", response: listResponse() }),
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
        description: "released, shinyReleased, tradable, pokemonHomeTransfer, shadow, apex, dynamax, gigantamax ou mega.",
        response: listResponse(),
      }),
      [`${api}/weather/{weather}/pokemon`]: detail("Pokémon", "Lister les Pokémon boostés par une météo", "sunny", {
        name: "weather",
        description: "Identifiant météo utilisé dans les JSON.",
        response: listResponse(),
      }),
      [`${api}/assets/{identifier}`]: detail("Assets", "Afficher les images normales, shiny et variantes", "pikachu"),
      [`${api}/collection/checklist`]: operation("Collection", "Créer une checklist de collection", {
        parameters: [
          parameter("shiny", "query", true, "Uniquement les shiny sortis.", { type: "boolean" }),
          parameter("shadow", "query", false, "Uniquement les formes obscures.", { type: "boolean" }),
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
      [`${api}/meta/sync`]: operation("Métadonnées", "Afficher la dernière synchronisation MongoDB", { errors: false }),
    },
    components: {
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
    { name: "Pokédex", tags: ["Pokémon", "Évolutions", "Méga", "Gigantamax", "Assets"] },
    { name: "Combat", tags: ["PvP", "Raid", "Attaques", "Types", "Statistiques", "Comparaison"] },
    { name: "Univers", tags: ["Régions", "Générations", "Collection"] },
    { name: "Administration", tags: ["Métadonnées"] },
  ];

  return specification;
}

module.exports = { createOpenApi };
