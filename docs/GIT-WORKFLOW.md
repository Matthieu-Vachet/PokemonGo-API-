# Commandes Git Du Projet

Ce guide remplace les operations courantes faites auparavant avec GitKraken.

## Regles Importantes

- `main` correspond a la production Vercel.
- `develop` correspond a la prochaine version et genere une Preview Vercel.
- Les nouvelles modifications doivent normalement commencer dans une branche
  `feature/nom-de-la-feature`.
- Toujours verifier `git status` avant un changement de branche ou un rebase.
- Ne jamais utiliser `git push --force`. Apres un rebase, utiliser uniquement
  `git push --force-with-lease`.

## Voir La Situation Actuelle

```bash
git status
git branch -a
git log --oneline --graph --decorate --all -20
```

Recuperer les dernieres informations de GitHub sans modifier les fichiers locaux :

```bash
git fetch origin
```

## Commit Sur Develop

```bash
git switch develop
git pull --rebase origin develop
git status
git add -A
git commit -m "Description des modifications"
git push origin develop
```

Le push sur `develop` declenche automatiquement une Preview Vercel.

## Commit Direct Sur Main

Un commit direct sur `main` doit rester exceptionnel, par exemple pour une correction
urgente en production.

```bash
git switch main
git pull --rebase origin main
git status
git add -A
git commit -m "fix: description de la correction urgente"
git push origin main
```

Le push sur `main` declenche automatiquement un deploiement Vercel en production.

## Rebase De Develop Sur Main

Cette operation remet les commits de `develop` au-dessus du dernier `main`.

```bash
git status
git fetch origin
git switch develop
git rebase origin/main
git push --force-with-lease origin develop
```

En cas de conflit :

```bash
git status
```

Corriger les fichiers indiques, puis continuer :

```bash
git add -A
git rebase --continue
```

Pour annuler completement le rebase :

```bash
git rebase --abort
```

## Publier Develop Sur Main

Commencer par rebaser `develop` sur `main`, puis faire une fusion rapide vers `main`.

```bash
git fetch origin
git switch develop
git rebase origin/main
git push --force-with-lease origin develop

git switch main
git pull --ff-only origin main
git merge --ff-only develop
git push origin main

git switch develop
```

Le push final sur `main` met a jour la production Vercel.

## Creer Une Branche Feature Depuis Develop

Remplacer `nom-de-la-feature` par un nom court, par exemple
`feature/ajout-pokemon-0100`.

```bash
git switch develop
git pull --rebase origin develop
git switch -c feature/nom-de-la-feature
git push -u origin feature/nom-de-la-feature
```

Faire ensuite les modifications et creer les commits :

```bash
git status
git add -A
git commit -m "feat: description de la modification"
git push
```

## Rebase D'Une Feature Sur Develop

Mettre la feature a jour avec les derniers commits de `develop` :

```bash
git status
git fetch origin
git switch feature/nom-de-la-feature
git rebase origin/develop
git push --force-with-lease
```

En cas de conflit :

```bash
git status
git add -A
git rebase --continue
```

Pour annuler :

```bash
git rebase --abort
```

## Integrer Une Feature Dans Develop

Apres avoir rebased la feature sur `develop`, effectuer une fusion rapide :

```bash
git switch feature/nom-de-la-feature
git fetch origin
git rebase origin/develop
git push --force-with-lease

git switch develop
git pull --ff-only origin develop
git merge --ff-only feature/nom-de-la-feature
git push origin develop
```

Supprimer ensuite la branche devenue inutile :

```bash
git branch -d feature/nom-de-la-feature
git push origin --delete feature/nom-de-la-feature
```

## Mettre De Cote Des Modifications Non Committees

Si Git refuse un changement de branche car des fichiers sont modifies :

```bash
git stash push -u -m "travail temporaire"
```

Restaurer ensuite les modifications :

```bash
git stash pop
```

## Commandes A Eviter

Ces commandes peuvent supprimer du travail ou ecraser GitHub :

```text
git reset --hard
git push --force
git checkout -- .
```

Ne les utiliser qu'apres avoir compris exactement leurs consequences.
