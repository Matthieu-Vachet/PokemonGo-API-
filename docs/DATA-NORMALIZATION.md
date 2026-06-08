# Normalisation Des Attaques

Les details des attaques sont centralises dans `data/moves/`. Les fiches Pokemon et
leurs formes stockent uniquement des tableaux d'identifiants dans :

- `quickMoves`
- `cinematicMoves`
- `eliteQuickMoves`
- `eliteCinematicMoves`

## Controles

```bash
npm run audit:moves
npm run sync:dry
```

`audit:moves` parcourt aussi les formes imbriquees et refuse les references absentes du
catalogue.

L'API recompose les details centralises via :

```http
GET /api/v1/pokemon/{identifier}/moves
```

## Outils De Migration

```bash
npm run migrate:moves:catalog
npm run migrate:moves
```

Ces commandes fonctionnent en simulation. Les variantes `:write` ecrivent uniquement
apres validation complete de toutes les sources.
