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
│   ├── audit/
│   ├── import/
│   ├── migrate/
│   └── sync/
├── data/
│   ├── moves/
│   │   ├── fast/
│   │   ├── charged/
│   │   ├── fast_elite/
│   │   ├── charged_elite/
│   │   ├── max/
│   │   └── gmax/
│   ├── pokemon/
│   │   ├── 0001-bulbasaur.json
│   │   ├── 0002-ivysaur.json
│   │   └── 0003-venusaur.json
│   ├── pokemon-forms/
│   │   ├── alola/
│   │   ├── galar/
│   │   ├── hisui/
│   │   ├── paldea/
│   │   ├── dynamax/
│   │   ├── gigantamax/
│   │   ├── mega/
│   │   ├── mega-x/
│   │   └── mega-y/
│   └── types/
├── config/                    # Configuration Atlas Search
├── docs/
│   ├── API.md
│   ├── DATA-NORMALIZATION.md
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

Verifier les references d'attaques avant une synchronisation :

```bash
npm run audit:moves
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
  "primaryType": "GRASS",
  "secondaryType": "POISON"
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
| Disponibilite | `availability`: shiny, shadow, trade, Pokemon HOME, Dynamax, Gigamax, Apex ; le bloc `shadow` détaille date, purification et Catch CP |
| Combat | `stats`, `maxCp`, `quickMoves`, `cinematicMoves`, moves Elite |
| PvP | ranks par ligue, IVs rang 1, movesets recommandes |
| Evolutions | `evolutions`, `hasMegaEvolution`, `megaEvolutions`, `hasGigantamaxEvolution` |
| Assets | images principales, shiny, costumes, formes alternatives, backgrounds avec dates et formes éligibles |
| Formes | variantes regionales, Dynamax, Gigantamax, Mega et Primo |

Les references principales du schema sont:

- `0001-bulbasaur.json`: profil de base.
- `0002-ivysaur.json`: profil intermediaire.
- `0003-venusaur.json`: profil final avec Mega-Evolution et Gigantamax.
- `data/pokemon-forms/dynamax/0001-bulbasaur-dynamax.json`: forme Max qui herite de Bulbasaur.

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

La checklist sert egalement d'atelier qualite:

- assistant JSON avec structures completes pour les blocs manquants;
- editeur de brouillon, validation avancee, apercu du diff et annulation locale;
- corrections groupees exportables sans modifier les fichiers source;
- analyse des assets Pokemon Home, controle des URLs et revue d'images;
- onglet Shadow avec dates, coûts de purification, Catch CP et variantes;
- catalogue des attaques, icones de types, comparaison de fiches et historique Git;
- portraits Méga, fonds de types et catalogue des stickers;
- notes, rapports Markdown, recherche par commandes et mode mobile une seule tache.

Les outils de correction ne modifient jamais les JSON source. Ils produisent uniquement
du JSON a copier ou telecharger pour conserver une validation manuelle avant collage.

La checklist ecoute par defaut sur le reseau local. Pour limiter temporairement l'acces
au Mac:

```bash
CHECKLIST_HOST=127.0.0.1 npm run checklist
```

Les migrations de normalisation fonctionnent en simulation par defaut:

```bash
npm run migrate:types
npm run migrate:type-assets
npm run migrate:max-forms
npm run migrate:identifiers
npm run migrate:form-references
npm run migrate:json-order
npm run audit:moves
npm run audit:identifiers
npm run audit:forms
npm run sync:dry
```

Les variantes `:write` appliquent les changements apres validation. L'audit des
identifiants accepte les `targetFormId` futurs bien formes, mais bloque les doublons et
les references invalides.

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
- `/api/catalog-v3`, `/api/assets-v3`, `/api/validate-v3` et `/api/url-audit-v3`
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
- Images Pokémon GO via `assets.image`, `assets.shinyImage` et `assetForms`.
- Images Pokémon Home via `assets.home`; `npm run migrate:home-assets:write` les régénère depuis `asset/HD`.
- Traductions principales dans les objets `names`.
- `regionForms`, `megaEvolutions`, `dynamaxForms` et `gigantamaxForms` sont des listes de références `formId`.
- Les données complètes de chaque forme vivent uniquement dans `data/pokemon-forms/`.
- Les icônes Pokémon Shuffle vivent dans `assets.shuffle` et sont importées avec `npm run import:pokemon-shuffle:write`.
- Les quatre champs d'attaques des Pokemon sont des tableaux d'identifiants.
- Les details des attaques vivent uniquement dans `data/moves/`, y compris `max/` et `gmax/`.
- `primaryType`, `secondaryType` et `type` d'attaque utilisent les identifiants courts de `data/types/`, par exemple `"GRASS"`.
- `pvp` peut valoir `null`; sinon les ligues `littleCup`, `greatLeague`, `ultraLeague` et `masterLeague` peuvent chacune valoir `null`.
- `megaEnergyReward` peut valoir `null` lorsqu'il n'y a pas d'energie Mega a gagner.
- Les evolutions pointent vers `targetFormId`; la cible peut ne pas encore exister si tu ajoutes les fiches au fur et a mesure.
- Les formes Dynamax et Gigantamax utilisent `baseFormId`, leur propre `slug`, leur propre bloc `maxCp` (`maxLevel50`, `maxLevel40`, `maxBattlesLevel20`) et `maxBattle`.
- `hasGigantamaxEvolution: true` implique un asset avec `form: "gigantamax"` dans `assetForms`.

## Roadmap Possible

- Ajouter des routes REST pour exposer `data/pokemon`.
- Ajouter une recherche par slug, nom, type et generation.
- Generer un index global au demarrage.
- Ajouter une validation automatique du schema.
- Publier une documentation d'endpoints quand l'API sera branchee.

## Licence

Projet sous licence ISC.
