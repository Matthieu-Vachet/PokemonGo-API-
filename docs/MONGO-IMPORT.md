# Importer les JSON dans MongoDB

Ce projet importe les donnees depuis le depot local `PokemonGo-Data`, puis les ecrit
dans MongoDB avec les scripts de synchronisation.

## 1. Verifier la source locale

En local, garde les deux dossiers au meme niveau :

```bash
Workflow/
  PokemonGo-API-/
  PokemonGo-Data/
```

Si le dossier data est ailleurs, renseigne son chemin :

```bash
export POKEMON_GO_DATA_DIR="/chemin/vers/PokemonGo-Data"
```

Le script `npm run ensure:data` cherche d'abord `POKEMON_GO_DATA_DIR`, puis
`../PokemonGo-Data`. Sur Vercel, il peut cloner le depot data dans `.data/PokemonGo-Data`.

## 2. Tester sans ecrire

Avant d'ecrire dans MongoDB, lance toujours :

```bash
npm run sync:dry
```

Cette commande lit tous les JSON et affiche les compteurs, mais ne se connecte pas a
MongoDB. C'est le bon controle apres un ajout comme `damageMultiplier` dans les types
ou `assets.candy` dans les fiches Pokemon.

## 3. Importer dans MongoDB

Quand le dry-run est bon et que `MONGODB_URI` est present dans `.env` :

```bash
npm run sync
```

Le sync fait des `upsert` par collection :

- `pokemon` avec la cle unique `key`
- `moves` avec la cle unique `id`
- `types` avec la cle unique `id`
- `weather`, `regions`, `generations`
- `globalstats` pour les statistiques globales

Chaque document garde aussi le JSON source complet dans le champ `data`. Donc un nouveau
champ ajoute aux JSON, par exemple `types/*.json -> damageMultiplier` ou
`pokemon/*.json -> assets.candy`, remonte automatiquement dans MongoDB si le fichier
source change.

## 4. Deploiement Vercel

Apres un import local valide :

```bash
npm run check
npx vercel deploy --prod --yes
```

Sur Vercel, verifie que les variables suivantes existent selon ton setup :

- `MONGODB_URI`
- `POKEMON_GO_DATA_TOKEN` si le depot `PokemonGo-Data` est prive
- `POKEMON_GO_DATA_REF` si tu veux cloner une branche autre que `main`

## 5. Reflexe de securite data

Avant toute modification massive dans `PokemonGo-Data`, copie les JSON originaux dans
`archive JSON/<date-heure>/`. C'est la sauvegarde locale qui permet de recuperer les
donnees avant enrichissement ou migration.
