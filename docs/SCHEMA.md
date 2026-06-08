# Pokemon GO API - Schema

Ce document decrit le format de reference des fichiers JSON Pokemon.
Le modele actuel est base sur `0001-bulbasaur.json`, `0002-ivysaur.json` et
`0003-venusaur.json`. Ces trois fiches couvrent les profils de base, intermediaire et final,
ainsi que les Mega-Evolutions, Gigantamax, attaques Elite et formes visuelles.

## Organisation

```text
PokemonGo-API-/
├── app.js
├── data/
│   ├── pokemon/
│   │   ├── 0001-bulbasaur.json
│   │   ├── 0002-ivysaur.json
│   │   └── 0003-venusaur.json
│   ├── pokemon-forms/
│   │   ├── alola/
│   │   ├── galar/
│   │   ├── hisui/
│   │   ├── paldea/
│   │   ├── gigantamax/
│   │   ├── mega/
│   │   ├── mega-x/
│   │   └── mega-y/
│   └── types/
├── locales/
│   ├── en/
│   └── fr/
└── assets/
    └── images/
```

## Regles Generales

Chaque Pokemon est stocke dans `data/pokemon/[dexId]-[slug].json`.

Exemple:

```text
data/pokemon/0001-bulbasaur.json
data/pokemon/0002-ivysaur.json
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

Les noms affichables sont regroupes dans `names` ou dans les objets `type.names`:

```json
{
  "names": {
    "English": "Bulbasaur",
    "French": "Bulbizarre"
  }
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
| `generation` | number | Generation principale du Pokemon. |
| `names` | object | Noms localises par langue. |
| `form` | string | Forme technique en minuscules, ex. `normal`, `alola`, `mega`. |
| `region` | object | Region avec `id`, `slug`, `generation` et noms localises. |
| `pokemonClass` | string/null | Classe speciale si disponible, sinon `null`. |

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

```json
{
  "primaryType": {
    "type": "POKEMON_TYPE_GRASS",
    "names": {
      "English": "Grass",
      "French": "Plante"
    }
  },
  "secondaryType": {
    "type": "POKEMON_TYPE_POISON",
    "names": {
      "English": "Poison",
      "French": "Poison"
    }
  }
}
```

### Gameplay General

| Champ | Type | Description |
| --- | --- | --- |
| `weatherBoost` | string[] | Meteos qui boostent le Pokemon. |
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
| `power` | number | Puissance en raid/arene. |
| `energy` | number | Energie gagnee ou consommee en raid/arene. |
| `durationMs` | number | Duree de l'attaque en millisecondes. |
| `type` | object | Type de l'attaque avec traductions. |
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

## PvP

`pvp` est un objet dynamique par ligue. Seules les ligues possedant des donnees doivent
etre ajoutees. Il ne faut pas creer automatiquement `littleCup` pour un Pokemon qui ne
possede que `greatLeague`.

```json
{
  "pvp": {
    "littleCup": {
      "tierRank": "B",
      "rank1": {
        "ivs": {
          "attack": 0,
          "defense": 12,
          "stamina": 14
        },
        "level": 18,
        "cp": 500
      },
      "bestMovesets": {
        "fast": "VINE_WHIP_FAST",
        "charged": ["POWER_WHIP", "SLUDGE_BOMB"]
      }
    }
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
      "id": "IVYSAUR",
      "slug": "ivysaur",
      "formId": "IVYSAUR_NORMAL",
      "form": "normal",
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
| `evolutions[].id` | string | Identifiant technique du Pokemon obtenu. |
| `evolutions[].slug` | string | Slug du Pokemon obtenu. |
| `evolutions[].formId` | string | Identifiant de forme de l'evolution. |
| `evolutions[].form` | string | Forme du Pokemon obtenu. |
| `evolutions[].candies` | number/null | Cout en bonbons. |
| `evolutions[].item` | object/null | Objet requis et ses informations, si applicable. |
| `evolutions[].quests` | array | Conditions speciales d'evolution. |
| `hasMegaEvolution` | boolean | Indique si le Pokemon possede une Mega-Evolution. |
| `megaEvolutions` | array/object | `[]` sans Mega, sinon objet indexe par identifiant. |
| `hasGigantamaxEvolution` | boolean | Indique si le Pokemon possede une forme Gigamax. |

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

- Identite: `id`, `slug`, `formId`, `form`, `names`.
- Gameplay: `size`, `catchRate`, `fleeRate`, `availability`.
- Combat: `maxCp`, `stats`, `primaryType`, `secondaryType`.
- Mega: `energyCost`.
- Images: `assets.image`, `assets.shinyImage`.

`availability` d'une Mega contient `released`, `shinyReleased`, `tradable` et
`pokemonHomeTransfer`.

## Assets

```json
{
  "assets": {
    "image": "https://raw.githubusercontent.com/.../pm1.icon.png",
    "shinyImage": "https://raw.githubusercontent.com/.../pm1.s.icon.png"
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
| `assetForms[].form` | string/null | Forme associee a l'asset. |
| `assetForms[].costume` | string/null | Costume associe a l'asset. |
| `assetForms[].isFemale` | boolean | Variante visuelle femelle. |
| `assetForms[].image` | string | Image de la variante. |
| `assetForms[].shinyImage` | string | Image chromatique de la variante. |
| `regionForms` | array/object | `[]` sans forme, sinon objet indexe par `formId`. |

## Formes Separees

Les fiches de `data/pokemon-forms/` couvrent les formes Alola, Galar, Hisui, Paldea,
Gigantamax, Mega et Mega X/Y.

- Une forme regionale ou Gigantamax utilise le schema Pokemon complet.
- Une Mega ou forme Primo utilise le schema Mega / Primo.
- Les formes conservent leur propre `formId`, leurs types, attaques, evolutions et assets.

## Squelette Structurel

```json
{
  "id": "BULBASAUR",
  "formId": "BULBASAUR",
  "slug": "bulbasaur",
  "dexNr": 1,
  "dexId": "0001",
  "generation": 1,
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
  "region": {
    "id": "KANTO",
    "slug": "kanto",
    "generation": 1,
    "names": {}
  },
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
  "pvp": {},
  "stats": {
    "stamina": 128,
    "attack": 118,
    "defense": 111
  },
  "primaryType": {
    "type": "POKEMON_TYPE_GRASS",
    "names": {}
  },
  "secondaryType": {
    "type": "POKEMON_TYPE_POISON",
    "names": {}
  },
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
