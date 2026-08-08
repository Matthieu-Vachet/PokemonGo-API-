---
id: API-PROJECT-001
title: Pokemon GO API
status: canonical
lang: fr
version: 1.20.0
updated_at: 2026-08-08
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
  - Dashboard Admin
related:
  - ADR-CANONICAL-001
  - API-PUBLIC-001
  - DATASET-POKEMON-001
---

# Pokemon GO API

API REST publique, multilingue et versionnee pour Pokemon GO, alimentee par un depot
de donnees JSON separe. Elle est pensee pour servir durablement un Pokedex, un bot
Discord, un site, une application mobile, des outils PvP, Raid et collection.

Le backend de production vit dans `src/`. Les checklists restent des outils independants
pour consulter les fiches, tandis que MongoDB Atlas fournit les recherches, filtres et
classements rapides de l'API. La synchronisation ne modifie jamais les JSON sources.
Les referentiels statiques vivent dans le depot prive `PokemonGo-Data`. Les cinq
datasets courants raids, oeufs, Max Battles, Rocket et Research sont regeneres depuis
leurs sources externes puis lus exclusivement dans MongoDB.

Les classements Best Attackers et Best Defenders suivent le même contrat MongoDB (`best_attackers` et `best_defenders`, gzip, hash, diff et relecture). `GET /api/v1/best-defenders` expose les six tiers Pokémon GO Hub après résolution canonique. Le diagnostic privé `pokemon-identity-mappings` et l’audit Margxt `costume_audits` restent protégés par le secret admin ; aucun endpoint Costume Audit n’est déclaré dans la découverte publique.

`GET /api/v1/pvp-rankings` expose les classements PvPoke avec leur profil Rank 1 exact. `GET /api/v1/gbl-calendar` expose les rotations Battleflow persistées dans `gbl_calendar`; les deux domaines sont publics et leurs mutations restent sous `/api/v1/admin/*`.

Les référentiels permanents Community Days et Historique Events sont exposés en lecture
seule par `/api/v1/community-days` et `/api/v1/events/history`. Ils lisent les collections
Dashboard partagées sans déclencher de synchronisation. Le scraping d’images Dynamax
reste strictement privé sous `/api/v1/admin/dynamax-images/*`, hors OpenAPI et sans
collection de référentiel ou JSON Dynamax public. Le cache serverless utilise uniquement
`admin_asset_cache`, stockage technique privé avec expiration automatique après 6 heures.

## Game Master Explorer privé

Le Game Master officiel PokeMiners est récupéré, validé et indexé uniquement côté serveur. Les routes `/api/v1/admin/game-master/*` exigent `x-api-admin-secret`, restent absentes d’OpenAPI et exposent des listes paginées sans champ `raw`; le JSON brut n’est renvoyé que pour un template demandé explicitement.

Le stockage utilise `game_master_states`, `game_master_snapshots`, `game_master_templates`, `game_master_diffs` et `game_master_local_comparisons`. Un hash identique met seulement à jour la vérification. Un hash différent crée le staging, les diffs et la comparaison locale avant de basculer atomiquement le pointeur `current`. `GAME_MASTER_SNAPSHOT_RETENTION=0` conserve tout l’historique; une valeur positive active une rétention bornée documentée.

La régénération et la réindexation sont privées :

```bash
curl -X POST -H "x-api-admin-secret: $API_ADMIN_SECRET" https://domain.com/api/v1/admin/game-master/regenerate
curl -H "x-api-admin-secret: $API_ADMIN_SECRET" "https://domain.com/api/v1/admin/game-master/search?q=COPY_2019&page=1&limit=50"
```

Documentation detaillee de l'API : [docs/API.md](docs/API.md)
Import MongoDB depuis les JSON : [docs/MONGO-IMPORT.md](docs/MONGO-IMPORT.md)
Contrats canoniques partagés :
[docs/CANONICAL-DATA-CONTRACTS.md](docs/CANONICAL-DATA-CONTRACTS.md)

## Points Forts

- Donnees Pokemon stockees dans `PokemonGo-Data`, un fichier JSON par espece ou forme.
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

Le depot `PokemonGo-Data` doit etre disponible a cote du projet, ou configure via
`POKEMON_GO_DATA_DIR`. En production Vercel, `npm run ensure:data` peut cloner le depot
dans `.data/PokemonGo-Data`. Les routes REST embarquent le depot via `vercel.json` et
les pages Next.js embarquent le sous-ensemble requis via `outputFileTracingIncludes`
dans `next.config.mjs`; aucune fonction de production ne doit dépendre du clone de build
resté hors de son bundle d'exécution.

Le rôle détaillé de chaque dossier est expliqué dans
[docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md).

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner ensuite `MONGODB_URI` dans `.env`, puis synchroniser les donnees :

```bash
npm run ensure:data
npm run sync
```

Cette synchronisation globale concerne uniquement les referentiels statiques. Elle
exclut `raids`, `eggs`, `maxbattles`, `rockets` et `researches`, qui utilisent leur
pipeline de regeneration dedie.

Configurer aussi `API_ADMIN_SECRET` avec une valeur serveur non publique. Ce secret ne
doit jamais utiliser le prefixe `NEXT_PUBLIC_`.

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

Les fichiers Pokemon vivent dans `PokemonGo-Data/pokemon/`.

```json
{
  "id": "BULBASAUR",
  "formId": "BULBASAUR",
  "slug": "bulbasaur",
  "dexNr": 1,
  "dexId": "0001",
  "regionId": "KANTO",
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
PokemonGo-Data/pokemon/[dexId]-[slug].json
```

Exemple:

```text
PokemonGo-Data/pokemon/0001-bulbasaur.json
```

Les grandes sections du JSON sont:

| Section | Contenu |
| --- | --- |
| Identite | `id`, `formId`, `slug`, `dexNr`, `dexId`, `form`, `regionId`, `pokemonClass` |
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
- `PokemonGo-Data/pokemon-forms/dynamax/0001-bulbasaur-dynamax.json`: forme Max qui herite de Bulbasaur.

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

## Authentification Admin

Les routes publiques de lecture restent accessibles sans authentification :

```bash
curl "https://domain.com/api/v1/pokemon"
curl "https://domain.com/api/v1/raids"
curl "https://domain.com/api/v1/eggs"
curl "https://domain.com/api/v1/max-battles"
curl "https://domain.com/api/v1/items"
curl "https://domain.com/api/v1/rocket"
curl "https://domain.com/api/v1/rocket-texts"
curl "https://domain.com/api/v1/research"
```

Toute route privee, interne ou toute methode d'ecriture doit envoyer le header serveur :

```text
x-api-admin-secret: <secret>
```

Exemples :

```bash
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

Reponses attendues : `401` si le header manque, `403` si le secret est invalide,
`500` si `API_ADMIN_SECRET` n'est pas configure cote serveur. L'API REST publique reste
read-only : un secret valide protege l'acces mais n'active pas d'ecriture publique.

Les cinq routes publiques courantes (`raids`, `eggs`, `max-battles`, `rocket` et
`research`) lisent strictement le document MongoDB `{ key: "current" }`. Aucun
parametre de requete ne bascule vers un fichier local. Leur reponse contient :

- `data`, le dataset courant ;
- `meta`, les metadonnees de lecture MongoDB et le resume du domaine ;
- `current`, le document persiste avec `source`, dates, compteur, `sourceHash`,
  statut et diagnostics de diff.

Les routes `POST /api/v1/admin/*/regenerate` executent le pipeline commun : source
externe, parsing, enrichissement, validation, hash canonique, diff, `upsert`,
invalidation du cache, puis relecture et verification MongoDB. La reponse expose
notamment `success`, `regenerated`, `current`, `source`, `sourceUrl`,
`itemsParsed`, `itemsMatched`, `itemsUnmatched`, `mongoUpdated`, `changed`, `diff`,
le resume du domaine et `report`. Une source vide ou invalide provoque une erreur,
sans ecriture d'un faux succes.

Les routes `POST /api/v1/admin/*/import` sont reservees a la maintenance protegee.
Elles exigent un body JSON explicite contenant la racine du domaine et passent par
les memes validations et controles de persistance. Sans body valide, elles repondent
`400 CURRENT_IMPORT_PAYLOAD_REQUIRED` et ne lisent aucun fichier local. Les JSON
`current*.json` ne sont que des references, fixtures ou exports explicites.

## Raids Pokemon GO

La route publique `GET /api/v1/raids` expose exclusivement le document `current`
de la collection MongoDB `raids`. La seule source externe autorisee pendant une
regeneration est la page LeekDuck Current Raid Bosses :
`https://leekduck.com/raid-bosses/`.

Le mode normal ou evenement est detecte dans le contenu de cette page, notamment
ses sections et marqueurs comme `SELECTED EVENT`. Le pipeline ne consulte jamais
`/gofest/raids/` et ne force aucune activation, date, liste de Pokemon ou taille
attendue. Les categories de la page sont conservees dynamiquement et chaque boss est
enrichi par les catalogues Pokemon : noms multilingues, `id`, `form`, assets, types,
meteo boostee, disponibilite shiny et faiblesses.

Routes admin protegees par `x-api-admin-secret` :

```bash
curl -X POST "https://domain.com/api/v1/admin/raids/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/raids-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/raids/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`regenerate` alimente le pipeline complet puis relit MongoDB. `import` exige un
payload explicite dont la racine est `currentList`. Aucun fichier n'est utilise en
fallback si MongoDB est indisponible ou si le document `current` manque.

## Oeufs Et Max Battles Pokemon GO

Les routes publiques `GET /api/v1/eggs` et `GET /api/v1/max-battles` exposent
strictement les documents `current` des collections MongoDB `eggs` et `maxbattles`.

La regeneration des oeufs utilise `https://leekduck.com/eggs/` et les groupe par
distance ou recompense speciale (`1km`, `5km_adventure_sync`,
`7km_route_gift`, etc.). Chaque entree est enrichie avec les JSON locaux:
identifiant, forme, noms multilingues, assets, types et disponibilite shiny.

La regeneration des Max Battles utilise `https://www.snacknap.com/max-battles` et
les groupe par tiers dynamiques (`Tier1`, `Tier2`, `Tier3`, futurs tiers si la
source evolue). Le matching privilegie les formes Dynamax/Gigantamax locales
quand elles existent.

Routes admin protegees par `x-api-admin-secret` :

```bash
curl -X POST "https://domain.com/api/v1/admin/eggs/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/eggs-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/eggs/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"

curl -X POST "https://domain.com/api/v1/admin/max-battles/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/max-battles-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/max-battles/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`regenerate` passe toujours par le pipeline complet. `import` exige respectivement
les racines `currentEggsList` et `currentMaxBattle`. La lecture publique reste
MongoDB stricte, sans parametre de bascule et sans fallback fichier.

## Rocket Et Research Pokemon GO

Les routes publiques `GET /api/v1/rocket` et `GET /api/v1/research` exposent
strictement les documents `current` des collections MongoDB `rockets` et
`researches`.

La regeneration Rocket utilise `https://leekduck.com/rocket-lineups/` avec Giovanni,
leaders, grunts, slots de combat et rewards possibles. Chaque Pokemon est enrichi
avec les fiches locales et marque `shadow: true`.

La regeneration Research utilise `https://leekduck.com/research/` avec les categories,
textes de quetes et recompenses Pokemon/items. Les recompenses Pokemon sont
matchees avec les assets, noms, types et disponibilites shiny locaux.

Routes admin protegees par `x-api-admin-secret` :

```bash
curl -X POST "https://domain.com/api/v1/admin/rocket/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/rocket-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/rocket/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"

curl -X POST "https://domain.com/api/v1/admin/research/import" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/chemin/research-maintenance.json

curl -X POST "https://domain.com/api/v1/admin/research/regenerate" \
  -H "x-api-admin-secret: $API_ADMIN_SECRET"
```

`regenerate` passe toujours par le pipeline complet. `import` exige respectivement
les racines `currentRocketList` et `currentResearchList`. La lecture publique reste
MongoDB stricte, sans parametre de bascule et sans fallback fichier.

## Items Et Textes Rocket

Les routes publiques `GET /api/v1/items` et `GET /api/v1/rocket-texts` exposent
les sources de verite `PokemonGo-Data/items/items.json` et
`PokemonGo-Data/rocket/rocketTexts.json` apres synchronisation MongoDB.

`/api/v1/items` sert notamment aux recompenses item Research. Chaque entree garde
`id`, `templateId`, `itemId`, `category`, `itemType`, `names`, `description`,
`asset` et `assetKey`.

`/api/v1/rocket-texts` sert aux traductions Team GO Rocket. Chaque entree garde
`id`, `textKey`, `trainerType`, `gender`, `type`, `character`, `texts` et
`textVariants`.

Exemples :

```bash
curl "https://domain.com/api/v1/items"
curl "https://domain.com/api/v1/items/ITEM_ULTRA_BALL"
curl "https://domain.com/api/v1/rocket-texts"
curl "https://domain.com/api/v1/rocket-texts?trainerType=grunt&type=FIRE"
```

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

La nouvelle checklist Next.js est prete pour un deploiement Vercel sans serveur local permanent.

Les commandes pour gerer `main`, `develop`, les branches `feature` et les rebases sans
GitKraken sont documentees dans [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md).

1. Importer le depot GitHub dans Vercel.
2. Conserver les reglages de build automatiques.
3. Deployer le projet.

Vercel sert le front public read-only a la racine du domaine et expose un petit nombre de
fonctions serverless pour rester compatible avec le plan Hobby:

- `/api/checklist-v3`
- `GET /api/checklist-v3?action=detail`
- `GET /api/checklist-v3?action=catalog`
- `GET /api/checklist-v3?action=assets`
- `/api/v1` pour l'API REST MongoDB
- `/api-docs` pour la documentation moderne
- `/swagger` pour la console interactive
- `/checklist` et `/assets` pour les vues Next.js
- `/admin` redirige vers `/` en attendant le futur depot `dashboard_Admin`

Configurer `MONGODB_URI`, `NODE_ENV=production`, `API_PUBLIC_URL`,
`API_ADMIN_SECRET` et
`POKEMON_GO_DATA_TOKEN` dans les variables d'environnement Vercel. Le token doit pouvoir
lire le depot prive `PokemonGo-Data`. Les pushes GitHub redeploient automatiquement le
projet lorsque l'integration GitHub est active.

Les outils sensibles de modification, validation, veille et correction sont retires de
ce depot public. Les anciennes actions internes de `/api/checklist-v3` exigent
`x-api-admin-secret`, puis renvoient une reponse `410 Gone` car elles sont migrees dans
`dashboard_Admin`.

La progression manuelle est stockee dans `localStorage`. Elle reste disponible sur le
meme navigateur, mais n'est pas synchronisee automatiquement entre plusieurs appareils.

Les outils d'import et d'extraction manuels vivent dans `scripts/import/`.

## Ajouter Un Pokemon

1. Creer un fichier dans `PokemonGo-Data/pokemon/`.
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
- Images Pokémon GO principales via `assets.image` et `assets.shinyImage`.
- Assets séparés via `assets.assetsRef` vers
  `PokemonGo-Data/pokemon-assets/core/<catégorie>/*.assets.json`; le Core référence les
  familles HOME, Shuffle, Variants et Location Cards uniquement lorsqu’elles existent.
- PvP dédié via `pvpRef` vers
  `PokemonGo-Data/pvp/pokemon/<catégorie>/*.pvp.json` sans classement artificiel.
- Traductions principales dans les objets `names`.
- `regionForms`, `megaEvolutions`, `dynamaxForms` et `gigantamaxForms` sont des listes de références `formId`.
- Les données complètes de chaque forme vivent uniquement dans `PokemonGo-Data/pokemon-forms/`.
- `regionId` référence `PokemonGo-Data/generations/`; l'API recompose la région traduite et la génération.
- `weatherBoost` référence les identifiants du catalogue `PokemonGo-Data/weather/`.
- Les icônes Pokémon Shuffle vivent dans le fichier `.shuffle.json` de leur fiche exacte,
  sous la même catégorie (normale, forme, Méga, Dynamax ou Gigamax), et sont importées avec
  `npm run import:pokemon-shuffle:write`. Les fichiers sans fiche compatible restent
  dans la galerie globale et dans `PokemonGo-Data/pokemon-shuffle-import-report.json`.
- Les quatre champs d'attaques des Pokemon sont des tableaux d'identifiants.
- Les details des attaques vivent uniquement dans `PokemonGo-Data/moves/`, y compris `max/` et `gmax/`.
- `primaryType`, `secondaryType` et `type` d'attaque utilisent les identifiants courts de `PokemonGo-Data/types/`, par exemple `"GRASS"`.
- `pvpRef` référence la fiche PvP séparée de la même catégorie ; la projection `pvp`
  éventuellement hydratée par l’API est dérivée et ne constitue jamais une seconde source.
- `megaEnergyReward` peut valoir `null` lorsqu'il n'y a pas d'energie Mega a gagner.
- Les evolutions pointent vers `targetFormId`; la cible peut ne pas encore exister si tu ajoutes les fiches au fur et a mesure.
- Les formes Dynamax et Gigantamax utilisent `baseFormId`, leur propre `slug`, leur propre bloc `maxCp` (`maxLevel50`, `maxLevel40`, `maxBattlesLevel20`) et `maxBattle`.
- `hasGigantamaxEvolution: true` implique une référence canonique dans
  `gigantamaxForms`; la fiche Gigamax possède son propre Core sous
  `pokemon-assets/core/gigantamax/`.

La convention complète de classification, résolution, import, Engine et rollback est
décrite dans [docs/ENTITY-CATEGORY-ARCHITECTURE.md](docs/ENTITY-CATEGORY-ARCHITECTURE.md).
Le contrat de publication transversal, le versioning et la dépréciation sont définis
dans [docs/CANONICAL-DATA-CONTRACTS.md](docs/CANONICAL-DATA-CONTRACTS.md).

## Licence

Projet sous licence ISC.
