---
id: DATASET-POKEMON-001
title: Schéma canonique Pokemon GO
status: canonical
lang: fr
version: 1.21.0
updated_at: 2026-08-09
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
  - Dashboard Admin
related:
  - ADR-CANONICAL-001
  - RULE-NORMALIZATION-001
  - API-PUBLIC-001
---

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
| `baseFormId` | string | Identifiant de l'espèce de base. Pour une fiche normale, il est identique à `formId`. |
| `slug` | string | Slug public lisible dans les URLs et fichiers. |
| `dexNr` | number | Numero Pokedex numerique. |
| `dexId` | string | Numero Pokedex formate sur 4 chiffres. |
| `names` | object | Noms localises par langue. |
| `form` | string | Forme technique en minuscules, ex. `normal`, `alola`, `mega`. |
| `regionId` | string | Référence vers la région centrale de `PokemonGo-Data/generations/`. |
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
Ces champs referencent les identifiants courts de `PokemonGo-Data/types/`.

```json
{
  "primaryType": "GRASS",
  "secondaryType": "POISON"
}
```

### Gameplay General

| Champ | Type | Description |
| --- | --- | --- |
| `weatherBoost` | string[] | Références vers les identifiants de `PokemonGo-Data/weather/`. |
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
    "shadowShinyReleased": true,
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
| `shadowShinyReleased` | Version Obscure chromatique disponible. |
| `tradable` | Pokemon echangeable. |
| `pokemonHomeTransfer` | Transferable vers Pokemon HOME. |
| `shadow` | Existe en version Obscure. |
| `dynamax` | Compatible Dynamax. |
| `gigantamax` | Compatible Gigamax. |
| `apex` | Existe en version Apex. |

Les dates et événements de sortie chromatique sont stockés hors de `availability`
pour garder les booléens simples. La vérité de sortie reste uniquement dans
`availability.shinyReleased` et `availability.shadowShinyReleased` :

```json
{
  "shinyAvailability": {
    "releaseDate": "2018-03-25",
    "event": "Community Day",
    "source": "https://www.margxt.fr/guide-liste-des-pokemon-shiny-disponibles-dans-pokemon-go/",
    "matchedName": "Bulbizarre"
  },
  "shadowShinyAvailability": {
    "releaseDate": null,
    "event": null,
    "source": "https://www.margxt.fr/liste-des-pokemon-obscurs-et-chromatiques-shiny-dans-pokemon-go/",
    "matchedName": null
  }
}
```

### Shadow / Obscur

Le bloc `shadow` existe uniquement lorsque `availability.shadow` vaut `true`.
Il ne contient aucun asset visuel tant qu'aucune collection d'images Shadow n'est disponible.

```json
{
  "shadow": {
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
le même numéro Pokédex. Les coûts de purification et les Catch CP restent au niveau
global quand ils sont identiques pour toutes les variantes, afin d'éviter les doublons.

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
    "researchLevel15": 477,
    "maxBattlesLevel20": null
  }
}
```

`maxCp.maxBattlesLevel20` vaut `null` pour les fiches qui ne sont pas des rencontres
Dynamax/Gigamax. Le validateur accepte donc `number` ou `null`.

## Attaques

Les Pokemon stockent uniquement les identifiants de leurs attaques. Les details complets
sont centralises dans `PokemonGo-Data/moves/`.

```json
{
  "quickMoves": ["VINE_WHIP_FAST", "TACKLE_FAST"],
  "cinematicMoves": ["SLUDGE_BOMB", "SEED_BOMB", "POWER_WHIP"],
  "eliteQuickMoves": [],
  "eliteCinematicMoves": [],
  "legacyQuickMoves": [],
  "legacyCinematicMoves": [],
  "maxBattle": {
    "moves": []
  }
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

- `PokemonGo-Data/moves/fast/`
- `PokemonGo-Data/moves/charged/`
- `PokemonGo-Data/moves/fast_elite/`
- `PokemonGo-Data/moves/charged_elite/`
- `PokemonGo-Data/moves/max/`
- `PokemonGo-Data/moves/gmax/`

`maxBattle.moves` contient les attaques Max ou G-Max quand la fiche est compatible. Il
reste present avec `[]` sur les fiches non Max pour garder un pattern uniforme.

## PvP séparé

`pvpRef` vaut `null` ou référence une fiche
`pvp/pokemon/<catégorie>/<fichier>.pvp.json`. La fiche séparée porte les quatre ligues,
les profils Rank 1, les movesets réellement observés, la provenance PvPoke et les
statuts `RANKED`, `NOT_RANKED`, `UNSUPPORTED_FORM` ou `MAPPING_MISSING`. Une absence ne
doit jamais être convertie en classement artificiel.

```json
{
  "pvpRef": "pvp/pokemon/normal/0001-bulbasaur.pvp.json"
}
```

L’API peut produire une projection `pvp` dérivée pour compatibilité de lecture, mais
elle n’est pas stockée dans la fiche Pokémon canonique.
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

Lorsque `hasGigantamaxEvolution` vaut `true`, `gigantamaxForms` pointe vers les fiches
Gigamax séparées. Les visuels Gigamax lourds vivent dans le fichier
`pokemon-assets/core/gigantamax/*.assets.json`. Le champ `availability.gigantamax` indique
séparément si cette forme est disponible dans Pokemon GO.

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
- Mega: `megaEnergyCost`.
- Référence d’assets : `assetsRef` à la racine ; les images vivent dans le Core.

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
  "assetsRef": "pokemon-assets/core/gigantamax/0003-venusaur-gigantamax.assets.json"
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
| `maxBattle.moves` | string[] | References vers `PokemonGo-Data/moves/max/` ou `PokemonGo-Data/moves/gmax/`. |

`maxCp` est obligatoire sur les formes Dynamax et Gigantamax et contient uniquement
`maxLevel50`, `maxLevel40` et `maxBattlesLevel20`. Les champs propres aux Pokemon normaux,
comme `weatherBoostLevel25`, `raidLevel20` et `researchLevel15`, ne doivent pas y figurer.

`assetsRef` est obligatoire afin que chaque fiche Max référence ses propres visuels disponibles.
Une forme Dynamax conserve aussi son tableau `evolutions`. Les autres champs qui changent
reellement, comme `availability`, `names`, `stats` ou les types, peuvent etre ajoutes a la
forme et sont valides lorsqu'ils existent.

## Assets

La fiche Pokemon principale ne garde qu’un pointeur racine vers son Core :

```json
{
  "assetsRef": "pokemon-assets/core/normal/0001-bulbasaur.assets.json"
}
```

Le Core correspondant vit dans `PokemonGo-Data/pokemon-assets/core/<catégorie>/` et dans
MongoDB `pokemonAssets.data`. Les payloads HOME, Shuffle, Variants et Location Cards sont
des documents séparés référencés par `assetRefs` et persistés dans
`pokemonAssetFamilies` :

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
    "image": "https://raw.githubusercontent.com/.../pokemon/0001.png",
    "shinyImage": "https://raw.githubusercontent.com/.../pokemon/0001-shiny.png",
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

| Champ | Type | Description |
| --- | --- | --- |
| `assetsRef` | string | Chemin racine vers le Core `pokemon-assets/core/<catégorie>/*.assets.json`. |
| Core `assets.image` | string/null | Image principale, stockée uniquement dans le Core. |
| Core `assets.shinyImage` | string/null | Image chromatique principale, stockée uniquement dans le Core. |
| Core `assets.candy` | object/null | Bonbon, XL et couleurs, stockés uniquement dans le Core. |

Les assets sont séparés par famille et catégorie dans `PokemonGo-Data/pokemon-assets`.
Les routes de détail et le Dashboard hydratent le Core depuis `assetsRef`, puis
les familles depuis ses `assetRefs`. La convention complète est décrite dans
`docs/ENTITY-CATEGORY-ARCHITECTURE.md`.

| Champ asset lourd | Type | Description |
| --- | --- | --- |
| `assets.home.image` | string/null | Image principale issue de Pokémon Home. |
| `assets.home.shinyImage` | string/null | Image chromatique principale issue de Pokémon Home. |
| `assets.portrait` | string/null | Portrait dédié d'une Méga-Évolution ou Primo-Résurgence. |
| `assets.portraitShiny` | string/null | Portrait chromatique dédié d'une Méga ou Primo. |
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

Une fiche principale ne doit jamais réembarquer `assets.image`, `assets.shinyImage`,
`assets.candy` ou les couleurs. Les visuels principaux, bonbons et portraits vivent
dans le Core ; HOME, Shuffle, Location Cards et Variants vivent dans leurs familles.

Les types vivent dans `PokemonGo-Data/types/<slug>.json`. Leur bloc `assets` contient `icon` et
`background`. `PokemonGo-Data/types/types.json` reste un index complet compatible avec les anciens
consommateurs. Leur champ `weatherBoost` contient un identifiant de `PokemonGo-Data/weather/`.

Les sept météos vivent dans `PokemonGo-Data/weather/<slug>.json`. Chaque entrée possède `id`,
`slug`, `names`, `assets.icon` et `boostedTypes`. `PokemonGo-Data/weather/weather.json` reste
l'index complet de compatibilité.

Le catalogue `PokemonGo-Data/stickers/stickers.json` expose pour chaque sticker `id`, `filename`,
`category` et `image`.

## Formes Separees

Les fiches de `PokemonGo-Data/pokemon-forms/` couvrent les formes Alola, Galar, Hisui, Paldea,
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
  "baseFormId": "BULBASAUR",
  "form": "normal",
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
    "shadowShinyReleased": false,
    "tradable": true,
    "pokemonHomeTransfer": true,
    "shadow": true,
    "dynamax": true,
    "gigantamax": false,
    "apex": false
  },
  "shinyAvailability": {
    "releaseDate": "2018-03-25",
    "event": "Community Day",
    "source": "https://www.margxt.fr/guide-liste-des-pokemon-shiny-disponibles-dans-pokemon-go/",
    "matchedName": "Bulbizarre"
  },
  "shadowShinyAvailability": {
    "releaseDate": null,
    "event": null,
    "source": "https://www.margxt.fr/liste-des-pokemon-obscurs-et-chromatiques-shiny-dans-pokemon-go/",
    "matchedName": null
  },
  "shadow": null,
  "maxCp": {
    "maxLevel50": 1260,
    "maxLevel40": 1115,
    "weatherBoostLevel25": 796,
    "raidLevel20": 637,
    "researchLevel15": 477,
    "maxBattlesLevel20": null
  },
  "pvpRef": "pvp/pokemon/normal/0001-bulbasaur.pvp.json",
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
  "maxBattle": {
    "moves": []
  },
  "assetsRef": "pokemon-assets/core/normal/0001-bulbasaur.assets.json",
  "regionForms": [],
  "evolutions": [],
  "hasMegaEvolution": false,
  "megaEvolutions": [],
  "dynamaxForms": [],
  "hasGigantamaxEvolution": false,
  "gigantamaxForms": []
}
```
