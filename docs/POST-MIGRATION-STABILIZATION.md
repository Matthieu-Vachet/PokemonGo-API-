---
id: ADR-API-STABILIZATION-001
title: Contrat API stabilisé après migration PvP et Assets
status: canonical
lang: fr
version: 1.21.0
updated_at: 2026-08-09
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
  - Dashboard Admin
---

# Contrat API stabilisé après migration PvP et Assets

## Lecture de PokemonGo-Data

La source JSON utilise `assetsRef` et `pvpRef` à la racine. Le Core est l’unique
autorité des images, portraits, bonbons, couleurs et références secondaires ; la fiche
PvP dédiée est l’unique autorité des ligues et statuts PvP. MongoDB conserve ces chemins
dans `data.assetsRef` et `data.pvpRef`. Les champs `assets` ou `pvp` exposés après
hydratation sont des projections API dérivées, jamais une deuxième source modifiable.

L’ordre de résolution est : `POKEMON_GO_DATA_DIR` explicite et valide, clone officiel
`.data/PokemonGo-Data`, dépôt workspace voisin, puis compatibilité locale historique.
Une variable explicite invalide échoue clairement. Vercel clone la révision déclarée par
`POKEMON_GO_DATA_REPO` et `POKEMON_GO_DATA_REF` ; aucun chemin absolu de machine n’est
configuré en production.

## Sources et Identity Manager

`PokemonGo-Data/source-watch/sources.json` est le registre fermé des sources de
régénération. Les provenances `leekduck-eggs`, `leekduck-research` et
`leekduck-rocket` sont résolues vers l’unique provider Identity Manager `leekduck`.
La synchronisation du 9 août a appliqué 1 920 mises à jour et 5 créations, marqué 2
anciens documents orphelins sans les supprimer et produit zéro conflit. Le relink
`CORSOLA_SPRING_2026` reste une règle exacte et idempotente, pas une heuristique.

## Régénérations et statuts

Les datasets sont générés, validés, persistés atomiquement puis relus. PvP expose
`running`, `success`, `partial`, `unchanged` et `failed`; le Dashboard ajoute ses états
d’interface `idle` et `cancelled`. `partial` est terminal et non bloquant : le nouveau
document est actif, avec ses compteurs de diagnostics. `failed` n’active jamais un
payload incomplet.

La validation de production a relu 20 436 lignes PvP, zéro mapping manquant et zéro
entrée non appariée ; le warning Volcarona Bayou maintient honnêtement l’état `partial`.
Best Defenders transforme le `403` Cloudflare en `SOURCE_PROTECTED` et conserve le
dernier snapshot MongoDB valide. Les calendriers Events et GBL sont des pipelines
distincts : Events conserve `sourceRun` et son archive, GBL persiste le dataset
Battleflow versionné.

## Engine et PvPoke

Le snapshot PvPoke épinglé est
`ea8f7691cdee95cb33a485b8e89ff39819d41ba4`. Les 1 611 fiches dédiées ont zéro
mapping Pokémon manquant et zéro attaque référencée sans mapping. Le seul écart de
movepool, `SKIDDO`/`ROCK_SLIDE`, est une information fournisseur
`SOURCE_MISMATCH`. L’Engine n’exige aucun champ `pvp.*` embarqué.

## Versionnement, déploiement et rollback

La version API et OpenAPI reste `1.21.0`; la clarification documentaire ne modifie pas
le payload public. Data `1.21.0` et Dashboard `1.43.0` évoluent indépendamment. Une
rupture du contrat stable nécessite une version majeure et une période de dépréciation.

Un rollback restaure des révisions Data/API/Dashboard compatibles dans de nouveaux
commits. Il vérifie d’abord schémas, manifestes, dry-run MongoDB, Identity Manager,
Engine et API, puis déploie Data → API → Dashboard. Les archives, snapshots courants et
historiques de run sont conservés ; aucun reset destructif ou force-push n’est admis.
