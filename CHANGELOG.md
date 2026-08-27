---
id: RULE-CHANGELOG-001
title: Changelog Pokemon GO API
status: active
lang: fr
version: 1.25.0
updated_at: 2026-08-27
author: MatWeb Innovation
projects:
  - PokemonGo-API-
related:
  - RULE-VERSIONING-001
  - API-PUBLIC-001
---

# Changelog

## Unreleased

### Added

- Publie `UnmatchedEntriesReport@1` dans les documents current, les runs et le polling, avec taxonomie fermée, détails complets et conservation des occurrences Shiny.
- Enregistre `pokemongo-data` comme provider diagnostique afin que les identités locales absentes d’un flux soient actionnables dans l’Identity Manager.

### Changed

- Remplacement du Team Ranker Chromium, trop lent dans la Function Vercel, par un calcul déterministe sur le snapshot PvPoke synchronisé.
- Conservation du contexte Great/Ultra/Master, des formes régionales, des identités et assets canoniques.
- État vide réservé aux espèces absentes du classement ; snapshot invalide signalé explicitement.

### Fixed

- Préserve chaque occurrence non matchée Shiny grâce à `occurrenceId` au lieu de fusionner des lignes partageant un nom ou un sprite.
- Aligne les compteurs Game Master sur les détails exposés, y compris les identités `local-only`.

## 1.25.0 - 2026-08-22

### Changed

- Aligne Best Defenders sur la page canonique anglaise Pokémon GO Hub et le provider `pokemon-go-hub-best-defenders`.
- Conserve le dernier snapshot MongoDB en run `partial` pour `SOURCE_UNAVAILABLE`, `SOURCE_SCHEMA_CHANGED`, `VALIDATION_FAILED` et l’historique `SOURCE_PROTECTED`.

### Fixed

- Évite qu’un changement de schéma ou une validation de régression n’écrase le dataset `best_defenders` courant.

## 1.24.0 - 2026-08-22

### Changed

- Aligne la lecture canonique sur les 1 617 identités, références Assets et fiches PvP séparées de PokemonGo-Data 1.28.0.
- Met à jour les contrats et tests de référence afin que la suppression d’une route exclusive ne retire aucun générateur ou resolver partagé.

### Removed

- Supprime les routes, le service, le cache, l’export ZIP et les tests exclusivement dédiés à Images Dynamax ; les routes Pokémon Dynamax et Max Battles partagées restent intactes.

## 1.23.0 - 2026-08-15

### Added

- Ajoute un état terminal `partial` pour une source Shiny temporairement indisponible : le `DatasetRun` conserve données, hash, compteur et date du document MongoDB courant avec un diagnostic structuré.

### Changed

- Applique le filtre Best Attackers `type` aux types exacts du Pokémon hydraté, avant pagination, tout en conservant le tri de la métrique demandée.
- Marque explicitement `mongoUpdated: false` lorsqu’une régénération Shiny partielle préserve le snapshot existant.

### Fixed

- Relie déterministement les anciens tuples MongoDB `NEUTRAL`, `GORGING_FORM` et `GULPING_FORM` aux identités locales `XERNEAS_NEUTRAL`, `CRAMORANT_GORGING_FORM` et `CRAMORANT_GULPING_FORM`, y compris lorsque `form` est déjà canonique mais que seule `identityKey` reste suffixée, sans supprimer ni réécrire leurs alias.
- Empêche une page Snacknap HTTP 200 dont `Today` est annoncé vide d’écraser le dernier classement Shiny valide ou de rester présentée comme une erreur HTTP générique.

## 1.22.1 - 2026-08-14

### Fixed

- Rattache la synchronisation Identity Manager de `CORSOLA_SPRING_2026` au Core galarien, préserve les alias existants et aligne les contrôles Assets sur les 1 614 fiches canoniques de PokemonGo-Data 1.25.0.

## 1.22.0 - 2026-08-14

### Added

- Expose `GET /api/v1/meta` avec `apiVersion`, `dataVersion`, `schemaVersion`, `generatedAt` et la version applicative Data.
- Ajoute une garde CI intelligente qui exige une version et un changelog pour le code produit sans bloquer les changements de documentation ou de tests seuls.

### Changed

- Expose les 531 variantes secondaires nettoyées avec leurs champs explicites `kind` et `gender`, sans réintroduire les formes Pokémon canoniques dans `assetForms`.
- Dérive désormais la version OpenAPI de `package.json`, source unique de la version applicative API.
- Remplace le `require()` absolu dynamique des générateurs par un registre de 12 imports statiques traçables par Next/Vercel.
- Centralise la racine PokemonGo-Data, les fichiers et modules runtime avec validation, erreurs structurées et protection contre le path traversal.
- Rend les validations registry, serverless-like et post-build bloquantes, ajoute la CI et les commandes `verify:regenerations` / `smoke:regenerations`.
- Externalise `@sparticuz/chromium` et trace ses binaires uniquement dans la Function REST afin que le scan Dynamax fonctionne sur Vercel.
- Fractionne la réindexation Game Master et le scan Dynamax en étapes MongoDB idempotentes, chacune bornée par la limite Vercel de 60 secondes.
- Regroupe les écritures Game Master par 2 000 et force la table Pokémon GO Hub à 200 lignes en bloquant les scripts tiers pour terminer les parcours sous leurs budgets globaux.
- Vérifie les datasets MongoDB compressés par `sourceHash` et `count` sans réhydrater une seconde copie complète, afin de borner la mémoire de la persistance PvP.

### Removed

- Supprime la route admin privée, le modèle `costume_audits`, l'adaptateur, le générateur enregistré et les tests exclusivement dédiés à l'ancien audit Costumes / Event.
- Retire l'appel Margxt Costumes tout en conservant Margxt pour les autres domaines de l'Identity Manager.

## 1.21.0 - 2026-08-09

- Publie le contrat canonique transversal et les métadonnées documentaires permanentes.
- Garantit par tests l’identité, la catégorie et les références Assets/PvP des 1 611
  entités exposées par le reader de synchronisation.
- Aligne OpenAPI, package, erreurs, versioning, dépréciation, attribution et rollback
  avant publication de production.
- Documente `assetsRef` et `pvpRef` à la racine comme seuls pointeurs canoniques et
  retire des templates actifs les anciens blocs Assets/PvP embarqués.
- Aligne l’Identity Manager et les régénérations sur le registre fermé des sources,
  les états `success`, `partial`, `unchanged`, `failed` et `SOURCE_PROTECTED`, sans
  écrasement du dernier snapshot valide.
- Consigne le snapshot PvPoke stabilisé, l’Engine final, le calendrier, le
  versionnement `1.21.0` et la procédure de rollback coordonnée.

## 1.20.0 - 2026-08-08

- Centralise la résolution des Assets et fiches PvP par catégorie Pokémon.
- Persiste `entityCategory` dans les documents Pokémon, Core et familles secondaires, et refuse les mauvais dossiers avant import.
- Étend l’OpenAPI et les tests aux catégories NORMAL, FORM, MEGA, DYNAMAX et GIGANTAMAX.
- Publie le contrat canonique transversal, les identifiants documentaires permanents,
  la politique de versioning, de dépréciation, d’attribution et de rollback.
- Verrouille par tests le frontmatter des documents actifs et les champs stables du
  contrat public pour les cinq catégories Pokémon.

## 1.18.0 - 2026-07-31

- Transmet le contrat canonique `assets.candy.xlImage` déjà résolu par PokemonGo-Data, y compris depuis un bundle de forme lorsque la fiche principale ne porte pas la copie.
- Conserve la fiche Pokémon principale comme autorité lorsqu’elle contient les données candy et n’introduit aucune construction d’URL XL dans le provider.
- Privilégie la fiche JSON embarquée sur un snapshot MongoDB incomplet lors de l’hydratation du candy familial.
- Étend les tests d’API à la précédence et à la rétrocompatibilité de `assets.candy.image`.

## 1.17.1 - 2026-07-28

- Complète la projection canonique des Suggested Teammates avec `identity.image`, `shinyImage`, `resolutionStatus` et `assetResolution` issus du seul `selectedAsset` de l’Identity Manager.
- Conserve le contrat historique `pokemon.assets` sans fabriquer d’URL et ajoute une couverture des cinq partenaires actuels de Mimiqui.

## 1.17.0 - 2026-07-28

- Ajoute le dataset MongoDB public `gbl_calendar`, ses lectures et filtres, son historique et sa régénération Admin Battleflow.
- Expose le catalogue PvP complet par ligue avec `full=true` pour la checklist persistante tout en conservant la pagination par défaut.
- Transmet le contrat Rank 1 PvPoke enrichi, documente le calendrier GBL dans OpenAPI et ajoute Battleflow au catalogue des providers.
- Extrait à la demande les cinq Suggested Teammates de la fiche déroulante PvPoke, les résout canoniquement et les met en cache dans `pvp_teammate_cache`.
- Étend les tests de modèles, adaptateurs, routes publiques, absence de fallback JSON et OpenAPI.

## 1.16.3 - 2026-07-26

- Réhydrate l’audit Costumes avec le catalogue Identity Manager courant afin qu’un alias Margxt nouvellement résolu affiche immédiatement son asset canonique.
- Ajoute les filtres événement/type et les tris date, événement, type, nom et numéro Pokédex dans le presenter privé.

## 1.16.2 - 2026-07-26

- Replace deprecated Mongoose update options in Identity Manager diagnostics so successful admin writes no longer emit error-level runtime warnings.

## 1.16.1 - 2026-07-26

- Include explicit runtime tracing for the HTML parser used by dynamically loaded PokemonGo-Data generators on Vercel.

## 1.16.0 - 2026-07-26

- Persiste Best Defenders dans `best_defenders`, expose sa lecture publique paginée et protège ses imports, historiques et régénérations Admin.
- Persiste l’audit Margxt dans `costume_audits` sous un contrat strictement privé, sans route de découverte publique ni entrée OpenAPI.
- Centralise les providers Identity Manager, ajoute GO Hub, Margxt et Ma Collection, puis expose la liste et l’enregistrement idempotent de diagnostics groupés.
- Transmet le catalogue canonique aux deux générateurs, conserve les diagnostics de variantes et vérifie hash, diff et relecture MongoDB après écriture.

## 1.11.0 - 2026-07-16

- Ajoute les lectures publiques paginées Community Days et Historique Events depuis les collections permanentes du Dashboard, sans exposer les payloads ni diagnostics internes.
- Ajoute le scraping privé des seules images Dynamax, ses contrôles réseau stricts, son cache technique privé TTL compatible serverless et l’archive ZIP avec manifest et erreurs.
- Documente la politique de non-suppression, la différence entre flux courant, archive et historique de scraping, puis étend OpenAPI et les tests de sécurité.

## 1.10.0 - 2026-07-16

- Persiste les variantes sexuées, les raisons d’ambiguïté, les candidats, les catégories et les métadonnées d’asset bundle dans la comparaison Game Master.
- Ajoute `dataset_runs` et les routes privées d’historique pour chaque dataset dynamique et pour le Game Master.
- Conserve les non-matchés détaillés, les warnings, erreurs, hashes, diffs et compteurs de chaque régénération, y compris les échecs.
- Évite de dupliquer un snapshot volumineux lorsque le hash courant est inchangé.

## 1.9.2 - 2026-07-15

- Compresse le document Shiny courant et réduit chaque historique aux identifiants et métriques réellement utilisés afin de terminer sous la limite Vercel de 60 secondes.
- Journalise séparément la génération source, l'écriture du document courant, l'historique MongoDB et la relecture vérifiée.
- Ajoute des tests de non-régression sur la configuration Vercel et le format compact des snapshots.

## 1.9.1 - 2026-07-15

- Compacte les templates Game Master en conservant une seule copie du JSON brut et en reconstruisant les propriétés au détail.
- Purge les staging orphelins expirés, conserve deux snapshots par défaut et nettoie toute tentative incomplète avant activation.
- Évite les milliers de diffs artificiels au premier import et corrige l'activation initiale atomique du pointeur courant.
- Retourne `507 GAME_MASTER_STORAGE_QUOTA_EXCEEDED` lorsque le quota Atlas bloque les écritures, sans masquer le diagnostic ni créer de données partielles.

## 1.9.0 - 2026-07-15

- Ajoute douze routes privées Game Master pour résumé, catégories, recherche, détail, comparaison locale, snapshots, diffs, exports, régénération et réindexation.
- Ajoute cinq collections MongoDB indexées avec staging, activation atomique par pointeur, hash idempotent, diff structuré et rétention optionnelle désactivée par défaut.
- Limite toutes les recherches et paginations, échappe les regex, garde les routes hors OpenAPI public et ne renvoie jamais le Game Master complet sur une route de liste.
- Étend les tests aux diffs, assets locaux exacts, sécurité, pagination et conservation du snapshot actif.

## 1.8.0 - 2026-07-14

- Ajoute le dataset MongoDB compressé `best_attackers`, sa route publique filtrée et sa régénération admin idempotente.
- Ajoute le diagnostic privé `pokemon_identity_mappings` issu du Game Master PokeMiners.
- Hydrate les classements avec Pokémon et attaques locales, puis calcule rang, pourcentage et tier côté serveur.
- Étend les diagnostics avec la résolution canonique, l'usage des données et les empreintes de source.

## 1.6.1 - 2026-07-11

- Reinitialise la promesse de connexion MongoDB lorsqu'une connexion serverless inactive est fermee, afin que `/health` et la requete suivante reconnectent Atlas correctement.

## 1.6.0 - 2026-07-11

- Expose les metadonnees de selection dynamique des raids : fuseau, rotation reguliere, rotation Shadow et detection du shell LeekDuck.
- Enrichit les diagnostics MongoDB avec les buckets, categories, rotations, ressources internes et couverture des assets sources.
- Rend les details complets de provenance disponibles aux cinq panneaux du Dashboard sans reintroduire de fallback local.

## 1.5.1 - 2026-07-11

- Supprime le controle instantane de `mongoose.connection.readyState` qui provoquait un faux `503` au premier GET d'une fonction Vercel froide.
- Laisse la requete MongoDB courante confirmer la connexion et transforme uniquement une vraie erreur de lecture en `MONGODB_UNAVAILABLE`.
- Ajoute les tests de non-regression pour le cold start et l'indisponibilite MongoDB explicite.

## 1.5.0 - 2026-07-11

- Fait de MongoDB l'unique source de verite runtime pour raids, oeufs, Max Battles, Research et Rocket, sans fallback JSON silencieux.
- Ajoute un pipeline commun fetch, validation, hash canonique, diff metier, upsert, invalidation du cache et readback verifie.
- Uniformise les cinq documents `current`, exclut definitivement leurs collections de `npm run sync` et conserve les imports uniquement en maintenance avec payload explicite.
- Retourne le document MongoDB serialise avec les diagnostics, bypass le cache des GET dynamiques et ajoute 58 tests automatises.

## 1.4.3 - 2026-07-10

- Corrige les imports administrateur Raids, Oeufs, Max Battles, Rocket et Research : sans payload explicite, ils relisent maintenant le JSON versionne au lieu de reimporter un ancien document MongoDB.
- Ajoute `importedFrom` aux rapports d'import pour identifier la source effectivement synchronisee.
- Documente le contrat d'import pour le Dashboard Admin.

## 1.4.2 - 2026-07-01

- Corrige les routes admin `regenerate` Raids, Oeufs, Max Battles et Rocket pour executer les wrappers live au lieu de reimporter l'ancien JSON.
- Harmonise les rapports de pipeline avec `success`, `itemsParsed`, `itemsMatched`, `itemsUnmatched`, `jsonPath`, `mongoUpdated` et `updatedAt`.
- Fait echouer les regenerations qui ne parsent aucune donnee afin d'eviter les faux succes Dashboard.
- Corrige les imports admin pour utiliser le payload fourni, sinon le dernier document MongoDB, sinon le fichier source.
- Augmente la limite JSON admin a `1mb` pour accepter les imports Research complets.

## 1.4.0 - 2026-06-30

- Ajoute les collections MongoDB `items` et `rocket_texts` synchronisees depuis `PokemonGo-Data/items/items.json` et `PokemonGo-Data/rocket/rocketTexts.json`.
- Ajoute les routes publiques `GET /api/v1/items` et `GET /api/v1/rocket-texts`.
- Documente les ressources publiques pour les recompenses Research et les textes Team GO Rocket.

## 1.3.0 - 2026-06-29

- Ajoute `GET /api/v1/rocket` et `GET /api/v1/research`.
- Ajoute les routes admin protegees `/api/v1/admin/rocket/import|regenerate` et `/api/v1/admin/research/import|regenerate`.
- Synchronise les documents courants dans MongoDB via les collections `rockets` et `researches`.

## 1.2.0 - 2026-06-29

- Ajoute `GET /api/v1/eggs` et les routes admin protegees `/api/v1/admin/eggs/import|regenerate`.
- Ajoute `GET /api/v1/max-battles` et les routes admin protegees `/api/v1/admin/max-battles/import|regenerate`.
- Synchronise les documents courants dans MongoDB via les collections `eggs` et `maxbattles`.
- Met a jour OpenAPI, README et docs API pour les sources LeekDuck Eggs et Snacknap Max Battles.

## 1.1.0 - 2026-06-29

- Ajoute la route publique `GET /api/v1/raids` pour exposer `raids/currentRaids.json`.
- Ajoute les routes admin protegees `POST /api/v1/admin/raids/import` et `POST /api/v1/admin/raids/regenerate`.
- Synchronise le document raids courant dans la collection MongoDB `raids`.
- Documente les raids courants, la source LeekDuck et les exemples curl admin.

## 1.0.1 - 2026-06-28

- Ajout du helper serveur `requireAdminSecret(request)` pour proteger les routes privees avec `x-api-admin-secret`.
- Protection globale des methodes non publiques sous `/api/v1/*`.
- Protection des anciennes actions internes `/api/checklist-v3?action=source-watch|history|url-audit`.
- Documentation de `API_ADMIN_SECRET`, des routes publiques/privees/internes et des exemples curl.
- Mise a jour de la documentation OpenAPI et des tests de securite.
