---
id: RULE-TEMPLATE-001
title: Templates Pokemon GO API
status: active
lang: fr
version: 1.20.0
updated_at: 2026-08-08
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
related:
  - DATASET-POKEMON-001
  - RULE-ENTITY-CATEGORY-001
---

# Templates Pokemon GO API

Ce fichier regroupe les templates a copier pour ajouter ou normaliser les donnees.
Les fichiers sources vivent dans le depot prive `PokemonGo-Data`.
Le format de reference est construit a partir de:

- `PokemonGo-Data/pokemon/0001-bulbasaur.json`: Pokemon de base avec evolution.
- `PokemonGo-Data/pokemon/0002-ivysaur.json`: Pokemon intermediaire avec evolution.
- `PokemonGo-Data/pokemon/0003-venusaur.json`: Pokemon final avec Mega-Evolution et Gigantamax.

## Pokemon

Nom du fichier:

```text
PokemonGo-Data/pokemon/[dexId]-[slug].json
```

Exemple:

```text
PokemonGo-Data/pokemon/0001-bulbasaur.json
```

Template complet:

```json
{
  "id": "",
  "formId": "",
  "slug": "",
  "dexNr": null,
  "dexId": "",
  "regionId": "",
  "names": {
    "English": "",
    "German": "",
    "French": "",
    "Italian": "",
    "Japanese": "",
    "Korean": "",
    "Spanish": ""
  },
  "form": "normal",
  "size": {
    "height": null,
    "weight": null
  },
  "weatherBoost": [],
  "buddyDistance": null,
  "catchRate": null,
  "fleeRate": null,
  "captureRewards": {
    "candy": null,
    "stardust": null
  },
  "megaEnergyReward": null,
  "secondChargeMoveCost": {
    "candy": null,
    "stardust": null
  },
  "availability": {
    "released": false,
    "shinyReleased": false,
    "shadowShinyReleased": false,
    "tradable": true,
    "pokemonHomeTransfer": true,
    "shadow": false,
    "dynamax": false,
    "gigantamax": false,
    "apex": false
  },
  "shinyAvailability": {
    "releaseDate": null,
    "event": null,
    "source": "https://www.margxt.fr/guide-liste-des-pokemon-shiny-disponibles-dans-pokemon-go/",
    "matchedName": null
  },
  "shadowShinyAvailability": {
    "releaseDate": null,
    "event": null,
    "source": "https://www.margxt.fr/liste-des-pokemon-obscurs-et-chromatiques-shiny-dans-pokemon-go/",
    "matchedName": null
  },
  "maxCp": {
    "maxLevel50": null,
    "maxLevel40": null,
    "weatherBoostLevel25": null,
    "raidLevel20": null,
    "researchLevel15": null
  },
  "pvpRef": "pvp/pokemon/normal/0001-bulbasaur.pvp.json",
  "stats": {
    "stamina": null,
    "attack": null,
    "defense": null
  },
  "primaryType": "",
  "secondaryType": null,
  "pokemonClass": null,
  "quickMoves": [],
  "cinematicMoves": [],
  "eliteQuickMoves": [],
  "eliteCinematicMoves": [],
  "assets": {
    "image": "",
    "shinyImage": "",
    "candy": null,
    "assetsRef": "pokemon-assets/core/normal/0001-bulbasaur.assets.json"
  },
  "regionForms": [],
  "evolutions": [],
  "hasMegaEvolution": false,
  "megaEvolutions": [],
  "dynamaxForms": [],
  "hasGigantamaxEvolution": false,
  "gigantamaxForms": []
}
```

## Template Core Assets

À placer dans `PokemonGo-Data/pokemon-assets/core/<catégorie>/[dexId]-[identité].assets.json`.
Les catégories autorisées sont `normal`, `forms`, `mega`, `dynamax` et `gigantamax`.
Le Core ne référence que les familles secondaires réellement présentes ; voir
`ENTITY-CATEGORY-ARCHITECTURE.md`.

```json
{
  "schemaVersion": 1,
  "id": "BULBASAUR",
  "formId": "BULBASAUR",
  "baseFormId": "BULBASAUR",
  "form": "normal",
  "slug": "bulbasaur",
  "dexNr": 1,
  "dexId": "0001",
  "assets": {
    "image": "https://example.invalid/bulbasaur.png",
    "shinyImage": "https://example.invalid/bulbasaur-shiny.png",
    "portrait": null,
    "portraitShiny": null,
    "candy": null
  },
  "assetRefs": {
    "home": "pokemon-assets/home/normal/0001-bulbasaur.home.json",
    "shuffle": "pokemon-assets/shuffle/normal/0001-bulbasaur.shuffle.json",
    "variants": "pokemon-assets/variants/normal/0001-bulbasaur.variants.json",
    "location-cards": "pokemon-assets/location-cards/normal/0001-bulbasaur.location-cards.json"
  }
}
```

## Bloc Type

A utiliser pour `primaryType`, `secondaryType` et le type d'une attaque. La valeur
reference un fichier de `data/types/`.

```json
{
  "primaryType": "GRASS",
  "secondaryType": "POISON",
  "type": "GRASS"
}
```

Pour un Pokemon mono-type:

```json
{
  "secondaryType": null
}
```

## References D'Attaques

Les fiches Pokemon stockent uniquement les identifiants. Les details complets sont dans
`data/moves/`.

```json
{
  "quickMoves": ["VINE_WHIP_FAST", "TACKLE_FAST"],
  "cinematicMoves": ["SLUDGE_BOMB", "SEED_BOMB"],
  "eliteQuickMoves": [],
  "eliteCinematicMoves": ["FRENZY_PLANT"]
}
```

## Bloc PvP

A placer dans `pvp.littleCup`, `pvp.greatLeague`, `pvp.ultraLeague` ou `pvp.masterLeague`.

```json
{
  "tierRank": "",
  "rank1": {
    "ivs": {
      "attack": null,
      "defense": null,
      "stamina": null
    },
    "level": null,
    "cp": null
  },
  "bestMovesets": {
    "fast": "",
    "charged": []
  }
}
```

`pvp` peut valoir `null`. Sinon, conserver les quatre cles de ligue et utiliser `null`
pour chaque ligue non applicable.

## Attaques Elite

Lorsqu'aucune attaque Elite n'existe, utiliser un tableau vide:

```json
{
  "eliteQuickMoves": [],
  "eliteCinematicMoves": []
}
```

Lorsqu'elles existent, ajouter simplement leurs identifiants dans le tableau approprie.

## Bloc Evolution

A ajouter dans `evolutions`.

```json
{
  "targetFormId": "",
  "candies": null,
  "item": null,
  "quests": []
}
```

`targetFormId` peut referencer une fiche qui sera ajoutee plus tard, par exemple
`IVYSAUR_DYNAMAX`.

Regles selon le stade:

- Pokemon de base: `evolutions` contient au moins une evolution.
- Pokemon intermediaire: `evolutions` contient au moins une evolution.
- Pokemon final: `evolutions` vaut `[]`.
- Pokemon sans evolution: `evolutions` vaut `[]`.

## Bloc Mega / Primo

A créer dans `data/pokemon-forms/`, puis ajouter son `formId` à la liste
`megaEvolutions` de la fiche principale.

```json
{
  "VENUSAUR_MEGA": {
    "id": "VENUSAUR_MEGA",
    "slug": "venusaur_mega",
    "formId": "VENUSAUR_MEGA",
    "form": "mega",
    "names": {
      "English": "",
      "German": "",
      "French": "",
      "Italian": "",
      "Japanese": "",
      "Korean": "",
      "Spanish": ""
    },
    "size": {
      "height": null,
      "weight": null
    },
    "catchRate": null,
    "fleeRate": null,
    "availability": {
      "released": false,
      "shinyReleased": false,
      "shadowShinyReleased": false,
      "tradable": true,
      "pokemonHomeTransfer": true
    },
    "shinyAvailability": {
      "releaseDate": null,
      "event": null,
      "source": "https://www.margxt.fr/guide-liste-des-pokemon-shiny-disponibles-dans-pokemon-go/",
      "matchedName": null
    },
    "shadowShinyAvailability": {
      "releaseDate": null,
      "event": null,
      "source": "https://www.margxt.fr/liste-des-pokemon-obscurs-et-chromatiques-shiny-dans-pokemon-go/",
      "matchedName": null
    },
    "maxCp": {
      "maxLevel50": null,
      "maxLevel40": null,
      "weatherBoostLevel25": null,
      "raidLevel20": null,
      "researchLevel15": null
    },
    "stats": {
      "stamina": null,
      "attack": null,
      "defense": null
    },
    "primaryType": "",
    "secondaryType": null,
    "megaEnergyCost": null,
    "assets": {
      "image": "",
      "shinyImage": "",
      "candy": null,
      "assetsRef": "pokemon-assets/core/mega/0003-venusaur-mega.assets.json"
    }
  }
}
```

`megaEvolutions` vaut `[]` lorsqu'aucune Mega-Evolution ou forme Primo n'existe.
Lorsqu'une forme existe, la liste contient uniquement son `formId`.

## Bloc Forme Regionale

`regionForms` suit la meme logique que `megaEvolutions`: tableau vide lorsqu'aucune forme
n'existe, sinon objet indexe par `formId`. Une forme regionale reprend le template Pokemon
complet, utilise une valeur `form` comme `alola`, `galar`, `hisui` ou `paldea`, et
référence sa région avec `regionId`.

## Dynamax Et Gigantamax

Ces formes vivent dans `data/pokemon-forms/dynamax/` ou
`data/pokemon-forms/gigantamax/`. Elles heritent du Pokemon normal et ne repetent que les
champs differents.

```json
{
  "id": "VENUSAUR",
  "formId": "VENUSAUR_GIGANTAMAX",
  "slug": "venusaur-gigantamax",
  "dexNr": 3,
  "dexId": "0003",
  "form": "gigantamax",
  "baseFormId": "VENUSAUR",
  "maxCp": {
    "maxLevel50": null,
    "maxLevel40": null,
    "maxBattlesLevel20": null
  },
  "maxBattle": {
    "moves": ["GMAX_VINE_LASH"]
  },
  "assets": {
    "image": "",
    "shinyImage": ""
  }
}
```

Pour une forme Dynamax, utiliser `"form": "dynamax"` et des references vers
`data/moves/max/`. Pour une forme Gigantamax, utiliser `"form": "gigantamax"` et des
references vers `data/moves/gmax/`. Leur bloc `maxCp` contient uniquement
`maxLevel50`, `maxLevel40` et `maxBattlesLevel20`.

Le bloc `assets` de la fiche Max conserve seulement `image`, `shinyImage`, `candy` et
`assetsRef`. Les assets Shuffle ou portraits vivent dans le fichier lourd référencé.
Une forme
Dynamax conserve également son tableau `evolutions`.

## Bloc Variant Asset

À ajouter dans `pokemon-assets/variants/<catégorie>/*.variants.json -> variants` pour les
costumes, formes visuelles ou variantes femelles. Aucun fichier n’est créé si la liste
est vide.

```json
{
  "form": null,
  "costume": null,
  "isFemale": false,
  "image": "",
  "shinyImage": ""
}
```

## Type

Entrée individuelle du catalogue `data/types/<slug>.json`. L'index
`data/types/types.json` est conservé pour compatibilité.

```json
{
  "id": "",
  "slug": "",
  "type": "",
  "names": {},
  "doubleDamageFrom": [],
  "halfDamageFrom": [],
  "noDamageFrom": [],
  "weatherBoost": "",
  "assets": {
    "icon": "",
    "background": ""
  }
}
```

`weatherBoost` référence une entrée de `data/weather/`. Les traductions et l'icône de
la météo ne doivent pas être recopiées dans le type.

## Checklist Avant Ajout

- Le fichier est nomme avec `dexId` + `slug`.
- Le JSON est valide.
- Les identifiants techniques restent en majuscules.
- Le slug est en minuscules et en anglais.
- Les langues de `names` sont toutes presentes.
- Les tableaux vides sont `[]`, les valeurs inconnues sont `null`.
- Les fiches complètes référencent `data/generations/` avec `regionId`.
- Les Pokémon et les types référencent `data/weather/` avec leurs identifiants.
- Les assets principaux et chromatiques sont renseignes quand ils existent.
- Les attaques contiennent `id`, `slug`, donnees PvE, identifiant de type, traductions et donnees PvP.
- Les evolutions contiennent `targetFormId`, `candies`, `item` et `quests`.
- Les profils base et intermediaire possedent au moins une evolution.
- Les formes regionales, Mega, Primo, Dynamax et Gigantamax suivent leur template dedie.
