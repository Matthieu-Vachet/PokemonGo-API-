# Importer les JSON dans MongoDB

Ce projet importe les referentiels statiques depuis le depot local `PokemonGo-Data`,
puis les ecrit dans MongoDB avec les scripts de synchronisation.

Les datasets dynamiques `raids`, `eggs`, `maxbattles`, `researches` et `rockets`
sont explicitement exclus de `npm run sync`. Leur document `{ key: "current" }`
est géré uniquement par le pipeline de régénération externe. Cette séparation
empêche un ancien JSON local d'écraser une régénération MongoDB plus récente.

Pour ces cinq datasets, MongoDB est l'unique source lue par le Dashboard. Une
source web n'est qu'une entrée du pipeline de régénération ; le Dashboard ne lit
jamais directement cette page ni un fichier JSON local.

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
ou `assets.candy` dans les fiches Pokemon. Le dry-run doit aussi afficher
`pokemonAssets`, genere depuis `PokemonGo-Data/pokemon-assets`.

## 3. Importer dans MongoDB

Quand le dry-run est bon et que `MONGODB_URI` est present dans `.env` :

```bash
npm run sync
```

Le sync fait des `upsert` par collection :

- `pokemons` avec la cle unique `key`
- `pokemonAssets` avec la cle unique `formId`
- `moves` avec la cle unique `id`
- `types` avec la cle unique `id`
- `weather`, `regions`, `generations`
- `globalstats` pour les statistiques globales

Il ne lit et n'écrit jamais les cinq fichiers `current*.json` dynamiques. Les JSON
de raids, œufs, Max Battles, Research et Rocket peuvent rester dans le dépôt comme
références, fixtures de test ou exports explicites. Ils ne sont ni une source de
production, ni un fallback, ni une entrée du job MongoDB global.

Chaque document `pokemons` garde dans `data` le JSON principal sans assets lourds :
gameplay, stats, attaques, PvP, disponibilités, images principales, candy et
`assets.assetsRef`. Les assets lourds vivent dans `pokemonAssets.data.assets` et sont
lies par `pokemons.formId == pokemonAssets.formId`. Donc un nouveau champ ajoute aux
JSON, par exemple `types/*.json -> damageMultiplier`, `pokemon/*.json -> assets.candy`
ou `pokemon-assets/**/*.assets.json -> assets.shuffle`, remonte automatiquement dans
MongoDB si le fichier source change.

Les routes de détail hydratent automatiquement la fiche en lisant `data.assets.assetsRef`.
La liste des Pokemon reste volontairement plus légère.

## 4. Flux des cinq datasets `current`

Les cinq domaines dynamiques suivent le même flux atomique :

1. récupérer la source externe autorisée ;
2. parser puis enrichir les entrées ;
3. valider le dataset complet ;
4. calculer son hash canonique et la diff avec la version MongoDB précédente ;
5. faire un `upsert` du document `{ key: "current" }` dans la collection du domaine ;
6. invalider les caches du domaine ;
7. relire le document depuis MongoDB et vérifier le hash et le compteur sauvegardés.

Le Dashboard utilise ensuite exclusivement cette relecture MongoDB pour
`Actualiser`, l'affichage, les compteurs, les diagnostics et le téléchargement.
Une erreur MongoDB est donc affichée explicitement ; elle ne déclenche jamais un
retour silencieux vers un fichier local.

La route `/import` est une opération de maintenance protégée. Elle exige un payload
JSON explicite et valide, puis passe par les mêmes étapes de validation, hash, diff,
upsert, invalidation et relecture. Un payload absent ne provoque aucune lecture d'un
`current*.json` local.

### Règle particulière des raids

La seule URL source des raids est :

`https://leekduck.com/raid-bosses/`

Le mode normal ou événement est détecté à partir du contenu courant de cette page
(sections et marqueurs tels que `SELECTED EVENT`). Le pipeline n'utilise jamais
`/gofest/raids/` et ne contient aucune activation, date, liste de Pokémon ou nombre
d'entrées codé en dur pour forcer un événement.

## 5. Déploiement Vercel

Apres un import local valide :

```bash
npm run check
npx vercel deploy --prod --yes
```

Sur Vercel, verifie que les variables suivantes existent selon ton setup :

- `MONGODB_URI`
- `POKEMON_GO_DATA_TOKEN` si le depot `PokemonGo-Data` est prive
- `POKEMON_GO_DATA_REF` si tu veux cloner une branche autre que `main`

## 6. Réflexe de sécurité data

Avant toute modification massive dans `PokemonGo-Data`, lance le backup de refonte ou
copie les JSON originaux dans `archive JSON/<date-heure>/`. C'est la sauvegarde locale
qui permet de recuperer les donnees avant enrichissement ou migration.
