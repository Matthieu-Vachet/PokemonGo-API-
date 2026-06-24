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

Elle lit `PokemonGo-Data`, transforme les fichiers JSON, ecrit les collections MongoDB et
reconstruit les index.

Le workflow GitHub est:

`.github/workflows/sync-mongodb.yml`

Il se lance dans trois cas:

- manuellement avec `workflow_dispatch`;
- via `repository_dispatch` avec le type `pokemon-go-data-updated`;
- quand le code de synchronisation du repo API change sur `main`.

Donc, apres un push dans `PokemonGo-Data`, la synchronisation est automatique seulement si
le depot data envoie bien un `repository_dispatch` vers `PokemonGo-API-` avec un token GitHub.

## Collections MongoDB principales

- `pokemons`: gameplay, stats, moves, PVP, images principales et `assetsRef`.
- `pokemonAssets`: assets lourds separes.
- `moves`, `types`, `weather`, `generations`: catalogues utilises par l'API.
- `syncRuns`: historique des synchronisations.

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
