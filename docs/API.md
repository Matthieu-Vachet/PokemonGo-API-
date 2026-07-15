# Pokemon GO API REST

L'API publique vit dans `src/` et reste separee des outils de controle du Dashboard Admin.
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
- son hash et ses metadonnees de provenance ;
- des metadonnees de synchronisation.

Depuis la refonte du modele Pokemon, MongoDB separe les donnees en deux collections :

- `pokemons` contient le gameplay, les stats, les attaques, le PvP, les disponibilites, les images principales, les bonbons et `data.assets.assetsRef`.
- `pokemonAssets` contient les assets lourds : Home, portraits, portraits shiny, location cards, Shuffle et variantes visuelles.
- `raids`, `eggs`, `maxbattles`, `rockets` et `researches` contiennent chacun le
  document `{ key: "current" }` produit par le pipeline de regeneration externe.
  MongoDB est leur unique source de lecture ; les JSON locaux ne sont que des
  references, fixtures ou exports explicites.
- `items` contient les objets canoniques de `PokemonGo-Data/items/items.json`, un document par objet.
- `rocket_texts` contient les phrases Team GO Rocket de `PokemonGo-Data/rocket/rocketTexts.json`, un document par texte.

Les routes publiques joignent automatiquement `pokemons.formId` avec `pokemonAssets.formId`
sur les fiches de detail et les routes d'assets. La liste `/pokemon` reste legere pour
garder des reponses rapides.

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
API_ADMIN_SECRET=change_me
POKEMON_GO_DATA_DIR=../PokemonGo-Data
```

## Synchronisation

Valider toutes les sources sans MongoDB et sans ecriture :

```bash
npm run sync:dry
```

Synchroniser uniquement les référentiels statiques MongoDB, supprimer leurs documents
devenus obsolètes, reconstruire leurs index et régénérer les statistiques globales :

```bash
npm run sync
```

Cette commande traite uniquement les referentiels statiques. Elle exclut
`raids`, `eggs`, `maxbattles`, `rockets` et `researches`, dont les documents
`current` sont ecrits par les pipelines de regeneration dedies.

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

## Authentification Admin

Les routes publiques de lecture (`GET`, `HEAD`, `OPTIONS`) restent accessibles sans
secret quand elles exposent des donnees Pokemon publiques.

Les routes privees, internes et toutes les methodes d'ecriture doivent fournir :

```http
x-api-admin-secret: <secret>
```

Le secret vient uniquement de la variable serveur `API_ADMIN_SECRET`. Ne jamais le mettre
en dur dans le code et ne jamais utiliser `NEXT_PUBLIC_` pour cette valeur.

Reponses de securite :

- `401 ADMIN_SECRET_REQUIRED` quand le header manque.
- `403 ADMIN_SECRET_INVALID` quand le header ne correspond pas.
- `500 ADMIN_SECRET_NOT_CONFIGURED` quand `API_ADMIN_SECRET` manque cote serveur.

Exemples :

```bash
curl "https://domain.com/api/v1/pokemon"
curl "https://domain.com/api/v1/raids"
curl "https://domain.com/api/v1/eggs"
curl "https://domain.com/api/v1/max-battles"
curl "https://domain.com/api/v1/items"
curl "https://domain.com/api/v1/rocket"
curl "https://domain.com/api/v1/rocket-texts"
curl "https://domain.com/api/v1/research"

curl -X POST "https://domain.com/api/v1/pokemon" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"

curl -X POST "https://domain.com/api/v1/admin/raids/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/raids-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/eggs/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/eggs-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/max-battles/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/max-battles-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/rocket/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/rocket-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/research/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/research-maintenance.json

curl "https://domain.com/api/checklist-v3?action=history" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

Le secret valide protege l'acces aux operations privees. Il ne transforme pas l'API
REST publique en API d'ecriture : les routes `/api/v1/*` restent read-only si aucune
route privee explicite n'existe.

## Classement Des Routes

PUBLIC :

- `GET /`, `/api-docs`, `/swagger`, `/api-docs.json`, `/health`.
- `GET /api/v1` et toutes les routes publiques de lecture Pokemon, formes, evolutions,
  recherche, attaques, PvP, comparaison, statistiques publiques, types, regions,
  generations, meteo, bonbons, assets publics, backgrounds, shadow, stickers, Shuffle,
  collection checklist, raids courants, oeufs courants, Max Battles courantes,
  lineups Team GO Rocket courants, quetes Research courantes,
  evolutions speciales, raid counters et `meta/filters`.
- `GET /api/checklist-v3?action=bootstrap|detail|catalog|assets|session`.

PRIVATE :

- Toute methode `POST`, `PATCH`, `PUT` ou `DELETE` sous `/api/v1/*`.
- `POST /api/v1/admin/raids/import` et `/api/v1/admin/raids/regenerate`.
- `POST /api/v1/admin/eggs/import` et `/api/v1/admin/eggs/regenerate`.
- `POST /api/v1/admin/max-battles/import` et `/api/v1/admin/max-battles/regenerate`.
- `POST /api/v1/admin/rocket/import` et `/api/v1/admin/rocket/regenerate`.
- `POST /api/v1/admin/research/import` et `/api/v1/admin/research/regenerate`.
- Toutes les lectures et écritures sous `/api/v1/admin/game-master/*`, y compris
  résumé, catégories, recherche, détail, comparaison locale, snapshots, diff,
  export, régénération et réindexation.
- Toute methode non `GET`, `HEAD` ou `OPTIONS` sur `/api/checklist-v3`.
- `GET /api/checklist-v3?action=source-watch|history|url-audit`.

INTERNAL :

- Les scripts CLI d'audit, d'import, de migration et de synchronisation dans `scripts/`.
- Le serveur local checklist dans `apps/checklist/server/`.
- Les actions checklist legacy `source-watch`, `history` et `url-audit`, conservees
  uniquement pour compatibilite et maintenant protegees avant leur reponse `410 Gone`.

Contrat des wrappers courants :

- Les `GET` de raids, oeufs, Max Battles, Rocket et Research lisent strictement
  MongoDB avec `{ key: "current" }`. Aucun parametre ne permet de basculer vers un
  fichier local.
- Chaque `GET` expose `data`, `meta` et `current`. `meta` porte notamment la source
  MongoDB, le domaine, le fournisseur, le mode, les dates, le compteur, le hash,
  le statut, les diagnostics et le resume du domaine. `current` est la forme
  serialisee du document MongoDB persiste.
- Les routes `POST /api/v1/admin/*/regenerate` executent le pipeline source externe,
  parsing, enrichissement, validation, hash canonique, diff, `upsert`, invalidation
  du cache, relecture et verification MongoDB.
- Une regeneration vide ou invalide retourne une erreur et n'ecrit aucun faux succes.
- Les routes `POST /api/v1/admin/*/import` sont des operations de maintenance
  protegees. Elles exigent un payload JSON explicite contenant la racine du domaine ;
  l'absence de body retourne `400 CURRENT_IMPORT_PAYLOAD_REQUIRED` sans lecture locale.
- Les reponses d'import/regeneration exposent notamment `success`, `current`,
  `source`, `sourceUrl`, `itemsParsed`, `itemsMatched`, `itemsUnmatched`,
  `mongoUpdated`, `changed`, `diff`, le resume du domaine et `report`.

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
| Candy | `/candy`, `/candy/:familyId`, `/candy/:familyId/pokemon` |
| Raids | `/raids`, `/admin/raids/import`, `/admin/raids/regenerate` |
| Oeufs | `/eggs`, `/admin/eggs/import`, `/admin/eggs/regenerate` |
| Max Battles | `/max-battles`, `/admin/max-battles/import`, `/admin/max-battles/regenerate` |
| Rocket | `/rocket`, `/admin/rocket/import`, `/admin/rocket/regenerate` |
| Research | `/research`, `/admin/research/import`, `/admin/research/regenerate` |
| Game Master privé | `/admin/game-master/summary`, `/categories`, `/templates`, `/search`, `/local-comparison`, `/snapshots`, `/diff`, `/export`, `/regenerate`, `/reindex` |
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
| Metadonnees | `/meta/filters`, `/stats/global` |

## Raids Courants

`GET /api/v1/raids` expose les boss actifs depuis le document MongoDB
`{ key: "current" }` de la collection `raids`. La seule source externe autorisee
pendant la regeneration est `https://leekduck.com/raid-bosses/`.

Le mode normal ou evenement est detecte dans le contenu de cette page, notamment
ses sections et marqueurs comme `SELECTED EVENT`. Le pipeline ne consulte jamais
`/gofest/raids/` et ne force aucune activation, date, liste de Pokemon ou nombre
d'entrees. Les categories publiees par la page sont conservees dynamiquement.

Exemple de `data` non exhaustif (les buckets suivent la source) :

```json
{
  "currentList": {
    "ultra_beast": [],
    "mega": [],
    "lvl5": [],
    "lvl3": [],
    "lvl1": [],
    "shadow_lvl5": [],
    "shadow_lvl3": [],
    "shadow_lvl1": []
  }
}
```

Chaque boss contient les informations locales (`id`, `form`, `assets`, `names`,
`types`, `weather`, `shiny`) et les donnees dynamiques disponibles depuis LeekDuck
(`cpRange`, `cpRangeBoost`, niveau de raid). Les faiblesses `counter` sont derivees
du catalogue local `types/*.json`.

Routes admin protegees :

```bash
curl -X POST "https://domain.com/api/v1/admin/raids/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/raids-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/raids/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`regenerate` execute le pipeline complet et `import` exige un payload dont la racine
est `currentList`. La route publique relit uniquement MongoDB, sans fallback fichier.

## Oeufs Courants

`GET /api/v1/eggs` expose les eclosions actives depuis le document MongoDB
`{ key: "current" }` de la collection `eggs`. La regeneration utilise
`https://leekduck.com/eggs/`, puis enrichit les entrees avec les catalogues locaux.

Structure :

```json
{
  "currentEggsList": {
    "1km": [],
    "2km": [],
    "5km": [],
    "5km_adventure_sync": [],
    "7km": [],
    "7km_route_gift": [],
    "10km": [],
    "10km_adventure_sync": [],
    "12km": []
  }
}
```

Routes admin protegees :

```bash
curl -X POST "https://domain.com/api/v1/admin/eggs/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/eggs-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/eggs/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`import` exige un payload dont la racine est `currentEggsList`. Le `GET` relit
uniquement MongoDB, sans fallback fichier.

## Max Battles Courantes

`GET /api/v1/max-battles` expose les boss actifs depuis le document MongoDB
`{ key: "current" }` de la collection `maxbattles`. La regeneration utilise
`https://www.snacknap.com/max-battles`, puis enrichit les entrees avec les formes
locales, notamment Dynamax et Gigantamax.

Structure :

```json
{
  "currentMaxBattle": {
    "Tier1": [],
    "Tier2": [],
    "Tier3": []
  }
}
```

Routes admin protegees :

```bash
curl -X POST "https://domain.com/api/v1/admin/max-battles/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/max-battles-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/max-battles/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`import` exige un payload dont la racine est `currentMaxBattle`. Le `GET` relit
uniquement MongoDB, sans fallback fichier.

## Team GO Rocket Courant

`GET /api/v1/rocket` expose les lineups actifs depuis le document MongoDB
`{ key: "current" }` de la collection `rockets`. La regeneration utilise
`https://leekduck.com/rocket-lineups/`, puis enrichit les entrees avec les fiches
Pokemon locales.

Structure :

```json
{
  "currentRocketList": {
    "giovanni": [],
    "leaders": {
      "arlo": [],
      "cliff": [],
      "sierra": []
    },
    "grunts": []
  }
}
```

Routes admin protegees :

```bash
curl -X POST "https://domain.com/api/v1/admin/rocket/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/rocket-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/rocket/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`import` exige un payload dont la racine est `currentRocketList`. Le `GET` relit
uniquement MongoDB, sans fallback fichier.

## Research Courant

`GET /api/v1/research` expose les quetes actives depuis le document MongoDB
`{ key: "current" }` de la collection `researches`. La regeneration utilise
`https://leekduck.com/research/`, puis enrichit les recompenses Pokemon avec les
catalogues locaux. Les rewards item conservent `asset: null` quand aucun asset local
fiable n'est disponible.

Structure :

```json
{
  "currentResearchList": {
    "fieldResearch": [],
    "eventResearch": [],
    "specialResearch": [],
    "timedResearch": []
  }
}
```

Routes admin protegees :

```bash
curl -X POST "https://domain.com/api/v1/admin/research/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/research-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/research/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`import` exige un payload dont la racine est `currentResearchList`. Le `GET` relit
uniquement MongoDB, sans fallback fichier.

## Items

`GET /api/v1/items` expose les objets canoniques utiles aux recompenses Research.
Les donnees viennent de `PokemonGo-Data/items/items.json` puis sont synchronisees
dans MongoDB, collection `items`.

Champs principaux :

- `id`, `templateId`, `itemId`
- `category`, `itemType`
- `names`, `description`
- `asset`, `assetKey`

Exemples :

```bash
curl "https://domain.com/api/v1/items"
curl "https://domain.com/api/v1/items?category=pokeball&q=ball"
curl "https://domain.com/api/v1/items/ITEM_ULTRA_BALL"
```

## Rocket Texts

`GET /api/v1/rocket-texts` expose les traductions officielles des phrases Team GO
Rocket. Les donnees viennent de `PokemonGo-Data/rocket/rocketTexts.json` puis sont
synchronisees dans MongoDB, collection `rocket_texts`.

Champs principaux :

- `id`, `textKey`
- `trainerType`, `gender`, `type`, `character`
- `texts`
- `textVariants`

Exemples :

```bash
curl "https://domain.com/api/v1/rocket-texts"
curl "https://domain.com/api/v1/rocket-texts?trainerType=grunt&type=FIRE"
curl "https://domain.com/api/v1/rocket-texts/grunt_fire_female_combat_grunt_quote_fire"
```

## Filtres Combines

Exemple :

```http
GET /api/v1/pokemon?generation=1&type=FIRE&released=true&shinyReleased=true&sort=-maxCp.maxLevel50&page=1&limit=25
```

Filtres disponibles :

- `q`, `generation`, `region`, `type`, `primaryType`, `secondaryType`
- `form`, `kind`, `weather`, `move`, `pvpLeague`
- `released`, `shinyReleased`, `shadowShinyReleased`, `tradable`, `pokemonHomeTransfer`
- `shadow`, `apex`, `dynamax`, `gigantamax`, `mega`
- `buddyDistanceMin`, `buddyDistanceMax`
- `catchRateMin`, `catchRateMax`, `fleeRateMin`, `fleeRateMax`
- `maxCpMin`, `maxCpMax`
- `page`, `limit`, `sort`

Une fiche dont `availability.shadow` vaut `true` expose aussi `data.shadow` avec
la première date de sortie, le coût de purification, les Catch CP normal et
boosté par la météo, ainsi que les variantes régionales, Apex ou costumées.

Toutes les fiches exposent aussi `data.shinyAvailability` et
`data.shadowShinyAvailability`. Chaque bloc contient `releaseDate`, `event`, `source`
et `matchedName`; les valeurs restent `null` quand la variante chromatique ou Obscure
chromatique n'est pas encore sortie. La verite unique pour l'etat de sortie reste
`data.availability.shinyReleased` et `data.availability.shadowShinyReleased`.

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
curl "http://localhost:3000/api/v1/candy?familyId=1"
curl "http://localhost:3000/api/v1/candy/1/pokemon"
curl "http://localhost:3000/api/v1/dynamax"
curl "http://localhost:3000/api/v1/gigantamax"
curl -X POST "http://localhost:3000/api/v1/pokemon" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
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
- Protection globale des routes privees avec `x-api-admin-secret`
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
API_ADMIN_SECRET=change_me
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
Le front Next.js sert `/`, `/bibliotheque`, `/checklist` pour compatibilite,
`/assets`, `/robots.txt` et `/sitemap.xml`.

La bibliothèque publique n'expose pas le moteur de règles du Dashboard Admin. Les
anciennes routes de checklist restent limitees a la compatibilite lecture seule quand
elles existent ; les actions de correction, d'audit admin ou d'ecriture restent
desactivees hors Dashboard.

Configurer dans Vercel les variables `MONGODB_URI`, `NODE_ENV=production`,
`API_PUBLIC_URL` et `API_ADMIN_SECRET`. Comme `PokemonGo-Data` est prive, ajouter aussi
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
