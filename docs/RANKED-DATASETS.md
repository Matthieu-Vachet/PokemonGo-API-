# Architecture Mongo des classements

Les domaines `shiny`, `pvp-rankings`, `gbl-calendar`, `best-defenders` et `costume-audit` réutilisent le pipeline `current-dataset` existant : génération PokemonGo-Data, validation d'adaptateur, hash/diff, upsert Mongo et relecture de contrôle.

Collections :

- `shiny_rankings` : vue courante ;
- `shiny_snapshots` : snapshots immuables utilisés pour l'historique du projet ;
- `pvp_rankings` : vue courante PvPoke ;
- `gbl_calendar` : rotations GBL publiques Battleflow ;
- `best_defenders` : tiers publics Pokémon GO Hub ;
- `costume_audits` : comparaison privée Margxt / PokemonGo-Data.

Les réponses sont paginées par les presenters des adaptateurs. Le document `current` renvoyé est compact et ne duplique pas le payload. Le payload PvP complet est stocké en gzip dans `compressedData`, puis hydraté et vérifié par hash lors de la lecture afin de rester sous la limite BSON MongoDB de 16 Mo.

La régénération PvP est une tâche longue. `POST /api/v1/admin/pvp-rankings/regenerate` crée ou réutilise une exécution récente, la confie au mécanisme de tâche de fond Vercel et répond `202 Accepted` avec `run.id` et `statusPath`. La première invocation génère les données puis stocke dans le `DatasetRun` un staging `gzip+json` inférieur à la limite BSON ; le polling suivant revendique atomiquement la phase `generated`, persiste et relit MongoDB dans une seconde invocation. `GET /api/v1/admin/pvp-rankings/regenerate/:runId` n'expose jamais le staging : uniquement l'état sérialisé (`running`, puis `success`, `partial`, `unchanged` ou `failed`), la phase, les métriques, le diff, les avertissements et les erreurs. L'exécution reste protégée par le secret Admin et dédupliquée ; une persistance interrompue est récupérable et idempotente. Si le runtime interrompt la génération, le polling transforme le `running` périmé en `failed` avec le code `DATASET_REGENERATION_TIMEOUT` au lieu de laisser un job fantôme bloquer les relances.

Le pipeline encadre aussi l'enrichissement Identity Manager et la persistance : toute exception marque le `DatasetRun` en échec et produit un log structuré avec le domaine et l'identifiant d'exécution. Les diagnostics d'identité incrémentent `occurrences` uniquement via `$inc`; aucune valeur concurrente n'est écrite sur le même chemin lors de l'upsert.

La visibilité est un contrat du modèle et de l'adaptateur :

- `shiny` est privé. `/api/v1/shiny`, son historique et ses actions Admin exigent toujours le secret serveur et restent absents d'OpenAPI, Swagger, Redoc et de la découverte publique ;
- `pvp-rankings` est public. `/api/v1/pvp-rankings` figure dans OpenAPI et la découverte de l'API ;
- `gbl-calendar` est public. `/api/v1/gbl-calendar` expose saison, périodes, statuts, bonus et compétitions avec filtres `status`, `tier` et `cup` ;
- `best-defenders` est public. `/api/v1/best-defenders` accepte tier, type, recherche et pagination ;
- `costume-audit` est privé. Il n’existe ni `/api/v1/costume-audit` public, ni schéma Margxt dans OpenAPI ;
- les routes de régénération restent privées dans tous les cas.

Chaque régénération Shiny conserve un snapshot complet. L'historique ne calcule aucun point antérieur à la première collecte du projet. Moyenne, variation, meilleure/pire valeur, fenêtres 7/30 jours et évolution quotidienne sont dérivées à la lecture uniquement à partir de ces snapshots.

Avant chaque génération, l'adaptateur charge le catalogue Identity Manager une seule fois et le transmet au générateur PokemonGo-Data. Shiny et PvPoke résolvent ainsi leurs alias par provider vers un `canonicalId`, puis vers l'asset local exact. Ce chargement groupé évite une requête MongoDB par classement et garantit que la même identité produit la même image dans tous les consommateurs.

Best Defenders applique le même chemin au provider `pokemon-go-hub`. L’audit Costumes applique le provider `margxt` et conserve les images externes comme preuve source uniquement. Les diagnostics des deux datasets sont persistés dans `pokemon_identity_diagnostics`; une nouvelle association d’alias devient effective à la prochaine régénération sans réécriture du scraper.

Une lecture privée sans secret est refusée avant tout accès MongoDB. La visibilité stockée est également relue avec le document afin qu'une erreur de routage ne puisse pas rendre un dataset privé public.

Le presenter PvP conserve la pagination normale ; `full=true` renvoie le catalogue complet de la ligue sélectionnée pour les consommateurs qui doivent établir une checklist exacte. Les IV affichés viennent de `rank1`/`pvp.ivs`; le profil `pvp.simulationProfile` est une donnée d’audit distincte.

`GET /api/v1/pvp-rankings/:league/:speciesId/teammates` ouvre la fiche de détail canonique PvPoke correspondant au format, extrait les cinq liens `.partner-pokemon .list a`, résout leurs alias par Identity Manager et persiste le résultat dans `pvp_teammate_cache`. La clé inclut le `sourceHash` du classement ; le cache expire après 24 heures. Une identité non résolue reste visible comme diagnostic et n’obtient aucun asset arbitraire.

Le contrat de chaque partenaire résolu transporte le même asset exact à deux niveaux compatibles : `pokemon.assets` pour les consommateurs historiques et `pokemon.identity.image/shinyImage/resolutionStatus/assetResolution` pour la chaîne canonique du Dashboard. Cette duplication de projection ne crée pas une seconde autorité : les deux valeurs proviennent du `selectedAsset` retourné par Identity Manager. Un asset absent conserve `missing-asset` et `CANONICAL_ASSET_MISSING` ; aucune URL probable n’est fabriquée.
