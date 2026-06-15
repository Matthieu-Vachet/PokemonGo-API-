# Maintenance Des Données

## Sources De Vérité

- `data/pokemon/` contient uniquement les fiches principales.
- `data/pokemon-forms/` contient les données complètes de chaque forme.
- `regionForms`, `megaEvolutions`, `dynamaxForms` et `gigantamaxForms` sont des
  listes de références `formId`.
- `data/moves/` et `data/types/` sont les catalogues centraux.

Ne jamais recopier les données complètes d'une forme dans une fiche principale.

## Contrôles Avant Contribution

```bash
npm run migrate:json-order:write
npm run audit:forms
npm run audit:identifiers
npm run audit:moves
npm test
```

Le normaliseur d'ordre vérifie que les valeurs sont strictement identiques avant
chaque écriture.

## Imports D'assets

```bash
npm run import:pokemon-shuffle
npm run import:pokemon-shuffle:write
npm run import:enrich-forms
npm run import:enrich-forms:write
```

Toujours contrôler le mode sans `:write` avant l'écriture. Les suffixes Shuffle
inconnus restent dans `codes`; seul le suffixe final `s` est identifié comme shiny.

## Évolution Du Schéma

Toute évolution doit avoir une migration reproductible, un audit, une mise à jour de
la documentation et un test. Éviter les modifications manuelles répétitives.
