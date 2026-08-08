# Importer les JSON dans MongoDB

Ce projet importe les referentiels statiques depuis le depot local `PokemonGo-Data`,
puis les ecrit dans MongoDB avec les scripts de synchronisation.

Les datasets dynamiques `raids`, `eggs`, `maxbattles`, `researches` et `rockets`
sont explicitement exclus de `npm run sync`. Leur document `{ key: "current" }`
est géré uniquement par le pipeline de régénération externe. Cette séparation
empêche un ancien JSON local d'écraser une régénération MongoDB plus récente.

Pour ces cinq datasets, MongoDB est l'unique source lue par le Dashboard. Une
source web n'est qu'une entrée du pipeline de régénération ; le Dashboard ne lit
jamais directement cette page ni un fichier JSON local.

## 1. Verifier la source locale

En local, garde les deux dossiers au meme niveau :

```bash
Workflow/
  PokemonGo-API-/
  PokemonGo-Data/
```

Si le dossier data est ailleurs, renseigne son chemin :

```bash
export POKEMON_GO_DATA_DIR="/chemin/vers/PokemonGo-Data"
```

Le script `npm run ensure:data` cherche d'abord `POKEMON_GO_DATA_DIR`, puis
`../PokemonGo-Data`. Sur Vercel, il peut cloner le depot data dans `.data/PokemonGo-Data`.

## 2. Tester sans ecrire

Avant d'ecrire dans MongoDB, lance toujours :

```bash
npm run sync:dry
```

Cette commande lit tous les JSON et affiche les compteurs, mais ne se connecte pas a
MongoDB. C'est le bon controle apres un ajout comme `damageMultiplier` dans les types
ou `assets.candy` dans les fiches Pokemon. Le dry-run doit aussi afficher
`pokemonAssets` et `pokemonAssetFamilies`, générés récursivement depuis les Core et les
familles catégorisées de `PokemonGo-Data/pokemon-assets`.

## 3. Importer dans MongoDB

Quand le dry-run est bon et que `MONGODB_URI` est present dans `.env` :

```bash
npm run sync
```

Le sync fait des `upsert` par collection :

- `pokemons` avec la cle unique `key`
- `pokemonAssets` avec la cle unique `formId`
- `pokemonAssetFamilies` avec la clé unique `family:formId`
- `moves` avec la cle unique `id`
- `types` avec la cle unique `id`
- `weather`, `regions`, `generations`
- `globalstats` pour les statistiques globales

Il ne lit et n'écrit jamais les cinq fichiers `current*.json` dynamiques. Les JSON
de raids, œufs, Max Battles, Research et Rocket peuvent rester dans le dépôt comme
références, fixtures de test ou exports explicites. Ils ne sont ni une source de
production, ni un fallback, ni une entrée du job MongoDB global.

Chaque document `pokemons` garde dans `data` le JSON principal sans assets lourds :
gameplay, stats, attaques, PvP, disponibilités, images principales, candy et
`assets.assetsRef`. Le Core vit dans `pokemonAssets`; chaque payload secondaire vit dans
`pokemonAssetFamilies` et porte `family`, `formId` et `entityCategory`. Les documents
sont liés par `formId`, puis hydratés exclusivement depuis les références `assetRefs`
du Core. Un fichier dans une mauvaise catégorie bloque le sync.

Les routes de détail hydratent automatiquement la fiche en lisant
`data.assets.assetsRef`, puis les références secondaires du Core. `pvpRef` est validé
contre la même catégorie avant import.
La liste des Pokemon reste volontairement plus légère.

## 4. Flux des cinq datasets `current`

Les cinq domaines dynamiques suivent le même flux atomique :

1. récupérer la source externe autorisée ;
2. parser puis enrichir les entrées ;
3. valider le dataset complet ;
4. calculer son hash canonique et la diff avec la version MongoDB précédente ;
5. faire un `upsert` du document `{ key: "current" }` dans la collection du domaine ;
6. invalider les caches du domaine ;
7. relire le document depuis MongoDB et vérifier le hash et le compteur sauvegardés.

Chaque tentative crée aussi un document `dataset_runs` avant la récupération. Le même document passe ensuite à `success`, `partial`, `unchanged` ou `failed` et conserve fournisseur, URL, dates, durée, hashes, compteurs, diff, warnings, erreurs et entrées non matchées détaillées. Les routes privées `GET /api/v1/<domain>/history` exposent cette chronologie sans renvoyer les datasets complets.

Le Dashboard utilise ensuite exclusivement cette relecture MongoDB pour
`Actualiser`, l'affichage, les compteurs, les diagnostics et le téléchargement.
Une erreur MongoDB est donc affichée explicitement ; elle ne déclenche jamais un
retour silencieux vers un fichier local.

La route `/import` est une opération de maintenance protégée. Elle exige un payload
JSON explicite et valide, puis passe par les mêmes étapes de validation, hash, diff,
upsert, invalidation et relecture. Un payload absent ne provoque aucune lecture d'un
`current*.json` local.

### Règle particulière des raids

La seule URL source des raids est :

`https://leekduck.com/raid-bosses/`

Le mode normal ou événement est détecté à partir du contenu courant de cette page
(sections et marqueurs tels que `SELECTED EVENT`). Le pipeline n'utilise jamais
`/gofest/raids/` et ne contient aucune activation, date, liste de Pokémon ou nombre
d'entrées codé en dur pour forcer un événement.

## 5. Déploiement Vercel

Apres un import local valide :

```bash
npm run check
npx vercel deploy --prod --yes
```

Sur Vercel, verifie que les variables suivantes existent selon ton setup :

- `MONGODB_URI`
- `POKEMON_GO_DATA_TOKEN` si le depot `PokemonGo-Data` est prive
- `POKEMON_GO_DATA_REF` si tu veux cloner une branche autre que `main`

### Game Master Explorer

La régénération privée Game Master écrit d'abord un staging complet, puis active le snapshot par le pointeur `game_master_states/current`. Les templates ne persistent qu'une copie du JSON brut et un texte de recherche borné ; les propriétés aplaties du détail sont reconstruites à la lecture.

Deux snapshots sont conservés par défaut (`GAME_MASTER_SNAPSHOT_RETENTION`). Avant chaque régénération, les staging orphelins âgés d'au moins quinze minutes sont supprimés. Un quota Atlas saturé retourne `507 GAME_MASTER_STORAGE_QUOTA_EXCEEDED`, nettoie la tentative courante et conserve l'ancien snapshot actif.

`GET /api/v1/admin/game-master/runs` expose le même contrat d’exécution centralisé. Les snapshots décrivent les versions de contenu ; les runs décrivent toutes les tentatives, y compris les contenus inchangés et les échecs.

## 6. Réflexe de sécurité data

Avant toute modification massive dans `PokemonGo-Data`, lance le backup de refonte ou
copie les JSON originaux dans `archive JSON/<date-heure>/`. C'est la sauvegarde locale
qui permet de recuperer les donnees avant enrichissement ou migration.
