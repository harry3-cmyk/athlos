# Forge — suivi de performances physiques

**Application en ligne : https://harry3-cmyk.github.io/athlos/**

Suivi des séances de musculation, programmes générés selon l'objectif, historique et records, graphiques de
progression, poids et composition corporelle, planning, analyse des points faibles et tableau de bord.
Aucun compte : les données restent sur l'appareil, dans le navigateur (export / import JSON dans les réglages).

## Contenu du dépôt

| Emplacement | Contenu |
|---|---|
| `index.html`, `assets/`, `icon.svg`, `manifest.webmanifest` | Site compilé, servi tel quel par GitHub Pages (branche `main`, racine) |
| `app/` | Code source complet, tests et documentation — voir [app/README.md](app/README.md) |
| `ancien/` | Application précédente (Athlos), toujours accessible sur https://harry3-cmyk.github.io/athlos/ancien/ avec ses données |
| `sw.js` | Désinscrit le service worker de l'ancienne application pour que la nouvelle s'affiche |

## Modifier et republier

```bash
cd app
```

```bash
npm install
```

```bash
npm run publish:root
```

Puis commit et push : le site est à jour une à deux minutes plus tard.
