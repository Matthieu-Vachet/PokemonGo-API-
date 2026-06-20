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
    "tradable": true,
    "pokemonHomeTransfer": true,
    "shadow": false,
    "dynamax": false,
    "gigantamax": false,
    "apex": false
  },
  "maxCp": {
    "maxLevel50": null,
    "maxLevel40": null,
    "weatherBoostLevel25": null,
    "raidLevel20": null,
    "researchLevel15": null
  },
  "pvp": {
    "littleCup": null,
    "greatLeague": null,
    "ultraLeague": null,
    "masterLeague": null
  },
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
    "locationCards": [
      {
        "id": "lc_CitySafari2023_barcelona_2023",
        "name": "City Safari Barcelona",
        "type": "location",
        "date": "October 13th - 14th 2023",
        "eligibleForms": ["Eevee (Explorer Hat)"],
        "image": "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/LocationCards/lc_CitySafari2023_barcelona_2023.png",
        "source": "https://www.serebii.net/pokemongo/backgrounds.shtml"
      }
    ],
    "shuffle": {
      "source": "pokemon-shuffle",
      "variants": [
        {
          "id": "0001_bulbasaur_shadow",
          "filename": "0001_bulbasaur_shadow.png",
          "image": "https://raw.githubusercontent.com/Matthieu-Vachet/PokemonGo-Assets-API/refs/heads/main/pokemonShuffle/0001_bulbasaur_shadow.png",
          "form": "normal",
          "state": "shadow",
          "codes": ["bulbasaur", "shadow"],
          "tags": ["bulbasaur"],
          "shiny": false
        }
      ]
    }
  },
  "regionForms": [],
  "evolutions": [],
  "hasMegaEvolution": false,
  "megaEvolutions": [],
  "hasGigantamaxEvolution": false,
  "assetForms": []
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
      "tradable": true,
      "pokemonHomeTransfer": true
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
    "energyCost": null,
    "assets": {
      "image": "",
      "shinyImage": ""
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

Le bloc `assets` est obligatoire sur chaque fiche Max et peut contenir uniquement
`shuffle` lorsqu'aucune image Pokémon GO propre à cette forme n'existe. Une forme
Dynamax conserve également son tableau `evolutions`.

## Bloc Asset Form

A ajouter dans `assetForms` pour les costumes, formes visuelles ou variantes femelles.

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
