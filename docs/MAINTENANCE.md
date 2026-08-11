---
id: RULE-MAINTENANCE-001
title: Maintenance des données
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
  - RULE-ROLLBACK-001
  - COL-MONGODB-SYNC-001
---

# Maintenance Des Données

## Sources De Vérité

- Le depot prive `PokemonGo-Data` contient les JSON sources.
- `PokemonGo-Data/data/pokemon/normal/` contient uniquement les fiches principales.
- `PokemonGo-Data/data/pokemon/` contient les données complètes de chaque forme.
- `regionForms`, `megaEvolutions`, `dynamaxForms` et `gigantamaxForms` sont des
  listes de références `formId`.
- `PokemonGo-Data/data/moves/`, `PokemonGo-Data/data/reference/types/`, `PokemonGo-Data/data/reference/generations/` et `PokemonGo-Data/data/reference/weather/` sont les
  catalogues centraux.
- Les fiches complètes utilisent `regionId`; ne jamais recopier l'objet région ni
  la génération. Les formes Méga et Max héritent ces informations de leur base.
- `weatherBoost` et `PokemonGo-Data/data/reference/types/*/weatherBoost` utilisent les identifiants de
  `PokemonGo-Data/data/reference/weather/`.

Ne jamais recopier les données complètes d'une forme dans une fiche principale.

## Contrôles Avant Contribution

```bash
npm run migrate:json-order:write
npm run audit:forms
npm run audit:identifiers
npm run audit:moves
npm run audit:weather
npm test
```

Le normaliseur d'ordre vérifie que les valeurs sont strictement identiques avant
chaque écriture.

## Acces Aux Operations Sensibles

Les operations d'import, de migration, de generation et de synchronisation restent des
outils internes executes par CLI, workflow ou Dashboard Admin. Elles ne doivent pas etre
exposees comme routes publiques.

Toute route HTTP future qui declenche une ecriture, une maintenance, une generation,
un export sensible ou un debug doit utiliser le helper `requireAdminSecret(request)` et
verifier le header :

```http
x-api-admin-secret: <secret>
```

Le secret doit venir de `API_ADMIN_SECRET` cote serveur uniquement.

La checklist valide tous les champs obligatoires de chaque famille de fiche :
Pokémon normal, forme complète, Méga / Primo et forme Max. Un asset complémentaire
comme Pokémon Shuffle ne remplace jamais les images Pokémon GO obligatoires d'une
fiche déjà sortie.

Les migrations `npm run migrate:regions` et `npm run migrate:weather` doivent
indiquer `changedFiles: 0` après une contribution. Utiliser leurs variantes
`:write` uniquement lorsqu'une migration centrale est réellement nécessaire.

## Imports D'assets

```bash
npm run import:pokemon-shuffle
npm run import:pokemon-shuffle:write
npm run import:enrich-forms
npm run import:enrich-forms:write
```

Toujours contrôler le mode sans `:write` avant l'écriture. L'importeur Shuffle associe
chaque fichier à une seule fiche exacte, utilise `chromatique` pour le shiny et classe
les suffixes `shadow`, `purified`, `dynamax` et `gigantamax`. Les fichiers sans fiche
compatible restent dans la galerie et sont listés dans
`PokemonGo-Data/pokemon-shuffle-import-report.json`.

## Évolution Du Schéma

Toute évolution doit avoir une migration reproductible, un audit, une mise à jour de
la documentation et un test. Éviter les modifications manuelles répétitives.
