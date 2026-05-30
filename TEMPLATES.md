# Templates Pokemon GO API

Ce fichier regroupe les templates a copier pour ajouter ou normaliser les donnees.
Le template Pokemon suit le nouveau format observe dans `data/pokemon/0001-bulbasaur.json`.

## Pokemon

Nom du fichier:

```text
data/pokemon/[dexId]-[slug].json
```

Exemple:

```text
data/pokemon/0001-bulbasaur.json
```

Template complet:

```json
{
  "id": "",
  "formId": "",
  "slug": "",
  "dexNr": null,
  "dexId": "",
  "generation": null,
  "names": {
    "English": "",
    "German": "",
    "French": "",
    "Italian": "",
    "Japanese": "",
    "Korean": "",
    "Spanish": ""
  },
  "form": "NORMAL",
  "region": null,
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
  "primaryType": {
    "type": "",
    "names": {
      "English": "",
      "German": "",
      "French": "",
      "Italian": "",
      "Japanese": "",
      "Korean": "",
      "Spanish": ""
    }
  },
  "secondaryType": null,
  "pokemonClass": null,
  "quickMoves": {},
  "cinematicMoves": {},
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

## Bloc Type

A utiliser pour `primaryType`, `secondaryType` et le type d'une attaque.

```json
{
  "type": "POKEMON_TYPE_GRASS",
  "names": {
    "English": "Grass",
    "German": "Pflanze",
    "French": "Plante",
    "Italian": "Erba",
    "Japanese": "くさ",
    "Korean": "풀",
    "Spanish": "Planta"
  }
}
```

Pour un Pokemon mono-type:

```json
{
  "secondaryType": null
}
```

## Bloc Attaque Rapide

A placer dans `quickMoves` avec l'identifiant de l'attaque comme cle.

```json
{
  "VINE_WHIP_FAST": {
    "id": "VINE_WHIP_FAST",
    "power": null,
    "energy": null,
    "durationMs": null,
    "type": {
      "type": "",
      "names": {
        "English": "",
        "German": "",
        "French": "",
        "Italian": "",
        "Japanese": "",
        "Korean": "",
        "Spanish": ""
      }
    },
    "names": {
      "English": "",
      "German": "",
      "French": "",
      "Italian": "",
      "Japanese": "",
      "Korean": "",
      "Spanish": ""
    },
    "combat": {
      "energy": null,
      "power": null,
      "turns": null,
      "buffs": null
    }
  }
}
```

## Bloc Attaque Chargee

A placer dans `cinematicMoves` avec l'identifiant de l'attaque comme cle.

```json
{
  "SLUDGE_BOMB": {
    "id": "SLUDGE_BOMB",
    "power": null,
    "energy": null,
    "durationMs": null,
    "type": {
      "type": "",
      "names": {
        "English": "",
        "German": "",
        "French": "",
        "Italian": "",
        "Japanese": "",
        "Korean": "",
        "Spanish": ""
      }
    },
    "names": {
      "English": "",
      "German": "",
      "French": "",
      "Italian": "",
      "Japanese": "",
      "Korean": "",
      "Spanish": ""
    },
    "combat": {
      "energy": null,
      "power": null,
      "turns": null,
      "buffs": null
    }
  }
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

Si aucune donnee n'est disponible pour une ligue, utiliser `null`.

## Bloc Evolution

A ajouter dans `evolutions`.

```json
{
  "id": "",
  "formId": "",
  "candies": null,
  "item": null,
  "quests": []
}
```

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

Template pour `data/types/*.json`.

```json
{
  "id": "",
  "name": "",
  "weaknesses": [],
  "strengths": [],
  "resistances": []
}
```

## Checklist Avant Ajout

- Le fichier est nomme avec `dexId` + `slug`.
- Le JSON est valide.
- Les identifiants techniques restent en majuscules.
- Le slug est en minuscules et en anglais.
- Les langues de `names` sont toutes presentes.
- Les tableaux vides sont `[]`, les valeurs inconnues sont `null`.
- Les assets principaux et chromatiques sont renseignes quand ils existent.
