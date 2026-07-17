---
id: ADR-IDENTITY-001
title: Identity Manager Pokémon GO
status: active
lang: fr
version: 1.0.0
updated_at: 2026-07-17
owners:
  - pokemon-data
related:
  - COL-IDENTITY-001
  - API-IDENTITY-001
  - RULE-IDENTITY-001
  - PAGE-IDENTITY-001
---

# Identity Manager Pokémon GO

## Objectif

L’Identity Manager est la référence privée qui relie les identifiants originaux des fournisseurs à une identité canonique PokemonGo-Data. Il conserve séparément la valeur brute, sa valeur normalisée et le fournisseur. Les anciens fichiers de mappings restent disponibles pendant la migration, mais ne constituent plus la source d’administration.

## Architecture

Le flux de résolution suit `source externe → normalisation minimale → provider + alias → identité canonique → PokemonGo-Data`. Le Dashboard appelle uniquement le BFF authentifié ; celui-ci transmet la requête à PokemonGo-API avec le secret serveur. Aucune route publique ne permet de modifier les identités.

Le snapshot historique `pokemon_identity_mappings` reste un diagnostic généré. Les identités administrables sont des documents autonomes et ne sont jamais regroupées dans un document JSON unique.

## Modèle MongoDB

### COL-IDENTITY-001 — `pokemon_identities`

Champs structurants :

- `canonicalId`, unique et stable ;
- `pokemonId`, `form`, `costume` ;
- `status` : `active`, `draft`, `deprecated`, `ignored` ;
- `aliases[]` avec `provider`, `value`, `normalizedValue`, statut, confiance, source et dates ;
- `genderVariants`, utilisé pour exposer la disponibilité mâle/femelle sans dupliquer l’identité fonctionnelle ;
- `localReference`, lien contrôlé vers PokemonGo-Data ;
- `metadata`, informations d’usage et notes ;
- auteurs et dates de création/modification/dépréciation.

Index :

- unique `canonicalId` ;
- `pokemonId` ;
- `aliases.provider` ;
- `aliases.normalizedValue` ;
- composé `aliases.provider + aliases.normalizedValue` ;
- unique multikey `activeAliasKeys`, qui empêche un alias actif d’appartenir à deux identités ;
- `status`, identité fonctionnelle et date de modification.

### `pokemon_identity_history`

Chaque création, modification, alias, fusion, dépréciation ou restauration produit une entrée d’audit contenant l’avant/après, l’utilisateur, le fournisseur, l’alias et le motif.

### `pokemon_identity_diagnostics`

Les alias non résolus sont agrégés par fournisseur, alias normalisé et identifiant source. La première et dernière détection, le nombre d’occurrences, la cause exacte, la confiance et les candidats sont conservés.

## API

### API-IDENTITY-001 — routes privées

Préfixe : `/api/v1/admin/pokemon-identities`.

- `GET /` : recherche, filtres, tri, pagination et statistiques ;
- `POST /` : création ;
- `GET /:id` et `PATCH /:id` : lecture et modification ;
- `DELETE /:id` : dépréciation logique avec motif obligatoire ;
- `POST /:id/restore` et `POST /:id/merge` ;
- `POST /:id/aliases` et `PATCH /:id/aliases/:aliasId` ;
- `POST /resolve` : résolution provider + alias ;
- `GET /conflicts`, `GET /history`, `GET /diagnostics` ;
- `POST /diagnostics` et `PATCH /diagnostics/:id` ;
- `GET /export` ;
- `POST /import` avec `mode: preview` obligatoire avant un `mode: apply` décidé par l’administrateur.

Toutes les routes exigent `x-api-admin-secret`. Le Dashboard ajoute également l’utilisateur authentifié pour l’audit.

## Resolver

### RULE-IDENTITY-001 — ordre de résolution

1. alias brut exact pour le fournisseur ;
2. alias normalisé exact pour le fournisseur ;
3. alias déprécié connu ;
4. règle locale déterministe sans ambiguïté ;
5. suggestion prudente avec score ;
6. non matché.

Le resolver ne choisit jamais le premier candidat lorsqu’il en reste plusieurs. Le catalogue est chargé en lot et mis en cache 30 secondes ; toute mutation invalide ce cache.

## Règles d’intégrité

- aucun provider, alias brut ou alias normalisé vide ;
- aucun doublon provider + alias normalisé dans un document ;
- aucun alias actif partagé entre plusieurs identités ;
- aucune identité active sans Pokémon local valide ; le statut `draft` est l’exception explicite ;
- aucune suppression physique depuis le CRUD ; la dépréciation exige un motif et reste historisée ;
- les imports destructifs sans aperçu sont interdits.

## Gestion des genres

Une variante mâle et femelle d’un même costume est une seule identité, regroupée par `pokemonId + form + costume`. `isFemale` ne sert qu’à sélectionner l’asset final. Sans sexe demandé, la miniature mâle ou neutre est utilisée par défaut. Une forme dont `MALE` ou `FEMALE` appartient réellement au `formId` officiel reste une identité distincte.

## Migration

Commande sans écriture :

```bash
npm run migrate:pokemon-identities
```

Application contrôlée :

```bash
npm run migrate:pokemon-identities:write
```

Le script est idempotent, synchronise les index avant écriture, conserve les sources historiques et rapporte candidats, alias, doublons, conflits, invalides et non migrés.

## Bonnes pratiques

- stocker la valeur fournisseur telle que reçue ;
- utiliser la normalisation uniquement pour la recherche ;
- créer d’abord un brouillon si la fiche locale n’existe pas encore ;
- traiter les conflits depuis l’interface, avec un motif ;
- régénérer le diagnostic après une association importante ;
- préférer les opérations groupées pour les scans.

## Checklist

- [ ] Le `canonicalId` correspond à une identité locale réelle ou le statut est `draft`.
- [ ] Le provider est le provider d’origine.
- [ ] La valeur brute n’a pas été réécrite.
- [ ] La forme et le costume sont fonctionnellement distincts.
- [ ] Le genre est décrit dans `genderVariants` lorsqu’il ne constitue pas une forme officielle.
- [ ] Le conflit éventuel possède un motif et une entrée d’historique.
- [ ] L’import a été prévisualisé.

## Historique

- 2026-07-17 — création de l’architecture MongoDB, du CRUD privé, de la migration, du cache de résolution et des diagnostics détaillés.
