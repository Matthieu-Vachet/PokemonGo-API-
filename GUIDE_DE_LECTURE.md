# Guide de lecture - PokemonGo-API-

Ce projet sert a publier l'API Pokemon GO, synchroniser MongoDB et afficher la bibliotheque
API publique.

## Par ou commencer

- `src/server.js` lance le serveur Express de l'API.
- `src/routes/` contient les routes publiques.
- `src/models/` contient les schemas MongoDB.
- `src/services/` contient la logique metier appelee par les routes.
- `src/sync/` transforme les JSON de `PokemonGo-Data` en documents MongoDB.
- `scripts/sync/run.js` lance la synchronisation MongoDB.
- `src/app/` et `src/components/` contiennent la bibliotheque API en Next.js.
- `docs/` contient la documentation technique.

## Synchronisation MongoDB

La commande principale est:

```bash
npm run sync
```

Elle lit les référentiels statiques de `PokemonGo-Data`, transforme les fichiers JSON,
écrit leurs collections MongoDB et reconstruit leurs index. Les collections dynamiques
`raids`, `eggs`, `maxbattles`, `researches` et `rockets` sont exclues : leurs documents
`{ key: "current" }` sont gérés uniquement par le pipeline commun de régénération.

Les fichiers `current*.json` conservés dans `PokemonGo-Data` servent uniquement de
références, de fixtures de test ou d'exports. Ils ne sont jamais importés par
`npm run sync` et ne sont pas des fallbacks de production.

Le workflow GitHub est:

`.github/workflows/sync-mongodb.yml`

Il se lance dans trois cas:

- manuellement avec `workflow_dispatch`;
- via `repository_dispatch` avec le type `pokemon-go-data-updated`;
- quand le code de synchronisation du repo API change sur `main`.

Donc, apres un push dans `PokemonGo-Data`, la synchronisation est automatique seulement si
le depot data envoie bien un `repository_dispatch` vers `PokemonGo-API-` avec un token GitHub.

## Datasets dynamiques `current`

Pour raids, œufs, Max Battles, Research et Rocket, le contrat est le suivant :

- MongoDB est l'unique source lue par le Dashboard ;
- `Actualiser` relit MongoDB sans fallback local ;
- `Régénérer` exécute le flux source externe, parsing, enrichissement,
  validation, hash canonique, diff, `upsert`, invalidation du cache, puis relecture
  et vérification MongoDB ;
- le téléchargement exporte le document courant relu depuis MongoDB avec ses
  métadonnées, pas un JSON déployé ;
- `/import` est réservé à la maintenance protégée et exige toujours un payload
  explicite ; l'absence de payload est une erreur, jamais une demande de lecture locale.

Toutes les écritures passent par le même pipeline afin que le hash, la diff, les
diagnostics et la relecture MongoDB aient la même sémantique pour les cinq domaines.

### Source des raids

Les raids ont exactement une source : `https://leekduck.com/raid-bosses/`.
Le mode événement est déduit du contenu de cette page, notamment des sections ou
marqueurs comme `SELECTED EVENT`. Il n'existe aucun appel vers `/gofest/raids/` et
aucune date, activation, liste de Pokémon ou taille attendue codée en dur pour
simuler un événement.

## Collections MongoDB principales

- `pokemons`: gameplay, stats, moves, PVP, images principales et `assetsRef`.
- `pokemonAssets`: assets lourds separes.
- `moves`, `types`, `weather`, `generations`: catalogues utilises par l'API.
- `syncRuns`: historique des synchronisations.
- `raids`, `eggs`, `maxbattles`, `researches`, `rockets`: un document dynamique
  courant par collection, identifié par `{ key: "current" }`.

## Bibliotheque API publique

La bibliotheque est la vitrine visiteur. Elle doit rester read-only:

- pas de regles JSON;
- pas de diagnostics internes;
- pas de controles admin;
- seulement des donnees, assets, docs et exemples d'API.

Pour changer l'affichage public, commencer par les composants dans `src/components/site/`.

## Commandes utiles

```bash
npm run sync:dry
npm test
npm run build
npm run sync
```

Pour verifier que MongoDB a recu les changements:

```bash
curl https://pokemon-go-api.vercel.app/api/v1/meta/sync
```
