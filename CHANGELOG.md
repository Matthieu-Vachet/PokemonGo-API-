---
id: RULE-CHANGELOG-001
title: Changelog Pokemon GO API
status: active
lang: fr
version: 1.21.0
updated_at: 2026-08-08
author: MatWeb Innovation
projects:
  - PokemonGo-API-
related:
  - RULE-VERSIONING-001
  - API-PUBLIC-001
---

# Changelog

## 1.21.0 - 2026-08-08

- Publie le contrat canonique transversal et les métadonnées documentaires permanentes.
- Garantit par tests l’identité, la catégorie et les références Assets/PvP des 1 611
  entités exposées par le reader de synchronisation.
- Aligne OpenAPI, package, erreurs, versioning, dépréciation, attribution et rollback
  avant publication de production.

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
