# Pokemon GO API - Schema

Ce document decrit le format de reference des fichiers JSON Pokemon.
Ces fichiers vivent dans le depot prive `PokemonGo-Data`. Le modele actuel est base sur
`0001-bulbasaur.json`, `0002-ivysaur.json` et
`0003-venusaur.json`. Ces trois fiches couvrent les profils de base, intermediaire et final,
ainsi que les Mega-Evolutions, Gigantamax, attaques Elite et formes visuelles.

## Organisation

```text
PokemonGo-Data/
├── pokemon/
│   ├── 0001-bulbasaur.json
│   ├── 0002-ivysaur.json
│   └── 0003-venusaur.json
├── pokemon-forms/
│   ├── alola/
│   ├── galar/
│   ├── hisui/
│   ├── paldea/
│   ├── dynamax/
│   ├── gigantamax/
│   ├── mega/
│   ├── mega-x/
│   └── mega-y/
├── moves/
│   ├── fast/
│   ├── charged/
│   ├── fast_elite/
│   ├── charged_elite/
│   ├── max/
│   └── gmax/
└── types/
```

## Regles Generales

Chaque Pokemon est stocke dans `PokemonGo-Data/pokemon/[dexId]-[slug].json`.

Exemple:

```text
PokemonGo-Data/pokemon/0001-bulbasaur.json
PokemonGo-Data/pokemon/0002-ivysaur.json
```

Les identifiants techniques issus du Game Master restent en majuscules:

```json
{
  "id": "BULBASAUR",
  "formId": "BULBASAUR",
  "form": "normal"
}
```

Les slugs restent en anglais, en minuscules, sans accents et avec des tirets:

```json
{
  "slug": "bulbasaur"
}
```

Les noms affichables sont regroupes dans `names`. Les types referencent leur catalogue
central par identifiant court:

```json
{
  "names": {
    "English": "Bulbasaur",
    "French": "Bulbizarre"
  },
  "primaryType": "GRASS"
}
```

Les valeurs inconnues ou non applicables utilisent `null`. Les listes vides utilisent `[]`.

## Schema Pokemon

### Identite

| Champ | Type | Description |
| --- | --- | --- |
| `id` | string | Identifiant technique principal, ex. `BULBASAUR`. |
| `formId` | string | Identifiant technique de la forme. |
| `slug` | string | Slug public lisible dans les URLs et fichiers. |
| `dexNr` | number | Numero Pokedex numerique. |
| `dexId` | string | Numero Pokedex formate sur 4 chiffres. |
| `names` | object | Noms localises par langue. |
| `form` | string | Forme technique en minuscules, ex. `normal`, `alola`, `mega`. |
| `regionId` | string | Référence vers la région centrale de `data/generations/`. |
| `pokemonClass` | string/null | Classe speciale si disponible, sinon `null`. |

L'API et la checklist recomposent `region` et `generation` depuis `regionId`. Les formes
Méga, Dynamax et Gigantamax héritent cette référence de leur fiche de base.

### Langues Supportees

Les objets de noms utilisent ces cles:

```json
{
  "English": "",
  "German": "",
  "French": "",
  "Italian": "",
  "Japanese": "",
  "Korean": "",
  "Spanish": ""
}
```

### Mensurations

| Champ | Type | Description |
| --- | --- | --- |
| `size.height` | number | Taille en metres. |
| `size.weight` | number | Poids en kilogrammes. |

### Types

`primaryType` est obligatoire. `secondaryType` vaut `null` pour un Pokemon mono-type.
Ces champs referencent les identifiants courts de `data/types/`.

```json
{
  "primaryType": "GRASS",
  "secondaryType": "POISON"
}
```

### Gameplay General

| Champ | Type | Description |
| --- | --- | --- |
| `weatherBoost` | string[] | Références vers les identifiants de `data/weather/`. |
| `buddyDistance` | number | Distance en km pour obtenir un bonbon. |
| `catchRate` | number | Taux de capture de base. |
| `fleeRate` | number | Taux de fuite de base. |
| `captureRewards.candy` | number | Bonbons gagnes a la capture. |
| `captureRewards.stardust` | number | Poussieres d'etoile gagnees a la capture. |
| `megaEnergyReward` | number/null | Energie Mega gagnee si applicable. |
| `secondChargeMoveCost.candy` | number | Cout en bonbons de la deuxieme attaque chargee. |
| `secondChargeMoveCost.stardust` | number | Cout en poussieres de la deuxieme attaque chargee. |

### Disponibilite

```json
{
  "availability": {
    "released": true,
    "shinyReleased": true,
    "tradable": true,
    "pokemonHomeTransfer": true,
    "shadow": true,
    "dynamax": true,
    "gigantamax": false,
    "apex": false
  }
}
```

| Champ | Description |
| --- | --- |
| `released` | Disponible dans Pokemon GO. |
| `shinyReleased` | Version chromatique disponible. |
| `tradable` | Pokemon echangeable. |
| `pokemonHomeTransfer` | Transferable vers Pokemon HOME. |
| `shadow` | Existe en version Obscure. |
| `dynamax` | Compatible Dynamax. |
| `gigantamax` | Compatible Gigamax. |
| `apex` | Existe en version Apex. |

### Shadow / Obscur

Le bloc `shadow` existe uniquement lorsque `availability.shadow` vaut `true`.
Il ne contient aucun asset visuel tant qu'aucune collection d'images Shadow n'est disponible.

```json
{
  "shadow": {
    "released": true,
    "firstReleaseDate": "2019-07-22",
    "purificationCost": { "stardust": 3000, "candy": 3 },
    "catchCp": {
      "normal": { "min": 198, "max": 251 },
      "weatherBoosted": { "min": 348, "max": 414 }
    },
    "variants": [
      {
        "name": "Bulbasaur",
        "variant": "normal",
        "releaseDate": "2019-07-22",
        "releaseDateText": "July 22, 2019"
      }
    ],
    "source": "https://bulbapedia.bulbagarden.net/wiki/List_of_Shadow_Pok%C3%A9mon_in_Pok%C3%A9mon_GO"
  }
}
```

`variants[]` conserve séparément les formes régionales, Apex et costumées partageant
le même numéro Pokédex, ainsi que leurs propres coûts et Catch CP.

### Stats Et CP

```json
{
  "stats": {
    "stamina": 128,
    "attack": 118,
    "defense": 111
  },
  "maxCp": {
    "maxLevel50": 1260,
    "maxLevel40": 1115,
    "weatherBoostLevel25": 796,
    "raidLevel20": 637,
    "researchLevel15": 477
  }
}
```

## Attaques

Les Pokemon stockent uniquement les identifiants de leurs attaques. Les details complets
sont centralises dans `data/moves/`.

```json
{
  "quickMoves": ["VINE_WHIP_FAST", "TACKLE_FAST"],
  "cinematicMoves": ["SLUDGE_BOMB", "SEED_BOMB", "POWER_WHIP"],
  "eliteQuickMoves": [],
  "eliteCinematicMoves": []
}
```

Chaque fichier du catalogue central contient :

| Champ catalogue | Type | Description |
| --- | --- | --- |
| `id` | string | Identifiant technique de l'attaque. |
| `slug` | string | Slug anglais de l'attaque. |
| `legacySlugs` | string[] | Anciens slugs encore acceptes par l'API. |
| `power` | number | Puissance en raid/arene. |
| `energy` | number | Energie gagnee ou consommee en raid/arene. |
| `durationMs` | number | Duree de l'attaque en millisecondes. |
| `type` | string | Identifiant court du type, ex. `GRASS`. |
| `names` | object | Noms localises de l'attaque. |
| `combat.energy` | number | Energie gagnee ou consommee en PvP. |
| `combat.power` | number | Puissance en PvP. |
| `combat.turns` | number | Nombre de tours PvP. |
| `combat.buffs` | object/null | Buffs/debuffs PvP si disponibles. |

Les quatre tableaux peuvent etre vides uniquement lorsque le Pokemon ne possede aucune
attaque dans la categorie correspondante. Les references doivent exister dans :

- `data/moves/fast/`
- `data/moves/charged/`
- `data/moves/fast_elite/`
- `data/moves/charged_elite/`
- `data/moves/max/`
- `data/moves/gmax/`

## PvP

`pvp` peut valoir `null` si aucune information PvP n'est applicable. Sinon, les quatre
ligues sont explicites et chaque ligue peut valoir `null`.

```json
{
  "pvp": {
    "littleCup": null,
    "greatLeague": {
      "tierRank": "F",
      "rank1": {
        "ivs": {
          "attack": 15,
          "defense": 15,
          "stamina": 15
        },
        "level": 50,
        "cp": 1260
      },
      "bestMovesets": {
        "fast": "VINE_WHIP_FAST",
        "charged": ["POWER_WHIP", "SLUDGE_BOMB"]
      }
    },
    "ultraLeague": null,
    "masterLeague": null
  }
}
```

Ligues recommandees:

- `littleCup`
- `greatLeague`
- `ultraLeague`
- `masterLeague`

## Evolutions

```json
{
  "evolutions": [
    {
      "targetFormId": "IVYSAUR",
      "candies": 25,
      "item": null,
      "quests": []
    }
  ],
  "hasMegaEvolution": false,
  "megaEvolutions": [],
  "hasGigantamaxEvolution": false
}
```

| Champ | Type | Description |
| --- | --- | --- |
| `evolutions[].targetFormId` | string | `formId` exact de la fiche obtenue. La cible peut etre ajoutee plus tard. |
| `evolutions[].candies` | number/null | Cout en bonbons. |
| `evolutions[].item` | object/null | Objet requis et ses informations, si applicable. |
| `evolutions[].quests` | array | Conditions speciales d'evolution. |
| `hasMegaEvolution` | boolean | Indique si le Pokemon possede une Mega-Evolution. |
| `megaEvolutions` | string[] | Références `formId` vers les fiches Méga/Primo séparées. |
| `dynamaxForms` | string[] | Références `formId` vers les fiches Dynamax séparées. |
| `hasGigantamaxEvolution` | boolean | Indique si le Pokemon possede une forme Gigamax. |
| `gigantamaxForms` | string[] | Références `formId` vers les fiches Gigamax séparées. |

Lorsque `hasGigantamaxEvolution` vaut `true`, `assetForms` contient normalement une
entree avec `form: "gigantamax"`. Le champ `availability.gigantamax` indique separement
si cette forme est disponible dans Pokemon GO.

### Profils D'Evolution

| Profil | Regle |
| --- | --- |
| Base | Aucun predecesseur et au moins une entree dans `evolutions`. |
| Intermediaire | Possede un predecesseur et au moins une entree dans `evolutions`. |
| Final | Possede un predecesseur et `evolutions` vaut `[]`. |
| Sans evolution | Aucun predecesseur et `evolutions` vaut `[]`. |

### Schema Mega / Primo

Une entree de `megaEvolutions` contient:

- Identite: `id`, `slug`, `formId`, `form`, `dexNr`, `dexId`, `baseFormId` et `names`.
- Gameplay: `size`, `catchRate`, `fleeRate`, `availability`.
- Combat: `maxCp`, `stats`, `primaryType`, `secondaryType`.
- Mega: `energyCost`.
- Images: `assets.image`, `assets.shinyImage`.

`availability` d'une Mega contient `released`, `shinyReleased`, `tradable` et
`pokemonHomeTransfer`.

### Schema Dynamax / Gigantamax

Une forme Dynamax ou Gigantamax herite des donnees de sa fiche Pokemon normale. Elle ne
duplique que les informations propres au combat Max et garde sa propre identite publique.

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
    "maxLevel50": 3075,
    "maxLevel40": 2720,
    "maxBattlesLevel20": 1554
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

| Champ | Type | Description |
| --- | --- | --- |
| `formId` | string | Identifiant unique de cette fiche Max, par exemple `VENUSAUR_GIGANTAMAX`. |
| `slug` | string | Slug public unique de cette fiche, par exemple `venusaur-gigantamax`. |
| `baseFormId` | string | Identifiant du Pokemon normal de reference. |
| `maxCp.maxLevel50` | number | PC maximum au niveau 50 de cette fiche Max. |
| `maxCp.maxLevel40` | number | PC maximum au niveau 40 de cette fiche Max. |
| `maxCp.maxBattlesLevel20` | number/null | PC de rencontre en combat Max au niveau 20. |
| `maxBattle.moves` | string[] | References vers `data/moves/max/` ou `data/moves/gmax/`. |

`maxCp` est obligatoire sur les formes Dynamax et Gigantamax et contient uniquement
`maxLevel50`, `maxLevel40` et `maxBattlesLevel20`. Les champs propres aux Pokemon normaux,
comme `weatherBoostLevel25`, `raidLevel20` et `researchLevel15`, ne doivent pas y figurer.

`assets` est obligatoire afin que chaque fiche Max expose ses propres visuels disponibles.
Une forme Dynamax conserve aussi son tableau `evolutions`. Les autres champs qui changent
reellement, comme `availability`, `names`, `stats` ou les types, peuvent etre ajoutes a la
forme et sont valides lorsqu'ils existent.

## Assets

```json
{
  "assets": {
    "image": "https://raw.githubusercontent.com/.../pm1.icon.png",
    "shinyImage": "https://raw.githubusercontent.com/.../pm1.s.icon.png",
    "home": {
      "source": "pokemon-home",
      "image": "https://raw.githubusercontent.com/.../PokemonHd/poke_capture_0001_000_mf_n_00000000_f_n.png",
      "shinyImage": "https://raw.githubusercontent.com/.../PokemonHd/poke_capture_0001_000_mf_n_00000000_f_r.png",
      "variants": []
    },
    "locationCards": [
      {
        "id": "lc_GoFest2025_paris",
        "name": "Pokémon GO Fest 2025: Paris",
        "type": "location",
        "date": "June 13th - 15th 2025",
        "eligibleForms": ["Eevee (Explorer Hat)"],
        "image": "https://raw.githubusercontent.com/.../LocationCards/lc_GoFest2025_paris.png",
        "source": "https://www.serebii.net/pokemongo/backgrounds.shtml"
      }
    ]
  },
  "assetForms": [
    {
      "form": null,
      "costume": "JAN_2020_NOEVOLVE",
      "isFemale": false,
      "image": "https://raw.githubusercontent.com/.../pm1.cJAN_2020_NOEVOLVE.icon.png",
      "shinyImage": "https://raw.githubusercontent.com/.../pm1.cJAN_2020_NOEVOLVE.s.icon.png"
    }
  ]
}
```

| Champ | Type | Description |
| --- | --- | --- |
| `assets.image` | string | Image principale. |
| `assets.shinyImage` | string | Image chromatique principale. |
| `assets.portrait` | string | Portrait dédié d'une Méga-Évolution ou Primo-Résurgence. |
| `assets.portraitShiny` | string | Portrait chromatique dédié d'une Méga ou Primo. |
| `assets.home.image` | string/null | Image principale issue de Pokémon Home. |
| `assets.home.shinyImage` | string/null | Image chromatique principale issue de Pokémon Home. |
| `assets.home.variants[]` | array | Toutes les variantes Home, identifiées par index de forme, genre, Gigantamax, détail et vue. |
| `assets.locationCards[]` | array | Backgrounds de lieu et spéciaux auxquels ce numéro Pokédex est éligible. |
| `assets.locationCards[].date` | string | Période exacte indiquée par la source. |
| `assets.locationCards[].eligibleForms` | string[] | Formes et costumes exacts éligibles pour ce Pokémon. |
| `assets.shuffle.source` | string | Origine du catalogue Pokémon Shuffle. |
| `assets.shuffle.variants[]` | array | Variantes Shuffle associées uniquement à cette fiche exacte. |
| `assets.shuffle.variants[].form` | string | Forme JSON cible : normal, alola, mega, dynamax, etc. |
| `assets.shuffle.variants[].state` | string | État visuel : normal, event, shadow, purified, mega, dynamax ou gigantamax. |
| `assets.shuffle.variants[].codes` | string[] | Codes bruts extraits du nom de fichier. |
| `assets.shuffle.variants[].tags` | string[] | Codes utiles sans l'état terminal ni `chromatique`. |
| `assets.shuffle.variants[].shiny` | boolean | Vrai lorsque le fichier se termine par `chromatique`. |

Un bloc `assets` peut ne contenir que `shuffle` sur une forme Max ou sur une fiche qui
n'est pas encore sortie dans Pokémon GO. Une fiche normale, régionale, Méga ou Primo
déjà sortie doit toujours conserver `assets.image` et `assets.shinyImage`. Les assets
Shadow et purifiés sont conservés ensemble sur la fiche exacte de la forme concernée.

Les types vivent dans `data/types/<slug>.json`. Leur bloc `assets` contient `icon` et
`background`. `data/types/types.json` reste un index complet compatible avec les anciens
consommateurs. Leur champ `weatherBoost` contient un identifiant de `data/weather/`.

Les sept météos vivent dans `data/weather/<slug>.json`. Chaque entrée possède `id`,
`slug`, `names`, `assets.icon` et `boostedTypes`. `data/weather/weather.json` reste
l'index complet de compatibilité.

Le catalogue `data/stickers/stickers.json` expose pour chaque sticker `id`, `filename`,
`category` et `image`.
| `assetForms[].form` | string/null | Forme associee a l'asset. |
| `assetForms[].costume` | string/null | Costume associe a l'asset. |
| `assetForms[].isFemale` | boolean | Variante visuelle femelle. |
| `assetForms[].image` | string | Image de la variante. |
| `assetForms[].shinyImage` | string | Image chromatique de la variante. |
| `regionForms` | string[] | Références `formId` vers les fiches de formes séparées. |

## Formes Separees

Les fiches de `data/pokemon-forms/` couvrent les formes Alola, Galar, Hisui, Paldea,
Dynamax, Gigantamax, Mega et Mega X/Y.

- Une forme regionale utilise le schema Pokemon complet.
- Une forme Dynamax ou Gigantamax utilise le schema minimal `baseFormId` + `maxCp` + `maxBattle`.
- Une Mega ou forme Primo utilise le schema Mega / Primo.
- Les formes conservent leur propre `formId` et uniquement les champs qui different.

## Squelette Structurel

```json
{
  "id": "BULBASAUR",
  "formId": "BULBASAUR",
  "slug": "bulbasaur",
  "dexNr": 1,
  "dexId": "0001",
  "regionId": "KANTO",
  "names": {
    "English": "Bulbasaur",
    "German": "Bisasam",
    "French": "Bulbizarre",
    "Italian": "Bulbasaur",
    "Japanese": "フシギダネ",
    "Korean": "이상해씨",
    "Spanish": "Bulbasaur"
  },
  "form": "normal",
  "size": {
    "height": 0.7,
    "weight": 6.9
  },
  "weatherBoost": ["sunny", "cloudy"],
  "buddyDistance": 3,
  "catchRate": 20,
  "fleeRate": 0,
  "captureRewards": {
    "candy": 3,
    "stardust": 100
  },
  "megaEnergyReward": 15,
  "secondChargeMoveCost": {
    "candy": 25,
    "stardust": 10000
  },
  "availability": {
    "released": true,
    "shinyReleased": true,
    "tradable": true,
    "pokemonHomeTransfer": true,
    "shadow": true,
    "dynamax": true,
    "gigantamax": false,
    "apex": false
  },
  "maxCp": {
    "maxLevel50": 1260,
    "maxLevel40": 1115,
    "weatherBoostLevel25": 796,
    "raidLevel20": 637,
    "researchLevel15": 477
  },
  "pvp": {
    "littleCup": null,
    "greatLeague": null,
    "ultraLeague": null,
    "masterLeague": null
  },
  "stats": {
    "stamina": 128,
    "attack": 118,
    "defense": 111
  },
  "primaryType": "GRASS",
  "secondaryType": "POISON",
  "pokemonClass": null,
  "quickMoves": [],
  "cinematicMoves": [],
  "eliteQuickMoves": [],
  "eliteCinematicMoves": [],
  "assets": {
    "image": "",
    "shinyImage": ""
  },
  "regionForms": [],
  "evolutions": [],
  "hasMegaEvolution": false,
  "megaEvolutions": [],
  "hasGigantamaxEvolution": false,
  "assetForms": []
}
```
