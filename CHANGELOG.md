# Changelog

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
