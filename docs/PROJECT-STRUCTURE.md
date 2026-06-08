# Structure Du Projet

Le depot separe les donnees sources, l'API publique, les checklists et les outils de
maintenance. Cette organisation permet de faire evoluer chaque partie sans melanger
leurs responsabilites.

## Dossiers Principaux

| Dossier | Responsabilite |
| --- | --- |
| `data/` | Fiches JSON Pokemon, formes, generations et types. |
| `attaque/` | Fiches JSON des attaques rapides, chargees et Elite. |
| `src/` | Coeur de l'API REST Express et synchronisation MongoDB. |
| `api/` | Points d'entree serverless necessaires au deploiement Vercel. |
| `apps/checklist/` | Interface, moteur et serveur de la checklist. |
| `scripts/sync/` | Commandes de synchronisation MongoDB. |
| `scripts/import/` | Outils d'import et d'extraction des donnees. |
| `config/` | Definitions des index Atlas Search. |
| `docs/` | Documentation technique et guides du projet. |
| `test/` | Tests automatises. |

## Donnees Protegees

Les dossiers `data/`, `attaque/` et `config/` contiennent des fichiers JSON. Les outils
lisent ces sources, mais la synchronisation vers MongoDB ne les modifie jamais.

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
