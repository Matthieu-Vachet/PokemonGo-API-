---
id: ADR-CANONICAL-001
title: Contrats canoniques Pokemon GO
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
  - RULE-CANONICAL-001
  - RULE-ENTITY-CATEGORY-001
  - API-POKEMON-001
  - DATASET-POKEMON-001
  - DATASET-PVP-001
  - PROVIDER-PVPOKE-001
  - PAGE-ADMIN-CONTROLS-001
  - COMP-ENGINE-001
  - COL-POKEMON-001
---

# Contrats canoniques Pokemon GO

Ce document fixe la convention de publication commune à `PokemonGo-Data`,
`PokemonGo-API-` et `Dashboard Admin`. Toute évolution de schéma, de générateur, de
résolveur, de synchronisation ou d’interface doit rester compatible avec ce contrat ou
être publiée comme une évolution versionnée et documentée.

## Vocabulaire et autorités

- Une donnée **canonique** est une vérité validée et versionnée dans
  `PokemonGo-Data`. Elle possède une identité stable et ne dépend pas de la disponibilité
  instantanée d’un fournisseur.
- Une donnée **dérivée** est calculée sans modifier la vérité canonique : index MongoDB,
  manifeste, hash, résumé d’audit, projection API, cache ou statistique Dashboard. Elle
  doit pouvoir être reconstruite depuis ses entrées déclarées.
- Une donnée **fournisseur** conserve sa provenance, sa date d’observation et son
  identifiant brut. Elle ne devient canonique qu’après résolution explicite par
  l’Identity Manager et validation du pipeline concerné.

Les identifiants permanents structurent les décisions et contrats :
`RULE-CANONICAL-001`, `ADR-CANONICAL-001`, `API-POKEMON-001`,
`DATASET-POKEMON-001`, `PROVIDER-PVPOKE-001`, `PAGE-ADMIN-CONTROLS-001`,
`COMP-ENGINE-001` et `COL-POKEMON-001`.

## Identité et catégories Pokémon

Une entité est identifiée par `id`, `formId`, `baseFormId`, `slug`, `dexId` et ses
relations canoniques. `entityCategory` vaut exclusivement `NORMAL`, `FORM`, `MEGA`,
`DYNAMAX` ou `GIGANTAMAX`. La classification partagée exploite le contenu canonique et
les relations `hasMegaEvolution`, `megaEvolutions`, `dynamaxForms`,
`hasGigantamaxEvolution` et `gigantamaxForms`; le nom du fichier seul ne décide jamais.
Une ambiguïté produit `ENTITY_CLASSIFICATION_AMBIGUOUS` et bloque l’écriture.

La résolution de chemin est centralisée sous la forme
`family + entityCategory + canonicalFilename`. Assets, PvP, Engine, API, Dashboard,
imports, caches, index et générateurs utilisent la même fonction. Les répertoires sont :

```text
pokemon-assets/<core|home|shuffle|location-cards|variants>/<normal|forms|mega|dynamax|gigantamax>/
pvp/pokemon/<normal|forms|mega|dynamax|gigantamax>/
```

`assetsRef`, `assetRefs.*` et `pvpRef` incluent toujours la catégorie. Une ressource
placée dans une autre catégorie est invalide. Une famille secondaire absente n’entraîne
ni fichier vide, ni référence inutile.

## PvP et fournisseur PvPoke

`PROVIDER-PVPOKE-001` fournit des observations de classement. La fiche séparée
`DATASET-PVP-001` conserve la provenance, la version fournisseur, la date de collecte,
les ligues et les profils Rank 1 réellement disponibles. L’API et le Dashboard chargent
le contenu via `pvpRef`; aucun bloc PvP historique embarqué n’est une seconde autorité.

Une absence exploitable reste une absence explicite. `UNSUPPORTED_FORM`, `NOT_RANKED`
et `MAPPING_MISSING` ne sont jamais transformés en classement artificiel. Une Méga,
forme Dynamax ou Gigamax sans donnée PvPoke ne reçoit pas de fiche `RANKED` inventée.
La synchronisation PvPoke mensuelle est un pipeline contrôlé : génération, validation,
hash, diff, staging, persistance, relecture, rapport et publication. Un résultat vide ou
ambigu échoue sans remplacer l’état valide précédent.

## Assets et fiches Pokémon

Le Core séparé contient les références légères et les métadonnées communes. `home`,
`shuffle`, `location-cards` et `variants` n’existent que si une donnée réelle existe.
Les manifestes comptent chaque famille par catégorie et vérifient les collisions,
orphelins, mauvaises références et pertes de fichiers.

Les fiches publiques conservent les champs stables suivants : `id`, `formId`,
`baseFormId`, `slug`, `dexId`, `entityCategory`, `data.assets.assetsRef`,
`data.assetRefs` et `data.pvpRef`. Les sections Bonbons utilisent `familyId` et les
images canoniques Candy/XL.
Une fiche Méga tente d’abord l’asset Pokémon GO canonique ; une image HOME ne peut être
utilisée qu’en fallback explicite et traçable, jamais pour masquer un asset GO invalide.

## Engine, Identity Manager et Veille

`COMP-ENGINE-001` contrôle les identités, catégories, chemins, références, manifestes,
collisions et statuts d’absence. Son rapport sérialisable couvre Pokémon, formes,
attaques, types, météo, générations, Assets et PvP, avec les diagnostics
`ENTITY_CATEGORY_MISMATCH`, `PVP_WRONG_CATEGORY_DIRECTORY`,
`ASSET_WRONG_CATEGORY_DIRECTORY`, `REFERENCE_CATEGORY_MISMATCH` et
`ENTITY_CLASSIFICATION_AMBIGUOUS`.

L’Identity Manager conserve séparément l’alias brut, l’alias normalisé, le provider et
l’identité canonique. Les conflits nécessitent une résolution explicite. La Veille
observe les fournisseurs et expose date, état, hash ou code HTTP ; une observation ne
modifie jamais automatiquement un JSON canonique.

Le Dashboard ne possède plus de page autonome de vérification Pokémon. Les contrôles
canoniques sont regroupés dans `PAGE-ADMIN-CONTROLS-001`, qui consomme le rapport Engine
et les résolveurs partagés. Les composants ne construisent aucun chemin de ressource.

## Contrat public de l’API

`API-POKEMON-001` publie des lectures versionnées sous `/api/v1`. OpenAPI est la
description exécutable du contrat. Les routes de détail peuvent hydrater les Assets et
le PvP séparés, tandis que les listes restent légères. Les routes administratives,
secrets, données de staging et diagnostics privés restent absents d’OpenAPI.

Une réponse publique conserve les champs stables ci-dessus. Un ajout rétrocompatible
est autorisé dans la version majeure courante. Renommer, supprimer ou changer le type
d’un champ exige une dépréciation documentée, une fenêtre de migration et une nouvelle
version majeure de route. Les erreurs suivent la forme structurée `error.code`,
`error.message`, `error.details` éventuel et `error.requestId`.

## Dates, versions, changelog et attribution

- Les dates civiles utilisent `YYYY-MM-DD`; les instants utilisent ISO 8601 UTC.
- Chaque document publié indique sa version de contrat, sa date de mise à jour et ses
  sources. La version API OpenAPI est identique à celle de `package.json`.
- Le versioning suit SemVer. Toute publication met à jour le changelog du dépôt
  concerné et conserve les identifiants permanents des règles et décisions.
- Les données fournisseurs gardent leur URL, leur nom et leur attribution. PvPoke,
  Pokémon GO, PokeMiners, LeekDuck, Margxt et les autres sources ne sont jamais présentés
  comme auteurs de la donnée canonique sans mention de la transformation appliquée.

## Dépréciation et rollback

Une dépréciation est annoncée dans OpenAPI et le changelog avec remplacement, version
cible et date minimale de retrait. Aucun consommateur ne doit dépendre d’un chemin
monolithique d’Assets, d’un bloc PvP embarqué ou d’une ancienne page de vérification.

Le rollback est non destructif : identifier le commit publié, conserver les snapshots
MongoDB et rapports, restaurer par revert explicite ou redéploiement d’un artefact
validé, puis relancer Engine, tests contractuels, sync à blanc et contrôle des
manifestes. Ne jamais utiliser de réinitialisation Git destructive ni supprimer une
source canonique pour corriger une projection dérivée.
