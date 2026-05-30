# Pokemon GO API

Une base de donnees JSON structuree pour Pokemon GO, pensee pour alimenter une API, un site, un bot Discord, un outil PvP ou une application de collection.

Le projet contient les donnees Pokemon, les types, les traductions et les assets dans une structure simple a lire, facile a versionner et prete a exposer via Express.

## Points Forts

- Donnees Pokemon stockees en JSON, un fichier par espece ou forme.
- Schema enrichi inspire du Game Master Pokemon GO.
- Noms multilingues inclus directement dans les objets.
- Stats, CP max, couts, disponibilite, PvP, movesets et evolutions.
- Assets principaux, shiny, costumes et formes visuelles.
- Serveur Express minimal deja branche pour construire les routes API.

## Structure

```text
PokemonGo-API-/
├── app.js
├── data/
│   ├── pokemon/
│   │   ├── 0001-bulbasaur.json
│   │   └── 0002-ivysaur.json
│   └── types/
├── locales/
│   ├── en/
│   └── fr/
├── assets/
│   └── images/
├── SCHEMA.md
├── TEMPLATES.md
└── package.json
```

## Installation

```bash
npm install
```

## Demarrage

```bash
npm start
```

Mode developpement avec auto-reload:

```bash
npm run dev
```

Par defaut, le serveur demarre sur le port `3000`.

```text
http://localhost:3000
```

## Exemple De Donnee

Les fichiers Pokemon vivent dans `data/pokemon/`.

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
    "French": "Bulbizarre"
  },
  "form": "NORMAL",
  "weatherBoost": ["sunny", "cloudy"],
  "stats": {
    "stamina": 128,
    "attack": 118,
    "defense": 111
  },
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

Le schema complet est documente dans [SCHEMA.md](SCHEMA.md).
Les templates de creation sont disponibles dans [TEMPLATES.md](TEMPLATES.md).

## Format Des Fichiers Pokemon

Chaque fichier suit le nommage:

```text
data/pokemon/[dexId]-[slug].json
```

Exemple:

```text
data/pokemon/0001-bulbasaur.json
```

Les grandes sections du JSON sont:

| Section | Contenu |
| --- | --- |
| Identite | `id`, `formId`, `slug`, `dexNr`, `dexId`, `generation`, `form`, `region` |
| Noms | `names` avec les langues principales |
| Gameplay | `weatherBoost`, `buddyDistance`, `catchRate`, `fleeRate`, `captureRewards` |
| Disponibilite | shiny, shadow, trade, Pokemon HOME, Dynamax, Gigamax, Apex |
| Combat | `stats`, `maxCp`, `quickMoves`, `cinematicMoves`, moves Elite |
| PvP | ranks par ligue, IVs rang 1, movesets recommandes |
| Evolutions | couts, objets, quetes, Mega-Evolutions, Gigamax |
| Assets | images principales, shiny, costumes, formes alternatives |

## Scripts

```bash
npm start
```

Lance le serveur avec Node.

```bash
npm run dev
```

Lance le serveur avec Nodemon.

Les scripts `scrape*` sont declares dans `package.json` pour les imports de donnees, mais ils dependent du script d'import correspondant.

## Ajouter Un Pokemon

1. Creer un fichier dans `data/pokemon/`.
2. Utiliser le template Pokemon dans [TEMPLATES.md](TEMPLATES.md).
3. Renseigner les identifiants techniques en majuscules.
4. Garder le slug en anglais, en minuscules et avec des tirets.
5. Verifier que le JSON est valide.
6. Ajouter les assets et les evolutions si disponibles.

## Conventions

- `null` pour une valeur inconnue ou non applicable.
- `[]` pour une liste vide.
- Identifiants techniques Pokemon GO en majuscules.
- Slugs publics en anglais et en minuscules.
- Images Pokemon via `assets.image`, `assets.shinyImage` et `assetForms`.
- Traductions principales dans les objets `names`.

## Roadmap Possible

- Ajouter des routes REST pour exposer `data/pokemon`.
- Ajouter une recherche par slug, nom, type et generation.
- Generer un index global au demarrage.
- Ajouter une validation automatique du schema.
- Publier une documentation d'endpoints quand l'API sera branchee.

## Licence

Projet sous licence ISC.
