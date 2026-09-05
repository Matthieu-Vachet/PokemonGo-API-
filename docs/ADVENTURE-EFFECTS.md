---
id: API-ADVENTURE-EFFECTS-001
title: API Adventure Effects
status: active
lang: fr
version: 1.27.0
updated_at: 2026-09-02
author: MatWeb Innovation
projects:
  - PokemonGo-API-
related:
  - API-PUBLIC-001
---

# API Adventure Effects

Routes publiques :

- `GET /api/v1/adventure-effects`
- `GET /api/v1/adventure-effects/:id`
- `GET /api/v1/pokemon/:identifier/adventure-effects`
- `GET /api/v1/moves/:identifier/adventure-effect`

Chaque réponse standard hydrate le Move et les Pokémon/formes concernés. Le paramètre `locale` accepte exclusivement `en`, `de`, `es`, `pt`, `fr` et `nl`. Le bloc `localized` indique `requestedLocale`, `resolvedLocale` et `fallbackUsed` afin de ne jamais présenter une valeur anglaise comme traduite.

La route privée `POST /api/v1/admin/adventure-effects/regenerate` contrôle les sources en temps réel et retourne `SUCCESS`, `PARTIAL` ou `FAILED`, les compteurs, les différences et le rapport complet. Elle préserve les fichiers canoniques versionnés : la promotion d’une nouvelle donnée reste une opération Data validée et revue.
