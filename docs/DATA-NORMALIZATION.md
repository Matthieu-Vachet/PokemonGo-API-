# Normalisation Des Donnees

Les sources JSON restent lisibles a la main, mais les informations repetables sont
centralisees pour eviter les doublons et faciliter la maintenance.

## Attaques

Les details des attaques sont centralises dans `PokemonGo-Data/moves/`.

- `PokemonGo-Data/moves/fast/`
- `PokemonGo-Data/moves/charged/`
- `PokemonGo-Data/moves/fast_elite/`
- `PokemonGo-Data/moves/charged_elite/`
- `PokemonGo-Data/moves/max/`
- `PokemonGo-Data/moves/gmax/`

Les fiches Pokemon et leurs formes stockent uniquement des identifiants dans :

- `quickMoves`
- `cinematicMoves`
- `eliteQuickMoves`
- `eliteCinematicMoves`
- `maxBattle.moves`

L'API recompose les details centralises via :

```http
GET /api/v1/pokemon/{identifier}/moves
```

## Types

Les types complets vivent dans `PokemonGo-Data/types/`. Les Pokemon et les attaques utilisent
uniquement l'identifiant court :

```json
{
  "primaryType": "GRASS",
  "secondaryType": "POISON",
  "type": "GRASS"
}
```

`secondaryType` vaut `null` pour un Pokemon mono-type. La sync accepte encore les anciens
objets `{ "type": "POKEMON_TYPE_GRASS", "names": {} }`, mais les migrations ecrivent le
format normalise.

Chaque entrée possède un fichier `PokemonGo-Data/types/<slug>.json`, un `id` technique stable et un `slug`
public. Les attaques possedent aussi un `id` stable, un slug avec tirets et, si necessaire,
`legacySlugs` pour garder les anciennes URL compatibles.

`PokemonGo-Data/types/types.json` reste généré comme index de compatibilité. Les nouveaux outils
lisent les fichiers individuels afin qu'un type puisse être modifié sans toucher les 17 autres.

## Régions Et Générations

Les traductions et le numéro de génération vivent uniquement dans `PokemonGo-Data/generations/`.
Une fiche Pokémon complète stocke la référence stable :

```json
{
  "regionId": "KANTO"
}
```

Les formes Méga, Dynamax et Gigantamax héritent cette référence de leur `baseFormId`.
La lecture des sources, l'API et la checklist recomposent automatiquement `region` et
`generation`.

## Météo

Les sept météos Pokémon GO vivent dans `PokemonGo-Data/weather/`. Chaque entrée contient ses
traductions, son icône et les identifiants des types boostés. Les Pokémon utilisent
`weatherBoost: string[]`; chaque type utilise `weatherBoost: string`.

## PvP Nullable

`pvp` peut valoir `null` lorsqu'aucune information PvP n'est utile. Sinon, les quatre
ligues sont explicites et chaque ligue peut valoir `null`.

```json
{
  "pvp": {
    "littleCup": null,
    "greatLeague": {
      "tierRank": "F",
      "rank1": {
        "ivs": { "attack": 15, "defense": 15, "stamina": 15 },
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

## Dynamax Et Gigantamax

Les formes Dynamax et Gigantamax ne dupliquent plus toute la fiche Pokemon. Elles
referencent la fiche normale via `baseFormId`, gardent leur propre `formId` et leur
propre `slug`, puis ne stockent que les donnees propres au combat Max.

```json
{
  "id": "BULBASAUR",
  "formId": "BULBASAUR_DYNAMAX",
  "slug": "bulbasaur-dynamax",
  "dexNr": 1,
  "dexId": "0001",
  "form": "dynamax",
  "baseFormId": "BULBASAUR",
  "maxCp": {
    "maxLevel50": 1260,
    "maxLevel40": 1115,
    "maxBattlesLevel20": 637
  },
  "maxBattle": {
    "moves": ["MAX_OVERGROWTH", "MAX_STRIKE"]
  },
  "evolutions": [
    {
      "targetFormId": "IVYSAUR_DYNAMAX",
      "candies": 25,
      "item": null,
      "quests": []
    }
  ]
}
```

Le bloc `maxCp` d'une forme Dynamax ou Gigantamax est propre a cette fiche et ne contient
que `maxLevel50`, `maxLevel40` et `maxBattlesLevel20`. Il n'herite jamais du bloc `maxCp`
normal dans l'API ou la checklist.

Les liens d'evolution utilisent `targetFormId`. Une cible future comme
`IVYSAUR_DYNAMAX` est valide meme si la fiche n'existe pas encore.

## Controles

```bash
npm run audit:moves
npm run audit:weather
npm run audit:identifiers
npm run sync:dry
npm test
```

`audit:moves` parcourt aussi les formes imbriquees, les attaques Max/G-Max et refuse les
references absentes du catalogue.

## Outils De Migration

```bash
npm run migrate:moves:catalog
npm run migrate:moves
npm run migrate:types
npm run migrate:max-forms
npm run migrate:regions
npm run migrate:weather
```

Ces commandes fonctionnent en simulation. Les variantes `:write` ecrivent uniquement
apres validation complete de toutes les sources.
