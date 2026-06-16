# Structure Du Projet

Le depot separe les donnees sources, l'API publique, les checklists et les outils de
maintenance. Cette organisation permet de faire evoluer chaque partie sans melanger
leurs responsabilites.

## Dossiers Principaux

| Dossier | Responsabilite |
| --- | --- |
| `data/` | Fiches JSON Pokemon, formes et catalogues centraux. |
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

Les dossiers `data/` et `config/` contiennent des fichiers JSON. Les outils lisent ces
sources, mais la synchronisation vers MongoDB ne les modifie jamais. Le catalogue
d'attaques central est dans `data/moves/`, avec les categories classiques, Elite, Max et
G-Max. Les formes Dynamax et Gigantamax minimales vivent dans
`data/pokemon-forms/dynamax/` et `data/pokemon-forms/gigantamax/`.

Les images de backgrounds de lieu et spéciaux sont rangées dans
`asset/LocationCards/`. Le script `scripts/import/location-cards.js` associe ces
fichiers aux Pokémon éligibles depuis Serebii et conserve leurs dates et formes.

Les portraits Méga/Primo vivent dans `asset/MegaPortraits/`, les fonds de types dans
`asset/TypeBackgrounds/` et les stickers distants dans le catalogue
`data/stickers/stickers.json`. Le script `scripts/import/visual-assets.js` associe ces
ressources aux données. Chaque type possède un fichier dans `data/types/<slug>.json`;
`data/types/types.json` reste un index compatible avec les anciens outils.

Les régions et générations sont centralisées dans `data/generations/`. Les fiches
Pokémon complètes conservent uniquement `regionId`; l'API et la checklist recomposent
la région traduite et la génération. Les sept météos vivent dans `data/weather/`,
référencent leurs types boostés et exposent les icônes de `asset/weather/`.

Les sources externes surveillées par la checklist vivent dans
`data/source-watch/sources.json`. La route `/api/source-watch-v3` lit cette liste,
vérifie les signatures distantes et laisse le navigateur signaler les nouveautés déjà
vues ou non vues.

Le script `scripts/import/shadow-pokemon.js` synchronise depuis Bulbapedia les
sorties Shadow déjà effectives, les coûts de purification, les Catch CP et les
dates. Il ignore les dates futures et ne crée aucun asset Shadow.

Le rôle détaillé de chaque fichier JavaScript est documenté dans
`docs/JAVASCRIPT-FILES.md`.

Les icônes de style Pokémon Shuffle vivent dans `asset/pokemonShuffle/`.
`scripts/import/pokemon-shuffle.js` les associe une seule fois à la fiche JSON exacte
dans `assets.shuffle`. Une image Dynamax va uniquement dans une fiche Dynamax, une
Méga dans sa fiche Méga et une forme régionale dans sa fiche régionale. Les images
Shadow et purifiées restent regroupées sur la fiche de leur forme.

Les fiches principales ne dupliquent plus les données de formes. `regionForms` et
`megaEvolutions` contiennent uniquement des références vers `data/pokemon-forms/`.

## API

- `app.js` demarre le serveur Node local.
- `src/app.js` assemble Express, les routes, Swagger et Redoc.
- `src/routes/` expose les endpoints REST.
- `src/services/` contient la logique metier et les requetes MongoDB.
- `src/models/` contient les modeles Mongoose flexibles.
- `src/sync/` transforme les sources JSON avant leur synchronisation.

## Checklists

- `apps/checklist/` contient l'interface statique actuelle.
- `apps/checklist/server/` contient le serveur local, l'authentification et le moteur.
- `api/checklist-v3.js` et `api/detail-v3.js` conservent les URL historiques utilisees
  par la checklist deployee sur Vercel.

## Commandes

```bash
npm start
npm run sync
npm run sync:watch
npm run checklist
npm test
```
