# Maintenance Des Données

## Sources De Vérité

- Le depot prive `PokemonGo-Data` contient les JSON sources.
- `PokemonGo-Data/pokemon/` contient uniquement les fiches principales.
- `PokemonGo-Data/pokemon-forms/` contient les données complètes de chaque forme.
- `regionForms`, `megaEvolutions`, `dynamaxForms` et `gigantamaxForms` sont des
  listes de références `formId`.
- `PokemonGo-Data/moves/`, `PokemonGo-Data/types/`, `PokemonGo-Data/generations/` et `PokemonGo-Data/weather/` sont les
  catalogues centraux.
- Les fiches complètes utilisent `regionId`; ne jamais recopier l'objet région ni
  la génération. Les formes Méga et Max héritent ces informations de leur base.
- `weatherBoost` et `PokemonGo-Data/types/*/weatherBoost` utilisent les identifiants de
  `PokemonGo-Data/weather/`.

Ne jamais recopier les données complètes d'une forme dans une fiche principale.

## Contrôles Avant Contribution

```bash
npm run migrate:json-order:write
npm run audit:forms
npm run audit:identifiers
npm run audit:moves
npm run audit:weather
npm test
```

Le normaliseur d'ordre vérifie que les valeurs sont strictement identiques avant
chaque écriture.

La checklist valide tous les champs obligatoires de chaque famille de fiche :
Pokémon normal, forme complète, Méga / Primo et forme Max. Un asset complémentaire
comme Pokémon Shuffle ne remplace jamais les images Pokémon GO obligatoires d'une
fiche déjà sortie.

Les migrations `npm run migrate:regions` et `npm run migrate:weather` doivent
indiquer `changedFiles: 0` après une contribution. Utiliser leurs variantes
`:write` uniquement lorsqu'une migration centrale est réellement nécessaire.

## Imports D'assets

```bash
npm run import:pokemon-shuffle
npm run import:pokemon-shuffle:write
npm run import:enrich-forms
npm run import:enrich-forms:write
```

Toujours contrôler le mode sans `:write` avant l'écriture. L'importeur Shuffle associe
chaque fichier à une seule fiche exacte, utilise `chromatique` pour le shiny et classe
les suffixes `shadow`, `purified`, `dynamax` et `gigantamax`. Les fichiers sans fiche
compatible restent dans la galerie et sont listés dans
`PokemonGo-Data/pokemon-shuffle-import-report.json`.

## Évolution Du Schéma

Toute évolution doit avoir une migration reproductible, un audit, une mise à jour de
la documentation et un test. Éviter les modifications manuelles répétitives.
