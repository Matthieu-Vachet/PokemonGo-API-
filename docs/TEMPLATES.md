# Templates Pokemon GO API

Ce fichier regroupe les templates a copier pour ajouter ou normaliser les donnees.
Le format de reference est construit a partir de:

- `data/pokemon/0001-bulbasaur.json`: Pokemon de base avec evolution.
- `data/pokemon/0002-ivysaur.json`: Pokemon intermediaire avec evolution.
- `data/pokemon/0003-venusaur.json`: Pokemon final avec Mega-Evolution et Gigantamax.

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
  "form": "normal",
  "region": {
    "id": "",
    "slug": "",
    "generation": null,
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
  "pvp": {},
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

Ajouter uniquement les ligues pour lesquelles la fiche contient des donnees. Un Pokemon
peut donc avoir uniquement `greatLeague`, tandis qu'un autre peut avoir `littleCup`,
`greatLeague`, `ultraLeague` et `masterLeague`.

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
  "id": "",
  "slug": "",
  "formId": "",
  "form": "normal",
  "candies": null,
  "item": null,
  "quests": []
}
```

Regles selon le stade:

- Pokemon de base: `evolutions` contient au moins une evolution.
- Pokemon intermediaire: `evolutions` contient au moins une evolution.
- Pokemon final: `evolutions` vaut `[]`.
- Pokemon sans evolution: `evolutions` vaut `[]`.

## Bloc Mega / Primo

A ajouter dans `megaEvolutions` avec l'identifiant de la forme comme cle.

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
    "primaryType": {},
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
Lorsqu'une forme existe, `megaEvolutions` est un objet indexe par identifiant.

## Bloc Forme Regionale

`regionForms` suit la meme logique que `megaEvolutions`: tableau vide lorsqu'aucune forme
n'existe, sinon objet indexe par `formId`. Une forme regionale reprend le template Pokemon
complet et utilise une valeur `form` comme `alola`, `galar`, `hisui` ou `paldea`.

## Gigantamax

Lorsqu'une forme Gigantamax existe:

- `hasGigantamaxEvolution` vaut `true`.
- `availability.gigantamax` indique si elle est disponible.
- `assetForms` contient une entree avec `"form": "gigantamax"`.

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
- Les attaques contiennent `id`, `slug`, donnees PvE, type, traductions et donnees PvP.
- Les evolutions contiennent `id`, `slug`, `formId`, `form`, `candies`, `item` et `quests`.
- Les profils base et intermediaire possedent au moins une evolution.
- Les formes regionales, Mega, Primo et Gigantamax suivent leur template dedie.
