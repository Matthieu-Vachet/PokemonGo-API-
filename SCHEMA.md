# Pokemon GO API — Schema

## Structure du projet

```bash
pokemon-go-api/
│
├── data/
│   ├── pokemon/
│   ├── moves/
│   ├── types/
│   └── items/
│
├── locales/
│   ├── fr/
│   └── en/
│
└── assets/
```

---

# Règles importantes

## Langue interne

Toutes les données techniques doivent être en anglais.

Exemple :

```json
"type": "grass"
```

Jamais :

```json
"type": "Plante"
```

---

## Traductions

Toutes les traductions doivent être dans :

```bash
locales/
```

---

## Slugs

Les slugs doivent :

- être uniques
- être en anglais
- être en minuscules
- utiliser des tirets

Exemple :

```json
"slug": "mega-charizard-x"
```

---

## Dossiers Pokémon

Chaque Pokémon ET chaque variante possède son propre dossier.

Exemple :

```bash
0006-charizard/
0006-mega-charizard-x/
0006-shadow-charizard/
```

---

# Structure Pokémon

## pokemon.json

```json
{
  "id": 6,

  "dexId": "0006",

  "slug": "charizard",

  "family": "charizard",

  "form": "normal",

  "variant": "normal",

  "generation": 1,

  "category": "flame-pokemon",

  "types": [
    "fire",
    "flying"
  ],

  "stats": {
    "attack": 223,
    "defense": 173,
    "stamina": 186
  },

  "cp": {
    "level40": 2889,
    "level50": 3266
  },

  "buddy": {
    "distanceKm": 3
  },

  "gender": {
    "male": 87.5,
    "female": 12.5
  },

  "catch": {
    "baseCatchRate": 5,
    "baseFleeRate": 5
  },

  "availability": {
    "released": true,
    "shiny": true,
    "shadow": true,
    "purified": true,
    "mega": true,
    "dynamax": true,
    "gigantamax": true
  },

  "weatherBoost": [
    "sunny",
    "windy"
  ],

  "evolution": {
    "from": {
      "id": 5,
      "slug": "charmeleon"
    },

    "to": []
  },

  "forms": [
    "charizard",
    "mega-charizard-x",
    "mega-charizard-y",
    "gigantamax-charizard",
    "shadow-charizard"
  ],

  "images": {
    "official": "/assets/images/pokemon/0006.png",
    "shiny": "/assets/images/pokemon/shiny/0006.png"
  }
}
```

---

# Structure moves.json

```json
{
  "fast": [
    "fire-spin",
    "air-slash"
  ],

  "charged": [
    "blast-burn",
    "dragon-claw"
  ],

  "elite": [],

  "bestMoveset": {
    "fast": "fire-spin",

    "charged": "blast-burn",

    "dps": 15.8,

    "tdo": 450.2
  }
}
```

---

# Structure counters.json

```json
{
  "weakTo": [
    "rock",
    "electric",
    "water"
  ],

  "resistances": [
    "fire",
    "grass",
    "bug"
  ],

  "bestCounters": [
    {
      "slug": "rampardos",

      "fastMove": "smack-down",

      "chargedMove": "rock-slide"
    }
  ]
}
```

---

# Structure pvp.json

```json
{
  "littleCup": {},

  "greatLeague": {},

  "ultraLeague": {},

  "masterLeague": {}
}
```

---

# Structure iv-chart.json

```json
[
  {
    "level": 1,

    "cp": 15
  }
]
```

---

# Structure metadata.json

```json
{
  "createdAt": "",

  "updatedAt": "",

  "source": "Pokemon GO Hub",

  "version": "1.0.0"
}
```

---

# Structure Moves

## data/moves/fire-spin.json

```json
{
  "slug": "fire-spin",

  "type": "fire",

  "category": "fast",

  "power": 14,

  "energy": 10,

  "cooldown": 1100
}
```

---

# Structure Types

## data/types/fire.json

```json
{
  "slug": "fire",

  "weakTo": [
    "water",
    "ground",
    "rock"
  ],

  "resistances": [
    "fire",
    "grass",
    "ice",
    "bug",
    "steel",
    "fairy"
  ]
}
```

---

# Internationalisation

## locales/fr/pokemon.json

```json
{
  "charizard": "Dracaufeu"
}
```

---

## locales/fr/moves.json

```json
{
  "fire-spin": "Danse Flammes"
}
```

---

## locales/fr/types.json

```json
{
  "fire": "Feu"
}
```

---

## locales/fr/forms.json

```json
{
  "normal": "Normal",

  "mega": "Méga",

  "shadow": "Obscur",

  "gigantamax": "Gigamax"
}
```

---

## locales/fr/variants.json

```json
{
  "mega-charizard-x": "Méga-Dracaufeu X"
}
```

---

# Conventions

## Toujours utiliser :

- snake-case interdit
- camelCase autorisé
- kebab-case pour slugs

---

# Exemple

## BON

```json
"mega-charizard-x"
```

## MAUVAIS

```json
"mega_charizard_x"
```

---

# Objectif du projet

Créer une base de données Pokémon GO :

- scalable
- maintenable
- multilingue
- API-ready
- frontend-ready
- backend-ready