# Sécurité Admin

## Objectif

Séparer strictement la consultation publique de la checklist et les outils
administrateur sensibles.

## Principe retenu

- les visiteurs accèdent aux vues publiques Next.js et aux routes publiques `/api/v1`
- les outils sensibles passent par `/api/checklist-v3`
- les actions sensibles exigent une session admin ou le header `x-checklist-password`
- le mot de passe admin vient de `ADMIN_DASHBOARD_PASSWORD`, avec repli possible sur `CHECKLIST_PASSWORD`

## Session admin

- cookie httpOnly `pokedex_admin_session`
- signature HMAC côté serveur
- durée de session de 30 jours
- cookie `Secure` en production

## Actions protégées

- login / logout admin
- audit d’URLs
- analyse source avancée
- prévisualisation de règles perso
- validation admin future

## Points publics conservés

- `/`
- `/checklist`
- `/assets`
- `/api-docs`
- `/swagger`
- `/api-docs.json`
- `/health`
- `/api/v1/**`
