---
id: ADR-IDENTITY-001
title: Identity Manager Pokémon GO
status: active
lang: fr
version: 1.1.0
updated_at: 2026-07-18
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

L’Identity Manager est la référence privée qui relie les identifiants originaux des fournisseurs à une identité canonique PokemonGo-Data. Le catalogue fonctionnel est inventorié directement depuis `pokemon/`, `pokemon-forms/` et `pokemon-assets/` ; les anciens mappings ne créent plus d’identité. La valeur fournisseur brute, sa valeur normalisée et le fournisseur restent séparés.

## Architecture

Le flux de résolution suit `source externe → normalisation minimale → provider + alias → identité canonique synchronisée → PokemonGo-Data`. Le module partagé d’inventaire vit dans PokemonGo-Data et son contrat est validé par Zod lors du chargement API. Le Dashboard appelle uniquement le BFF authentifié ; celui-ci transmet la requête à PokemonGo-API avec le secret serveur. Aucune route publique ne permet de lire ou modifier ce catalogue administratif.

Le snapshot historique `pokemon_identity_mappings` reste un diagnostic généré. Les identités administrables sont des documents autonomes et ne sont jamais regroupées dans un document JSON unique.

## Modèle MongoDB

### COL-IDENTITY-001 — `pokemon_identities`

Champs structurants :

- `canonicalId`, unique et stable, avec `previousCanonicalIds` pour les renommages contrôlés ;
- `pokemonId`, `form`, `costume`, `transformation` ;
- `status` : `active`, `draft`, `deprecated`, `ignored` ;
- `syncStatus` : `synchronized`, `orphaned`, `draft`, `conflict` ;
- `aliases[]` avec `provider`, `value`, `normalizedValue`, statut, confiance, source et dates ;
- `genderVariants`, utilisé pour exposer la disponibilité mâle/femelle sans dupliquer l’identité fonctionnelle ;
- `localIdentity`, référence complète vers PokemonGo-Data : clé fonctionnelle, forme, costume, transformation, catégorie, fichiers, chemins JSON, assets sexués, empreintes et date de validation ;
- `localReference`, projection de compatibilité pour les consommateurs existants ;
- `metadata`, informations d’usage et notes ;
- auteurs et dates de création/modification/dépréciation.

Index :

- unique `canonicalId` ;
- `pokemonId` ;
- `aliases.provider` ;
- `aliases.normalizedValue` ;
- composé `aliases.provider + aliases.normalizedValue` ;
- unique multikey partiel `activeAliasKeys`, qui empêche un alias actif d’appartenir à deux identités tout en excluant les tableaux vides ;
- unique partiel `localIdentity.identityKey` ;
- `localIdentity.fingerprint`, `syncStatus + status`, anciens canonical IDs et date de modification.

### `pokemon_identity_history`

Chaque création, modification, alias, fusion, dépréciation, restauration ou synchronisation produit une entrée d’audit contenant l’avant/après, l’utilisateur, le fournisseur, l’alias et le motif. Les actions de synchronisation sont `sync-create`, `sync-update`, `sync-relink`, `sync-orphan` et `sync-alias-move`.

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
- `GET /inventory` : recherche paginée dans l’inventaire local sans passer par les anciens mappings ;
- `GET /sync/preview` : plan de synchronisation sans écriture et empreinte du plan ;
- `POST /sync/apply` : application groupée, historisée et idempotente ;
- `GET /conflicts`, `GET /history`, `GET /diagnostics` ;
- `POST /diagnostics` et `PATCH /diagnostics/:id` ;
- `GET /export` ;
- `POST /import` avec `mode: preview` obligatoire avant un `mode: apply` décidé par l’administrateur.

Toutes les routes exigent `x-api-admin-secret`. Le Dashboard ajoute également l’utilisateur authentifié pour l’audit.

La liste accepte notamment `status` et `syncStatus` (`synchronized`, `orphaned`, `draft`, `conflict`) ainsi qu’un tri `sort=syncStatus`, afin que l’interface puisse isoler les entrées qui exigent une intervention.

## Resolver

### RULE-IDENTITY-001 — ordre de résolution

1. alias brut exact pour le fournisseur ;
2. alias normalisé exact pour le fournisseur ;
3. alias déprécié connu ;
4. canonicalId ou tuple local déterministe unique dans l’inventaire synchronisé ;
5. suggestion prudente avec score ;
6. non matché.

Le resolver ne choisit jamais le premier candidat lorsqu’il en reste plusieurs et ne rabat jamais une variante inconnue vers la forme normale. Le catalogue MongoDB est chargé en lot et mis en cache 30 secondes ; l’inventaire local est lui aussi chargé une seule fois par processus. Toute mutation invalide le cache MongoDB.

## Règles d’intégrité

- aucun provider, alias brut ou alias normalisé vide ;
- aucun doublon provider + alias normalisé dans un document ;
- aucun alias actif partagé entre plusieurs identités ;
- aucune identité active sans `localIdentity.identityKey`, empreinte locale et `syncStatus: synchronized` ; le statut `draft` est l’exception explicite ;
- aucune suppression physique depuis le CRUD ; la dépréciation exige un motif et reste historisée ;
- les imports destructifs sans aperçu sont interdits.

## Gestion des genres

Une variante mâle et femelle d’un même costume est une seule identité, regroupée par `pokemonId + form + costume + transformation`. `isFemale` ne sert qu’à sélectionner l’asset final. Sans sexe demandé, la miniature mâle ou neutre est utilisée par défaut. Une forme dont `MALE` ou `FEMALE` appartient réellement au `formId` officiel reste une identité distincte.

## Migration

Commande sans écriture :

```bash
npm run sync:pokemon-identities
```

Application contrôlée :

```bash
npm run sync:pokemon-identities:write
```

Les anciens noms `migrate:pokemon-identities*` restent des alias de compatibilité. Le script exporte la collection avant écriture, recalcule le plan depuis les 1 911 identités locales, conserve les alias et métadonnées manuelles, relie les anciens documents, marque les orphelins en brouillon sans les supprimer, écrit en lots et vérifie un second dry-run.

Résultat du 18 juillet 2026 : 1 391 documents reliés, 520 identités locales créées, 1 396 alias conservés, zéro conflit, zéro orphelin, 1 911 événements d’historique et second passage entièrement inchangé. `MEWTWO_NORMAL` et `MEWTWO_ARMORED` sont deux identités actives distinctes ; `pvpoke:mewtwo_armored` se résout de manière déterministe vers la seconde.

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
- 2026-07-18 — remplacement du catalogue dérivé par l’inventaire exhaustif PokemonGo-Data, synchronisation idempotente, empreintes locales, états d’orphelin, résolution déterministe et régression Mewtwo Armored.
