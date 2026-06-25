# Structure Du Projet

Le depot `PokemonGo-API-` contient l'API publique, le site visiteur, la checklist
read-only et les outils de maintenance. Les donnees sources vivent dans le depot separe
`PokemonGo-Data`, afin de garder les JSON prives et de publier uniquement le service de
lecture.

## Dossiers Principaux

| Dossier | Responsabilite |
| --- | --- |
| `app/` | Front public Next.js : accueil, checklist, bibliothèques, robots et sitemap. |
| `components/` | Composants UI partages par la landing, la bibliotheque API et les fiches. |
| `.data/PokemonGo-Data/` | Clone local ignore du depot de donnees, cree par `npm run ensure:data` si besoin. |
| `src/` | Coeur de l'API REST Express et synchronisation MongoDB. |
| `api/` | Points d'entree serverless necessaires au deploiement Vercel. |
| `apps/checklist/` | Interface, moteur et serveur de la checklist. |
| `scripts/sync/` | Commandes de synchronisation MongoDB. |
| `scripts/import/` | Outils d'import et d'extraction des donnees. |
| `scripts/audit/` | Controles de coherence non destructifs. |
| `scripts/migrate/` | Migrations explicites et validees des donnees. |
| `config/` | Definitions des index Atlas Search. |
| `docs/` | Documentation technique et guides du projet. |
| `test/` | Tests automatises. |

## Donnees Protegees

Le dossier `config/` reste dans ce depot car il décrit les index Atlas Search. Les JSON
metier vivent dans `PokemonGo-Data`. Les outils les trouvent via `POKEMON_GO_DATA_DIR`,
le clone local `.data/PokemonGo-Data/`, le depot voisin `../PokemonGo-Data` ou, en
dernier recours historique, un ancien dossier `data/`.

La synchronisation vers MongoDB ne modifie jamais ces sources. Le catalogue d'attaques
central est dans `PokemonGo-Data/moves/`, avec les categories classiques, Elite, Max et
G-Max. Les formes Dynamax et Gigantamax minimales vivent dans
`PokemonGo-Data/pokemon-forms/dynamax/` et
`PokemonGo-Data/pokemon-forms/gigantamax/`.

Les images de backgrounds de lieu et spéciaux sont rangées dans
`asset/LocationCards/`. Le script `scripts/import/location-cards.js` associe ces
fichiers aux Pokémon éligibles depuis Serebii et conserve leurs dates et formes.

Les portraits Méga/Primo vivent dans `asset/MegaPortraits/`, les fonds de types dans
`asset/TypeBackgrounds/` et les stickers distants dans le catalogue
`PokemonGo-Data/stickers/stickers.json`. Le script `scripts/import/visual-assets.js`
associe ces ressources aux données. Chaque type possède un fichier dans
`PokemonGo-Data/types/<slug>.json`; `PokemonGo-Data/types/types.json` reste un index
compatible avec les anciens outils.

Les régions et générations sont centralisées dans `PokemonGo-Data/generations/`. Les fiches
Pokémon complètes conservent uniquement `regionId`; l'API et la checklist recomposent
la région traduite et la génération. Les sept météos vivent dans `PokemonGo-Data/weather/`,
référencent leurs types boostés et exposent les icônes de `asset/weather/`.

Les sources externes surveillées par la checklist vivent dans
`PokemonGo-Data/source-watch/sources.json`. Dans ce depot public read-only, l'action
`source-watch` de `/api/checklist-v3` est désactivée : les outils de correction et
de surveillance sont gérés dans le dashboard privé.

Le script `scripts/import/shadow-pokemon.js` synchronise depuis Bulbapedia les
sorties Shadow déjà effectives, les coûts de purification, les Catch CP et les
dates. Il ignore les dates futures et ne crée aucun asset Shadow.

Le rôle détaillé de chaque fichier JavaScript est documenté dans
`docs/JAVASCRIPT-FILES.md`.

Les icônes de style Pokémon Shuffle vivent dans `asset/pokemonShuffle/`.
`scripts/import/pokemon-shuffle.js` les associe une seule fois à la fiche JSON exacte
dans le fichier `pokemon-assets/**/*.assets.json` référence par `assets.assetsRef`.
Une image Dynamax va uniquement dans une fiche Dynamax, une Méga dans sa fiche Méga
et une forme régionale dans sa fiche régionale. Les images Shadow et purifiées restent
regroupées sur la fiche asset de leur forme.

Les fiches principales ne dupliquent plus les données de formes. `regionForms` et
`megaEvolutions` contiennent uniquement des références vers
`PokemonGo-Data/pokemon-forms/`.

## API

- `app.js` demarre le serveur Node local.
- `src/app.js` assemble Express, les routes, Swagger et Redoc.
- `src/routes/` expose les endpoints REST.
- `src/services/` contient la logique metier et les requetes MongoDB.
- `src/models/` contient les modeles Mongoose flexibles.
- `src/sync/` transforme les sources JSON avant leur synchronisation.

## Checklists

- `app/` contient le front Next.js public.
- `components/` contient les cartes, modales et panneaux reutilises par le nouveau front.
- `apps/checklist/` conserve l'ancienne interface statique et le moteur metier partage.
- `apps/checklist/server/` contient le serveur local legacy, l'atelier d'audit et le moteur.
- `api/checklist-v3.js` regroupe les actions serverless publiques exposees sur Vercel.

## Commandes

```bash
npm start
npm run sync
npm run sync:watch
npm run checklist
npm test
```
