# Changelog

## 1.4.2 - 2026-07-01

- Corrige les routes admin `regenerate` Raids, Oeufs, Max Battles et Rocket pour executer les wrappers live au lieu de reimporter l'ancien JSON.
- Harmonise les rapports de pipeline avec `success`, `itemsParsed`, `itemsMatched`, `itemsUnmatched`, `jsonPath`, `mongoUpdated` et `updatedAt`.
- Fait echouer les regenerations qui ne parsent aucune donnee afin d'eviter les faux succes Dashboard.
- Corrige les imports admin pour utiliser le payload fourni, sinon le dernier document MongoDB, sinon le fichier source.

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
