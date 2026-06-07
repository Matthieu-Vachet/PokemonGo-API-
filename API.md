# Pokemon GO API REST

L'API publique est separee de la checklist et vit dans `src/`.
Les fichiers sous `data/` et `attaque/` restent la source de verite et ne sont jamais
modifies par la synchronisation.

## Architecture

```text
src/
  config/       configuration et connexion MongoDB
  docs/         specification OpenAPI
  lib/          erreurs, cache, pagination et utilitaires HTTP
  middleware/   securite et gestion globale des erreurs
  models/       modeles Mongoose flexibles et indexes
  routes/       routes REST versionnees
  services/     logique metier
  sync/         lecture JSON et synchronisation MongoDB
scripts/
  sync.js
  sync-watch.js
```

Chaque document MongoDB conserve :

- les champs normalises et indexes necessaires aux recherches rapides ;
- le JSON complet dans `data` ;
- son hash et ses fichiers sources ;
- des metadonnees de synchronisation.

Les schemas utilisent `strict: false`. Un nouveau champ JSON est donc conserve dans
MongoDB sans imposer une modification du backend.

## Installation

```bash
npm install
cp .env.example .env
```

Configurer au minimum :

```dotenv
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokemon-go-api
API_PUBLIC_URL=http://localhost:3000
```

## Synchronisation

Valider toutes les sources sans MongoDB et sans ecriture :

```bash
npm run sync:dry
```

Synchroniser MongoDB, supprimer les documents devenus obsoletes, reconstruire les
indexes et regenerer les statistiques globales :

```bash
npm run sync
```

Surveiller les nouveaux fichiers et les modifications :

```bash
npm run sync:watch
```

La synchronisation compare les hashes, n'ecrit que les documents nouveaux ou modifies,
utilise des upserts et des cles uniques pour eviter les doublons. Une collection source
vide ne provoque jamais une suppression massive automatique.

## Demarrage

```bash
npm run dev
```

Production :

```bash
npm start
```

Documentation :

- Documentation Redoc : `http://localhost:3000/api-docs`
- Swagger UI interactif : `http://localhost:3000/swagger`
- OpenAPI JSON : `http://localhost:3000/api-docs.json`
- Sante : `http://localhost:3000/health`

## Routes Principales

| Domaine | Routes |
| --- | --- |
| Pokemon | `/api/v1/pokemon`, `/api/v1/pokemon/:identifier` |
| Identifiants | `/pokemon/slug/:slug`, `/pokemon/id/:id`, `/pokemon/dex/:dex`, `/pokemon/form-id/:formId` |
| Formes | `/pokemon/:identifier/forms`, `/mega`, `/gigantamax`, `/regional` |
| Evolutions | `/pokemon/:identifier/evolutions`, `/pokemon/:identifier/evolution-chain`, `/evolutions/special` |
| Recherche | `/api/v1/search?q=dracaufeu` |
| Attaques | `/moves`, `/moves/:identifier`, `/moves/:identifier/pokemon` |
| PvP | `/pvp/:league/rankings`, `/pvp/:league/:identifier` |
| PC | `/pokemon/:identifier/cp` |
| Types | `/types`, `/types/:identifier`, `/types/:identifier/pokemon` |
| Regions | `/regions`, `/regions/:identifier/pokemon` |
| Generations | `/generations`, `/generations/:identifier/pokemon` |
| Assets | `/assets/:identifier`, `/pokemon/:identifier/assets` |
| Comparaison | `/compare/pokemon?ids=charizard,blastoise` |
| Classements | `/stats/top/attack`, `/stats/top/defense`, `/stats/top/stamina`, `/stats/top/cp` |
| Collection | `/collection/checklist` |
| Raid | `/raid/counters/FIRE` |
| Metadonnees | `/meta/filters`, `/meta/sync`, `/stats/global` |

## Filtres Combines

Exemple :

```http
GET /api/v1/pokemon?generation=1&type=FIRE&released=true&shinyReleased=true&sort=-maxCp.maxLevel50&page=1&limit=25
```

Filtres disponibles :

- `q`, `generation`, `region`, `type`, `primaryType`, `secondaryType`
- `form`, `kind`, `weather`, `move`, `pvpLeague`
- `released`, `shinyReleased`, `tradable`, `pokemonHomeTransfer`
- `shadow`, `apex`, `dynamax`, `gigantamax`, `mega`
- `buddyDistanceMin`, `buddyDistanceMax`
- `catchRateMin`, `catchRateMax`, `fleeRateMin`, `fleeRateMax`
- `maxCpMin`, `maxCpMax`
- `page`, `limit`, `sort`

## Exemples

```bash
curl "http://localhost:3000/api/v1/pokemon/charizard"
curl "http://localhost:3000/api/v1/search?q=dracaufeu"
curl "http://localhost:3000/api/v1/pokemon/charizard/cp?level=50&attackIv=15&defenseIv=15&staminaIv=15"
curl "http://localhost:3000/api/v1/pvp/great/rankings?limit=20"
curl "http://localhost:3000/api/v1/moves/BLAST_BURN/pokemon"
```

## Atlas Search

Les recherches classiques fonctionnent avec les indexes MongoDB standards.
Pour une autocompletion avancee, creer les indexes Atlas Search a partir de :

- `config/atlas-search-pokemon.json`
- `config/atlas-search-moves.json`

## Securite Et Performance

- Helmet et suppression de `X-Powered-By`
- CORS configurable
- Rate limiting global
- Compression
- Cache TTL en memoire pour les requetes GET
- Pagination limitee a 100 resultats
- Validation des filtres, tris et identifiants
- Erreurs JSON uniformes avec identifiant de requete
- Index MongoDB reconstruits par `npm run sync`

Pour un deploiement horizontal, remplacer le cache memoire et le rate limiter par Redis.

## Deploiement

L'API peut etre deployee sur Vercel Functions, Render, Railway, Fly.io, un VPS ou un
conteneur Docker. MongoDB Atlas reste la base partagee entre les instances.

Variables de production minimales :

```dotenv
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokemon-go-api
API_PUBLIC_URL=https://api.example.com
CORS_ORIGINS=https://example.com,https://app.example.com
CACHE_MAX_ENTRIES=5000
TRUST_PROXY=1
```

Processus recommande :

```bash
npm ci
npm run sync
npm start
```

Le service de synchronisation peut etre lance par une tache planifiee, un workflow GitHub
Actions ou un processus separe avec `npm run sync:watch`. Ne pas executer plusieurs
watchers concurrents sur les memes sources.

### Vercel Et GitHub

`api/rest.js` expose l'application Express comme Vercel Function. Les routes `/api/v1`,
`/api-docs`, `/swagger` et `/health` sont dirigees vers cette fonction par `vercel.json`.
La checklist V3 reste disponible a la racine.

Configurer dans Vercel les variables `MONGODB_URI`, `NODE_ENV=production` et
`API_PUBLIC_URL`. Atlas doit accepter les connexions sortantes de Vercel ; sur un cluster
standard, cela implique generalement une autorisation reseau adaptee ou une solution
d'adresse sortante fixe.

Le workflow `.github/workflows/sync-mongodb.yml` synchronise automatiquement Atlas quand
les JSON de `data/` ou `attaque/` changent sur `main`. Ajouter `MONGODB_URI` dans les
secrets GitHub Actions du depot.

`npm run sync:watch` ne doit pas tourner sur Vercel : une Function n'est pas un processus
permanent. Utiliser le workflow GitHub Actions ou un Cron Vercel pour les synchronisations.

MongoDB Atlas doit autoriser l'adresse IP du service et utiliser un compte limite a la
base de l'API. Les secrets doivent rester dans les variables d'environnement de
l'hebergeur et ne jamais etre commits.
