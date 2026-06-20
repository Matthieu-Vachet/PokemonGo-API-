# Guide Des Fichiers JavaScript

Ce document explique le rôle des fichiers JavaScript du projet. Les scripts ne sont jamais
exécutés automatiquement lors d'une simple lecture de l'API : ils servent au serveur, aux
imports, aux migrations, aux audits ou à la synchronisation.

## Entrées Principales

| Fichier | Rôle |
| --- | --- |
| `app.js` | Démarre le serveur Express local. |
| `api/rest.js` | Expose l'API comme fonction serverless Vercel. |
| `api/checklist-v3.js` | Regroupe la checklist publique read-only, les détails de fiche, les catalogues et les audits d'assets. |
| `api/blocked.js` | Bloque les accès directs aux sources internes quand le site est déployé sur Vercel. |
| `app/*.js` | Pages Next.js du front public. `/admin` redirige vers `/` en attendant `dashboard_Admin`. |
| `components/**/*.jsx` | Composants UI réutilisables, documentés dans Storybook. |
| `src/lib/data-repository.js` | Résout le depot `PokemonGo-Data` depuis l'environnement, `.data/` ou le dossier voisin. |
| `src/lib/checklist-auth.js` | Ancien support d'auth checklist conservé pour compatibilité locale, non utilisé par l'API publique read-only. |
| `src/lib/site-dashboard.js` | Prépare les statistiques et aperçus affichés par le nouveau front Next.js. |

## Scripts D'import

| Fichier | Rôle |
| --- | --- |
| `scripts/import/download-pokemon.js` | Télécharge les fiches Pokémon brutes. |
| `scripts/import/extract-pokemon-forms.js` | Extrait et normalise les formes Pokémon. |
| `scripts/import/enrich-pokemon.js` | Ajoute les informations générales, PC et PvP manquantes. |
| `scripts/import/location-cards.js` | Associe les backgrounds aux Pokémon éligibles. |
| `scripts/import/shadow-pokemon.js` | Synchronise les Pokémon Shadow sortis. |
| `scripts/import/dynamax-pokemon.js` | Synchronise les Pokémon Dynamax et leurs attaques Max. |
| `scripts/import/visual-assets.js` | Associe les portraits Méga, fonds de types et construit le catalogue stickers. |
| `scripts/import/pokemon-shuffle.js` | Associe chaque icône Pokémon Shuffle à une seule fiche normale ou de forme et produit le rapport des fichiers sans cible. |
| `scripts/import/enrich-pokemon.js` | Enrichit les Pokémon normaux ou, avec `--forms`, les formes régionales depuis le Game Master et PvPoke. |

Les commandes sans suffixe `:write` simulent généralement le résultat. Les commandes
`:write` modifient les fichiers JSON dans le depot `PokemonGo-Data`.

## Scripts De Migration

| Fichier | Rôle |
| --- | --- |
| `scripts/migrate/complete-move-catalog.js` | Complète le catalogue central des attaques. |
| `scripts/migrate/home-assets.js` | Normalise les assets Pokémon Home. |
| `scripts/migrate/normalize-identifiers.js` | Normalise IDs, formIds et slugs. |
| `scripts/migrate/normalize-max-forms.js` | Réduit les fiches Dynamax/Gigantamax à leurs différences utiles. |
| `scripts/migrate/normalize-moves.js` | Remplace les attaques embarquées par leurs identifiants. |
| `scripts/migrate/normalize-types.js` | Normalise les références de types. |
| `scripts/migrate/type-assets.js` | Associe les icônes de types au catalogue. |
| `scripts/migrate/extract-form-references.js` | Extrait les formes intégrées puis conserve seulement leurs références. |
| `scripts/migrate/order-json-keys.js` | Uniformise l'ordre logique des clés sans modifier les valeurs. |
| `scripts/migrate/centralize-regions.js` | Remplace les régions et générations dupliquées par `regionId`. |
| `scripts/migrate/weather-catalog.js` | Construit le catalogue météo central et ses références de types. |

## Audits Et Synchronisation

| Fichier | Rôle |
| --- | --- |
| `scripts/audit/identifiers.js` | Détecte les IDs dupliqués et références invalides. |
| `scripts/audit/forms.js` | Vérifie les références vers les fiches de formes séparées. |
| `scripts/audit/moves.js` | Vérifie toutes les références d'attaques. |
| `scripts/audit/weather.js` | Vérifie les références météo, types boostés et icônes. |
| `scripts/sync/run.js` | Synchronise les JSON vers MongoDB, ou simule avec `--dry-run`. |
| `scripts/sync/watch.js` | Relance la synchronisation lors des modifications locales. |
| `scripts/data/ensure-data.js` | Trouve ou clone `PokemonGo-Data` avant les tests, builds et synchronisations. |

## Code Du Serveur

- `src/app.js` configure Express, sécurité, documentation et gestion des erreurs.
- `src/routes/*.js` définit les routes REST publiques.
- `src/routes/shuffle.js` expose les assets Shuffle associés avec filtres par état, forme et shiny.
- `src/routes/weather.js` expose le catalogue météo et les Pokémon, types et attaques associés.
- `src/services/*.js` contient la logique métier partagée.
- `src/models/*.js` définit les modèles MongoDB.
- `src/sync/source-reader.js` transforme les fichiers JSON en documents MongoDB.
- `src/docs/*.js` génère OpenAPI, Swagger et Redoc.
- `src/lib/*.js` contient les fonctions techniques réutilisables.
- `apps/checklist/server/*.js` alimente la checklist locale et ses outils.
- `apps/checklist/server/source-watch.js` vérifie les dépôts GitHub et sites déclarés
  dans `PokemonGo-Data/source-watch/sources.json`; l'action publique Vercel est
  désactivée dans ce depot read-only.

## Commandes Sûres

```bash
npm test
npm run sync:dry
npm run audit:moves
npm run audit:identifiers
npm run audit:weather
npm run import:visual-assets
```

Ces commandes contrôlent ou simulent les données sans synchroniser la base de production.
