---
id: ADR-IDENTITY-001
title: Identity Manager Pokémon GO
status: active
lang: fr
version: 2.3.0
updated_at: 2026-08-15
author: MatWeb Innovation
projects:
  - PokemonGo-API-
  - PokemonGo-Data
  - Dashboard Admin
related:
  - COL-IDENTITY-001
  - API-IDENTITY-001
  - RULE-IDENTITY-001
  - PAGE-IDENTITY-001
---

# Identity Manager Pokémon GO

## Objectif

L’Identity Manager est la référence privée qui relie les identifiants originaux des fournisseurs à une identité canonique PokemonGo-Data. Le catalogue fonctionnel est inventorié directement depuis `data/pokemon/` et `data/assets/` ; les anciens mappings ne créent plus d’identité. La valeur fournisseur brute, sa valeur normalisée et le fournisseur restent séparés.

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

### Fournisseurs canoniques et alias de source

`providerCatalog` est l’autorité fermée des fournisseurs Identity Manager. Un fournisseur peut déclarer des alias d’entrée pour les identifiants de provenance employés par un dataset, sans créer de fournisseur supplémentaire. `leekduck-eggs`, `leekduck-research`, `leekduck-rocket` et l’ancien `leekduck-rocket-lineups` convergent ainsi vers l’unique fournisseur canonique `leekduck`; `leekduck-raids` reste un fournisseur privé distinct pour préserver son contrat existant.

Cette canonisation est appliquée avant résolution, import, mutation d’alias et écriture de diagnostic. Les filtres et compteurs agrègent également les éventuelles valeurs historiques sous leur fournisseur canonique. Une valeur inconnue reste refusée avec `IDENTITY_PROVIDER_NOT_REGISTERED` : aucun fallback ni ajout implicite au registre n’est autorisé.

## API

### API-IDENTITY-001 — routes privées

Préfixe : `/api/v1/admin/pokemon-identities`.

- `GET /` : recherche, filtres, tri, pagination et statistiques ;
- `POST /` : création ;
- `GET /:id` et `PATCH /:id` : lecture et modification ;
- `DELETE /:id` : dépréciation logique avec motif obligatoire ;
- `POST /:id/restore` et `POST /:id/merge` ;
- `POST /:id/aliases` et `PATCH /:id/aliases/:aliasId` ; l’ajout répété du même alias actif sur la même identité est idempotent et ne crée ni doublon ni historique artificiel ;
- `POST /resolve` : résolution provider + alias ;
- `POST /resolve-assets` : résolution privée de 1 à 500 alias vers leurs identités et assets canoniques, dans l'ordre d'entrée et avec un seul chargement du catalogue ;
- `GET /inventory` : recherche paginée dans l’inventaire local sans passer par les anciens mappings ;
- `GET /sync/preview` : plan de synchronisation sans écriture et empreinte du plan ;
- `POST /sync/apply` : application groupée, historisée et idempotente ;
- `GET /conflicts`, `GET /history`, `GET /diagnostics` ;
- `GET /providers` : registre central fermé et compteurs d’alias/diagnostics pour les seuls providers déclarés dans `providerCatalog` ;
- `POST /diagnostics`, `POST /diagnostics/batch` (1 à 500 anomalies agrégées et idempotentes) et `PATCH /diagnostics/:id` ;
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

Le resolver ne choisit jamais le premier candidat lorsqu’il en reste plusieurs et ne rabat jamais une variante inconnue vers la forme normale. Le catalogue MongoDB est chargé en lot et mis en cache 30 secondes ; l’inventaire local est lui aussi chargé une seule fois par processus. Toute mutation invalide le cache MongoDB et le cache de résolution d'assets.

### Résolution canonique des assets

Après obtention d'un `canonicalId`, `pokemon-canonical-asset-service.js` délègue au résolveur partagé PokemonGo-Data. Le chemin est strict : `canonicalId → localReference → assetsRef → entrée exacte → genre → normal/shiny`. Les données brutes du provider ne peuvent plus remplacer la référence synchronisée et une image provider ou HOME ne peut pas masquer un asset canonique absent.

Les résultats transportent la référence locale, le bundle, le chemin JSON de l'entrée, les variantes sexuées disponibles, la raison exacte et la trace complète. Les codes d'échec stables sont :

- `CANONICAL_ID_NOT_FOUND` ;
- `LOCAL_REFERENCE_MISSING` ou `LOCAL_REFERENCE_INVALID` ;
- `ASSET_BUNDLE_NOT_FOUND` ou `ASSET_ENTRY_NOT_FOUND` ;
- `COSTUME_ASSET_NOT_FOUND` ou `FORM_ASSET_NOT_FOUND` ;
- `SHINY_ASSET_MISSING` ;
- `GENDER_VARIANT_NOT_FOUND`.

Les adaptateurs Game Master, Shiny Tracker, raids, œufs, Max Battles, Research, Rocket, PvPoke, Pokémon GO Hub et Margxt reçoivent le catalogue Identity Manager en lot. Le cache du service est versionné en mémoire et sa révision est incrémentée après toute création, modification, fusion, restauration, dépréciation ou mutation d’alias.

## Règles d’intégrité

- aucun provider, alias brut ou alias normalisé vide ;
- aucun provider absent du registre ; les résolutions, diagnostics, imports et mutations sont rejetés avec `IDENTITY_PROVIDER_NOT_REGISTERED` ;
- aucun doublon provider + alias normalisé dans un document ;
- un ajout répétitif du même alias actif sur la même identité retourne l’identité existante sans nouvelle écriture ;
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

Les anciens noms `migrate:pokemon-identities*` restent des alias de compatibilité. Le script exporte la collection avant écriture, recalcule le plan depuis les 1 920 identités locales, conserve les alias et métadonnées manuelles, relie les anciens documents, marque les orphelins en brouillon sans les supprimer, écrit en lots et vérifie un second dry-run.

La transition historique `CORSOLA_SPRING_2026` reste une reclassification canonique explicitement auditée. Le document MongoDB ancien utilisait `222|none|SPRING_2026|none`, rangeait la variante dans `costume` et pointait vers le core Galarian. Le Game Master et l’inventaire local courant prouvent une forme normale unique `222|SPRING_2026|none|none`, portée par `data/assets/core/normal/0222-corsola.assets.json`. Le relink exige simultanément le canonicalId, le dex, les deux clés exactes, l’alias Game Master actif et les fichiers source attendus. Il met à jour la forme et la référence locale, conserve tous les alias MongoDB, écrit un historique `sync-relink` et devient idempotent. Toute combinaison forme + costume ou toute autre divergence reste un conflit manuel sans sélection automatique.

Les anciens tuples Xerneas/Cramorant suivent une seconde règle générique bornée. Elle ne s’applique que si un même `canonicalId` unique, un même numéro Pokédex et des dimensions costume/transformation vides convergent vers une fiche locale dont l’ancien formId finit exactement par le token MongoDB suivi de `_LEGACYFORM`. Ainsi `716|NEUTRAL|none|none`, `845|GORGING_FORM|none|none` et `845|GULPING_FORM|none|none` sont reliés à `XERNEAS_NEUTRAL`, `CRAMORANT_GORGING_FORM` et `CRAMORANT_GULPING_FORM`, avec leurs `assetsRef` de forme. Les alias, métadonnées et références externes sont fusionnés sans suppression. Une pluralité de candidats, un costume, une transformation ou un suffixe non exact conserve le conflit bloquant.

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
- [ ] Le provider appartient au registre central actif.
- [ ] La valeur brute n’a pas été réécrite.
- [ ] La forme et le costume sont fonctionnellement distincts.
- [ ] Le genre est décrit dans `genderVariants` lorsqu’il ne constitue pas une forme officielle.
- [ ] Le conflit éventuel possède un motif et une entrée d’historique.
- [ ] L’import a été prévisualisé.

## Historique

- 2026-07-17 — création de l’architecture MongoDB, du CRUD privé, de la migration, du cache de résolution et des diagnostics détaillés.
- 2026-07-18 — remplacement du catalogue dérivé par l’inventaire exhaustif PokemonGo-Data, synchronisation idempotente, empreintes locales, états d’orphelin, résolution déterministe et régression Mewtwo Armored.
- 2026-07-18 — stabilisation de la sérialisation des identifiants MongoDB pour les routes CRUD et les clés de rendu du Dashboard.
- 2026-07-18 — ajout du résolveur canonique d'assets, de sa trace stable, de l'invalidation coordonnée des caches et branchement des datasets courants/classés.
- 2026-07-18 — ajout de la résolution privée d'assets en lot pour les pipelines Dashboard PogoAPI et LeekDuck.
- 2026-07-26 — centralisation initiale des providers et diagnostics groupés idempotents.
- 2026-07-31 — fermeture du registre, retrait de la source obsolète et migration réversible de ses données ; zéro référence active après contrôle.
- 2026-08-01 — ajout idempotent des alias déjà actifs afin qu’une association répétée ne déclenche plus une erreur de validation MongoDB.
- 2026-08-09 — canonisation des identifiants de datasets LeekDuck vers le fournisseur `leekduck`, avec agrégation rétrocompatible des traces historiques.
- 2026-08-09 — relink audité de `CORSOLA_SPRING_2026` depuis l’ancien costume Galarian vers la forme normale Game Master, sans perte d’alias ni règle heuristique générale.
- 2026-08-09 — validation de stabilisation : 1 920 identités mises à jour, 5 créées,
  2 anciennes entrées marquées orphelines sans suppression et zéro conflit ; Corsola
  reste idempotent au second passage.
- 2026-08-15 — réparation déterministe des anciennes clés Neutral/Gorging/Gulping, avec six alias de fixtures préservés et second passage idempotent.
