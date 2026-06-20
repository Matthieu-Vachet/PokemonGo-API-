# Pokemon GO API REST

L'API publique est separee de la checklist et vit dans `src/`.
Les fichiers du depot prive `PokemonGo-Data` restent la source de verite et ne sont
jamais modifies par la synchronisation. Les details des attaques vivent dans
`PokemonGo-Data/moves/`; les Pokemon ne conservent que leurs identifiants.

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
  audit/
  import/
  migrate/
  sync/
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
POKEMON_GO_DATA_DIR=../PokemonGo-Data
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
| Formes | `/pokemon/:identifier/forms`, `/mega`, `/dynamax`, `/gigantamax`, `/regional` |
| Evolutions | `/pokemon/:identifier/evolutions`, `/pokemon/:identifier/evolution-chain`, `/evolutions/special` |
| Recherche | `/api/v1/search?q=dracaufeu` |
| Attaques | `/moves`, `/moves/:identifier`, `/moves/:identifier/pokemon` |
| Attaques d'un Pokemon | `/pokemon/:identifier/moves` |
| PvP | `/pvp/:league/rankings`, `/pvp/:league/:identifier` |
| PC | `/pokemon/:identifier/cp` |
| Types | `/types`, `/types/:identifier`, `/types/:identifier/pokemon` |
| Météo | `/weather`, `/weather/:identifier`, `/weather/:identifier/pokemon`, `/weather/:identifier/types`, `/weather/:identifier/moves` |
| Regions | `/regions`, `/regions/:identifier/pokemon` |
| Generations | `/generations`, `/generations/:identifier/pokemon` |
| Assets | `/assets/:identifier`, `/pokemon/:identifier/assets` |
| Backgrounds | `/backgrounds`, `/backgrounds/:id/pokemon`, `/pokemon/:identifier/backgrounds` |
| Shadow | `/shadow`, `/shadow/:identifier`, `/pokemon/:identifier/shadow` |
| Stickers | `/stickers`, `/stickers/:id` |
| Pokémon Shuffle | `/shuffle`, `/shuffle/:identifier`, `/pokemon/:identifier/shuffle` |
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

Une fiche dont `availability.shadow` vaut `true` expose aussi `data.shadow` avec
la première date de sortie, le coût de purification, les Catch CP normal et
boosté par la météo, ainsi que les variantes régionales, Apex ou costumées.

## Exemples

```bash
curl "http://localhost:3000/api/v1/pokemon/charizard"
curl "http://localhost:3000/api/v1/search?q=dracaufeu"
curl "http://localhost:3000/api/v1/pokemon/charizard/cp?level=50&attackIv=15&defenseIv=15&staminaIv=15"
curl "http://localhost:3000/api/v1/pvp/great/rankings?limit=20"
curl "http://localhost:3000/api/v1/moves/BLAST_BURN/pokemon"
curl "http://localhost:3000/api/v1/pokemon/venusaur/moves"
curl "http://localhost:3000/api/v1/backgrounds?type=location&date=2025"
curl "http://localhost:3000/api/v1/backgrounds/lc_GoFest2025_paris/pokemon"
curl "http://localhost:3000/api/v1/pokemon/eevee/backgrounds"
curl "http://localhost:3000/api/v1/shadow?releasedFrom=2025-01-01"
curl "http://localhost:3000/api/v1/shadow/bulbasaur"
curl "http://localhost:3000/api/v1/pokemon/bulbasaur/shadow"
curl "http://localhost:3000/api/v1/stickers?q=collab&limit=50"
curl "http://localhost:3000/api/v1/stickers/sticker-2023collab-1"
curl "http://localhost:3000/api/v1/shuffle?state=shadow&shiny=true"
curl "http://localhost:3000/api/v1/shuffle/venusaur-mega"
curl "http://localhost:3000/api/v1/pokemon/rattata-alola/shuffle"
curl "http://localhost:3000/api/v1/weather/sunny/pokemon"
curl "http://localhost:3000/api/v1/weather/rain/moves"
curl "http://localhost:3000/api/v1/dynamax"
curl "http://localhost:3000/api/v1/gigantamax"
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
npm run ensure:data
npm run sync
npm start
```

Le service de synchronisation peut etre lance par une tache planifiee, un workflow GitHub
Actions ou un processus separe avec `npm run sync:watch`. Ne pas executer plusieurs
watchers concurrents sur les memes sources.

### Vercel Et GitHub

`api/rest.js` expose l'application Express comme Vercel Function. Les routes `/api/v1`,
`/api-docs`, `/swagger` et `/health` sont dirigees vers cette fonction par `vercel.json`.
Le front Next.js sert `/`, `/checklist` et `/assets`. `/admin` redirige vers `/` en
attendant le futur depot `dashboard_Admin`.

La checklist expose aussi `/api/checklist-v3`, qui regroupe le bootstrap public, le
détail d'une fiche, les catalogues et les audits d'assets en lecture seule. Les actions
admin historiques (`login`, `validate`, `preview-rule`, `source-watch`, `url-audit`) sont
désactivées ici et renvoient `410 Gone`.

Configurer dans Vercel les variables `MONGODB_URI`, `NODE_ENV=production` et
`API_PUBLIC_URL`. Comme `PokemonGo-Data` est prive, ajouter aussi
`POKEMON_GO_DATA_TOKEN` avec un token GitHub ayant le droit de lire ce depot. Atlas doit
accepter les connexions sortantes de Vercel ; sur un cluster standard, cela implique
generalement une autorisation reseau adaptee ou une solution d'adresse sortante fixe.

Le workflow `.github/workflows/sync-mongodb.yml` synchronise automatiquement Atlas sur
push `main`, execution manuelle ou evenement `repository_dispatch` envoyé par
`PokemonGo-Data`. Ajouter `MONGODB_URI` et `POKEMON_GO_DATA_TOKEN` dans les secrets
GitHub Actions du depot API.

`npm run sync:watch` ne doit pas tourner sur Vercel : une Function n'est pas un processus
permanent. Utiliser le workflow GitHub Actions ou un Cron Vercel pour les synchronisations.

MongoDB Atlas doit autoriser l'adresse IP du service et utiliser un compte limite a la
base de l'API. Les secrets doivent rester dans les variables d'environnement de
l'hebergeur et ne jamais etre commits.
