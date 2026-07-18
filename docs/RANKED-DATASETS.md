# Architecture Mongo des classements

Les domaines `shiny` et `pvp-rankings` réutilisent le pipeline `current-dataset` existant : génération PokemonGo-Data, validation d'adaptateur, hash/diff, upsert Mongo et relecture de contrôle.

Collections :

- `shiny_rankings` : vue courante ;
- `shiny_snapshots` : snapshots immuables utilisés pour l'historique du projet ;
- `pvp_rankings` : vue courante PvPoke.

Les réponses sont paginées par les presenters des adaptateurs. Le document `current` renvoyé est compact et ne duplique pas le payload. Le payload PvP complet est stocké en gzip dans `compressedData`, puis hydraté et vérifié par hash lors de la lecture afin de rester sous la limite BSON MongoDB de 16 Mo.

La visibilité est un contrat du modèle et de l'adaptateur :

- `shiny` est privé. `/api/v1/shiny`, son historique et ses actions Admin exigent toujours le secret serveur et restent absents d'OpenAPI, Swagger, Redoc et de la découverte publique ;
- `pvp-rankings` est public. `/api/v1/pvp-rankings` figure dans OpenAPI et la découverte de l'API ;
- les routes de régénération restent privées dans tous les cas.

Chaque régénération Shiny conserve un snapshot complet. L'historique ne calcule aucun point antérieur à la première collecte du projet. Moyenne, variation, meilleure/pire valeur, fenêtres 7/30 jours et évolution quotidienne sont dérivées à la lecture uniquement à partir de ces snapshots.

Avant chaque génération, l'adaptateur charge le catalogue Identity Manager une seule fois et le transmet au générateur PokemonGo-Data. Shiny et PvPoke résolvent ainsi leurs alias par provider vers un `canonicalId`, puis vers l'asset local exact. Ce chargement groupé évite une requête MongoDB par classement et garantit que la même identité produit la même image dans tous les consommateurs.

Une lecture privée sans secret est refusée avant tout accès MongoDB. La visibilité stockée est également relue avec le document afin qu'une erreur de routage ne puisse pas rendre un dataset privé public.
