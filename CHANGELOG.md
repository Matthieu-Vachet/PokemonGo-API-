# Changelog

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
