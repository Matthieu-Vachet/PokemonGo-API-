# Templates pour Pokémon GO API

## MOVE - Template vide

```json
{
  "id": "",
  "name": "",
  "type": "",
  "power": null,
  "accuracy": null,
  "category": ""
}
```

---

## TYPE - Template vide

```json
{
  "id": "",
  "name": "",
  "weaknesses": [],
  "strengths": [],
  "resistances": []
}
```

---

## POKEMON - Ensemble complet de fichiers

### 1. pokemon.json

```json
{
  "id": null,
  "dexId": "",
  "slug": "",
  "generation": null,
  "category": "",
  "types": [],
  "stats": {
    "attack": null,
    "defense": null,
    "stamina": null
  },
  "cp": {
    "level40": null,
    "level50": null
  },
  "buddy": {
    "distanceKm": null
  },
  "gender": {
    "male": null,
    "female": null
  },
  "catch": {
    "baseCatchRate": null,
    "baseFleeRate": null
  },
  "availability": {
    "released": true,
    "shiny": false,
    "shadow": false,
    "purified": false
  },
  "weatherBoost": [],
  "evolution": {
    "from": null,
    "to": []
  },
  "forms": [],
  "images": {
    "official": "",
    "shiny": ""
  }
}
```

### 2. metadata.json

```json
{
  "createdAt": "2026-05-23",
  "updatedAt": "2026-05-23",
  "source": "",
  "version": "1.0.0"
}
```

### 3. moves.json

```json
{
  "fast": [],
  "charged": [],
  "elite": [],
  "bestMoveset": {
    "fast": "",
    "charged": "",
    "dps": null,
    "tdo": null
  }
}
```

### 4. iv-chart.json

```json
[
  {
    "level": 1,
    "cp": null
  }
]
```

### 5. counters.json

```json
{
  "weakTo": [],
  "resistances": [],
  "bestCounters": [
    {
      "slug": "",
      "fastMove": "",
      "chargedMove": ""
    }
  ]
}
```

### 6. pvp.json

```json
{
  "littleCup": {
    "rank": null,
    "bestIv": "",
    "bestMoveset": []
  },
  "greatLeague": {
    "rank": null,
    "bestIv": ""
  },
  "ultraLeague": {
    "rank": null,
    "bestIv": ""
  },
  "masterLeague": {
    "rank": null,
    "bestIv": ""
  }
}
```

---

## Notes pour la structure de dossiers

Pour ajouter un nouveau Pokémon, crée un dossier: `data/pokemon/[DEXID]-[slug]/`

Exemple: `data/pokemon/0002-ivysaur/`

Puis ajoute les 6 fichiers JSON avec les templates ci-dessus.
