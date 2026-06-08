# Pokemon GO API

API REST publique, multilingue et versionnee pour Pokemon GO, alimentee par une base de
donnees JSON structuree. Elle est pensee pour servir durablement un Pokedex, un bot
Discord, un site, une application mobile, des outils PvP, Raid et collection.

Le backend de production vit dans `src/`. Les checklists restent des outils independants
pour enrichir les fiches, tandis que MongoDB Atlas fournit les recherches, filtres et
classements rapides de l'API. La synchronisation ne modifie jamais les JSON sources.

Documentation detaillee de l'API : [docs/API.md](docs/API.md)

## Points Forts

- Donnees Pokemon stockees en JSON, un fichier par espece ou forme.
- Schema enrichi inspire du Game Master Pokemon GO.
- Noms multilingues inclus directement dans les objets.
- Stats, CP max, couts, disponibilite, PvP, movesets et evolutions.
- Profils d'evolution distincts: base, intermediaire, final et sans evolution.
- Formes Alola, Galar, Hisui, Paldea, Gigantamax, Mega et Primo.
- Assets principaux, shiny, costumes et formes visuelles.
- API Express securisee, compressee, mise en cache et documentee avec OpenAPI.
- Synchronisation incrementale JSON vers MongoDB avec detection des changements.
- Recherche multilingue, pagination, tris et filtres combinables.
- Routes Pokemon, formes, attaques, PvP, evolutions, Raid, assets et statistiques.
- Schemas MongoDB flexibles pour accepter les futurs champs JSON.

## Structure

```text
PokemonGo-API-/
├── app.js
├── api/                       # Fonctions serverless Vercel
├── src/
│   ├── config/
│   ├── docs/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── sync/
├── apps/
│   └── checklist/
│       ├── server/            # Moteur, auth et serveur local
│       ├── index.html
│       ├── manifest.json
│       └── sw.js
├── scripts/
│   ├── import/
│   └── sync/
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
├── attaque/                   # JSON des attaques
├── config/                    # Configuration Atlas Search
├── docs/
│   ├── API.md
│   ├── GIT-WORKFLOW.md
│   ├── PROJECT-STRUCTURE.md
│   ├── SCHEMA.md
│   └── TEMPLATES.md
├── test/
└── package.json
```

Le rôle détaillé de chaque dossier est expliqué dans
[docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md).

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner ensuite `MONGODB_URI` dans `.env`, puis synchroniser les donnees :

```bash
npm run sync
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
http://localhost:3000/api-docs
http://localhost:3000/swagger
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
  "form": "normal",
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

Le schema complet est documente dans [docs/SCHEMA.md](docs/SCHEMA.md).
Les templates de creation sont disponibles dans [docs/TEMPLATES.md](docs/TEMPLATES.md).

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
| Identite | `id`, `formId`, `slug`, `dexNr`, `dexId`, `generation`, `form`, `region`, `pokemonClass` |
| Noms | `names` avec les langues principales |
| Gameplay | `size`, `weatherBoost`, `buddyDistance`, `catchRate`, `fleeRate`, `captureRewards`, `megaEnergyReward`, `secondChargeMoveCost` |
| Disponibilite | `availability`: shiny, shadow, trade, Pokemon HOME, Dynamax, Gigamax, Apex |
| Combat | `stats`, `maxCp`, `quickMoves`, `cinematicMoves`, moves Elite |
| PvP | ranks par ligue, IVs rang 1, movesets recommandes |
| Evolutions | `evolutions`, `hasMegaEvolution`, `megaEvolutions`, `hasGigantamaxEvolution` |
| Assets | images principales, shiny, costumes, formes alternatives |
| Formes | variantes regionales, Gigantamax, Mega et Primo |

Les references principales du schema sont:

- `0001-bulbasaur.json`: profil de base.
- `0002-ivysaur.json`: profil intermediaire.
- `0003-venusaur.json`: profil final avec Mega-Evolution et Gigantamax.

## Scripts

```bash
npm start
```

Lance le serveur avec Node.

```bash
npm run dev
```

Lance le serveur avec Nodemon.

```bash
npm run checklist
```

Lance la checklist Pokedex sur `http://localhost:3003`. Elle valide recursivement les
blocs JSON, les types de valeurs, les traductions, les attaques, les evolutions et toutes
les formes. Elle propose une vue detaillee des donnees, un design
responsive pour ordinateur, tablette et mobile, ainsi qu'un acces depuis les appareils
connectes au meme reseau local. L'adresse mobile exacte est affichee au demarrage.

La fiche detaillee contient aussi un tableau des PC minimum (`0/0/0`) et maximum
(`15/15/15`) pour chaque demi-niveau de 1 a 50. Le calcul utilise les statistiques de
base, les IV et les multiplicateurs de niveau dans `src/lib/pokemon-cp.js`.

La checklist ecoute par defaut sur le reseau local. Pour limiter temporairement l'acces
au Mac:

```bash
CHECKLIST_HOST=127.0.0.1 npm run checklist
```

## Deploiement Vercel

La checklist est prete pour un deploiement Vercel sans serveur local permanent.

Les commandes pour gerer `main`, `develop`, les branches `feature` et les rebases sans
GitKraken sont documentees dans [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

1. Importer le depot GitHub dans Vercel.
2. Conserver les reglages de build automatiques.
3. Deployer le projet.

Vercel sert la checklist a la racine du domaine et expose les fonctions serverless:

- `/api/checklist-v3`
- `/api/detail-v3`
- `/api/v1` pour l'API REST MongoDB
- `/api-docs` pour la documentation moderne
- `/swagger` pour la console interactive

Configurer `MONGODB_URI`, `NODE_ENV=production` et `API_PUBLIC_URL` dans les variables
d'environnement Vercel. Les pushes GitHub redeploient automatiquement le projet lorsque
l'integration GitHub est active.

Les API exigent la variable d'environnement Vercel `CHECKLIST_PASSWORD`. Le navigateur
demande ce mot de passe et le conserve localement. Les acces directs aux donnees JSON,
aux sources et au moteur interne de la checklist sont bloques.

La progression manuelle est stockee dans `localStorage`. Elle reste disponible sur le
meme navigateur, mais n'est pas synchronisee automatiquement entre plusieurs appareils.

Les outils d'import et d'extraction manuels vivent dans `scripts/import/`.

## Ajouter Un Pokemon

1. Creer un fichier dans `data/pokemon/`.
2. Utiliser le template Pokemon dans [docs/TEMPLATES.md](docs/TEMPLATES.md).
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
- `regionForms` et `megaEvolutions` valent `[]` lorsqu'ils sont vides, sinon ce sont des objets indexes.
- `eliteQuickMoves` et `eliteCinematicMoves` valent `[]` lorsqu'ils sont vides, sinon ce sont des objets indexes.
- Le contenu de `pvp` depend des ligues reellement documentees pour la fiche.
- `hasGigantamaxEvolution: true` implique un asset avec `form: "gigantamax"` dans `assetForms`.

## Roadmap Possible

- Ajouter des routes REST pour exposer `data/pokemon`.
- Ajouter une recherche par slug, nom, type et generation.
- Generer un index global au demarrage.
- Ajouter une validation automatique du schema.
- Publier une documentation d'endpoints quand l'API sera branchee.

## Licence

Projet sous licence ISC.
