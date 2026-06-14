# Normalisation Des Donnees

Les sources JSON restent lisibles a la main, mais les informations repetables sont
centralisees pour eviter les doublons et faciliter la maintenance.

## Attaques

Les details des attaques sont centralises dans `data/moves/`.

- `data/moves/fast/`
- `data/moves/charged/`
- `data/moves/fast_elite/`
- `data/moves/charged_elite/`
- `data/moves/max/`
- `data/moves/gmax/`

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

Les types complets vivent dans `data/types/`. Les Pokemon et les attaques utilisent
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

Chaque entrée possède un fichier `data/types/<slug>.json`, un `id` technique stable et un `slug`
public. Les attaques possedent aussi un `id` stable, un slug avec tirets et, si necessaire,
`legacySlugs` pour garder les anciennes URL compatibles.

`data/types/types.json` reste généré comme index de compatibilité. Les nouveaux outils
lisent les fichiers individuels afin qu'un type puisse être modifié sans toucher les 17 autres.

## Meteo

Les 7 conditions meteo vivent dans `data/weather/`. Les fiches Pokemon utilisent
uniquement leurs identifiants canoniques : `sunny`, `partlyCloudy`, `cloudy`, `rain`,
`snow`, `windy` et `fog`.

Chaque condition contient ses traductions, ses anciens aliases et les types renforces.
Les fichiers de types referencent uniquement l'identifiant meteo. La commande
`npm run migrate:weather:write` recalcule `weatherBoost` depuis les types primaire et
secondaire. Les formes Dynamax et Gigantamax minimales continuent d'heriter des types de
leur fiche normale.

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
  "generation": 1,
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
```

Ces commandes fonctionnent en simulation. Les variantes `:write` ecrivent uniquement
apres validation complete de toutes les sources.
