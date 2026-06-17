# Storybook

Le nouveau front checklist utilise Storybook pour documenter les composants UI
les plus importants et garder une base visuelle stable pendant la refonte.

## Commandes

- `npm run storybook`
- `npm run build-storybook`

## Composants déjà documentés

- `Site/MetricCard`
- `Site/SectionCard`
- `Checklist/PokemonCard`
- `Admin/LoginCard`

## Rôle dans le projet

- documenter les variantes visuelles
- sécuriser les régressions UI avant les pushes Vercel
- servir de base à une bibliothèque de composants plus large pour le dashboard admin

## Convention

- les composants partagés vivent dans `components/`
- les stories vivent à côté des composants
- les pages Next.js (`app/`) consomment ces composants, elles ne portent pas le design system seules
