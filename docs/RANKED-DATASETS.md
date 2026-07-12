# Architecture Mongo des classements

Les domaines `shiny` et `pvp-rankings` réutilisent le pipeline `current-dataset` existant : génération PokemonGo-Data, validation d'adaptateur, hash/diff, upsert Mongo et relecture de contrôle.

Collections :

- `shiny_rankings` : vue courante ;
- `shiny_snapshots` : snapshots immuables utilisés pour l'historique du projet ;
- `pvp_rankings` : vue courante PvPoke.

Les réponses sont paginées par les presenters des adaptateurs. Le document `current` renvoyé est compact et ne duplique pas le payload.

Les routes `/api/v1/shiny` et `/api/v1/pvp-rankings`, ainsi que leurs actions Admin, sont volontairement absentes d'OpenAPI, Swagger, Redoc et de la liste de découverte publique. Elles alimentent le Dashboard Admin sans devenir un contrat documenté de l'API publique.

Chaque régénération Shiny conserve un snapshot complet. L'historique ne calcule aucun point antérieur à la première collecte du projet. Moyenne, variation, meilleure/pire valeur, fenêtres 7/30 jours et évolution quotidienne sont dérivées à la lecture uniquement à partir de ces snapshots.
