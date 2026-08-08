---
id: ADR-CATEGORY-001
title: Résolution API des catégories Pokémon
status: canonical
lang: fr
version: 1.21.0
updated_at: 2026-08-08
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
  - Dashboard Admin
related:
  - RULE-ENTITY-CATEGORY-001
  - COMP-ENGINE-001
  - DATASET-POKEMON-001
---

# Résolution API des catégories Pokémon

## Contrat partagé

L’API consomme l’architecture canonique PokemonGo-Data avec cinq catégories :
`NORMAL`, `FORM`, `MEGA`, `DYNAMAX` et `GIGANTAMAX`, respectivement stockées dans
`normal`, `forms`, `mega`, `dynamax` et `gigantamax`.

`src/lib/entity-category.js` centralise la classification et la construction de chemin
`family + entityCategory + canonicalFilename`. Les routes, le sync, l’Engine et les
services ne doivent pas concaténer ces chemins eux-mêmes.

## Chargement, caches et index

Le sync parcourt récursivement :

```text
pokemon-assets/<famille>/<catégorie>/
pvp/pokemon/<catégorie>/
```

Chaque document Pokémon, Core et famille MongoDB conserve `entityCategory`. Le Core est
persisté dans `pokemonAssets`; les familles secondaires dans `pokemonAssetFamilies`.
Les loaders hydratent uniquement les références présentes dans `assetRefs`. Une famille
absente ne produit ni document, ni cache, ni référence vide.

`pvpRef` est résolu avec la même classification. Un statut PvP non classé reste tel quel :
l’API ne transforme jamais `UNSUPPORTED_FORM`, `NOT_RANKED` ou `MAPPING_MISSING` en
`RANKED`.

## Validation

Avant import, l’API vérifie catégorie, dossier, référence, `id`, `formId`, `baseFormId`,
`form`, `slug`, `dexId`, collisions et orphelins. Les diagnostics canoniques sont :

- `ENTITY_CATEGORY_MISMATCH` ;
- `PVP_WRONG_CATEGORY_DIRECTORY` ;
- `ASSET_WRONG_CATEGORY_DIRECTORY` ;
- `REFERENCE_CATEGORY_MISMATCH` ;
- `ENTITY_CLASSIFICATION_AMBIGUOUS`.

Une classification ambiguë bloque le sync ; aucun choix n’est deviné depuis le nom du
fichier.

## Vérification et rollback

```bash
POKEMON_GO_DATA_DIR=../PokemonGo-Data npm run sync:dry
npm test
npm run build
```

Le rollback consiste à déployer un nouveau commit API compatible avec la révision Data
ciblée. Il ne supprime aucune collection à l’aveugle et ne réécrit pas l’historique Git.
