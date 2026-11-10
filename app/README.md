# Forge — suivi de performances physiques

Application web complète pour suivre sa musculation : saisie des séances, programmes générés selon l'objectif,
historique et records, graphiques de progression, poids et composition corporelle, planning, analyse automatique
des points faibles et tableau de bord.

- **Front** : React 18 + TypeScript + Vite, Recharts. Interface en français, pensée d'abord pour le téléphone (saisie en salle), thèmes clair et sombre, installable sur l'écran d'accueil.
- **Back** : Node.js 20+ / Express + TypeScript, validation Zod.
- **Base** : SQLite (fichier unique, mode WAL) via `better-sqlite3`.
- **Déploiement** : un seul processus et un seul port — le serveur sert l'API (`/api`) et le front compilé.

## Deux façons de l'utiliser

| | Version en ligne (GitHub Pages) | Version serveur (auto-hébergée) |
|---|---|---|
| Accès | Un lien, rien à installer, pas de compte | Ton propre serveur, compte et mot de passe |
| Données | Dans le navigateur de l'appareil (SQLite WebAssembly + IndexedDB) | Sur le serveur (fichier SQLite) |
| Plusieurs appareils | Non — passer par l'export / import JSON | Oui |
| Commande | `npm run build:pages` | `npm run build` puis `npm start` |

Les deux versions partagent **le même code** : en version en ligne, les routes et la logique du serveur
(`server/src/routes`, `server/src/domain`) s'exécutent dans le navigateur ; seuls le transport et le stockage changent
(`web/src/local/`).

### Publication sur GitHub Pages

Dans ce dépôt, GitHub Pages sert directement la racine de la branche `main` : le site compilé y est donc versionné
(`index.html`, `assets/`), à côté du code source rangé dans `app/`. Pour publier une modification :

```bash
npm run publish:root
```

puis commit et push. Le site est mis à jour une à deux minutes plus tard.

En version en ligne, vider les données de navigation ou changer d'appareil fait perdre l'historique : l'export JSON
(Réglages → Mes données) sert de sauvegarde. Sur iPhone, ajouter l'application à l'écran d'accueil limite le risque que
Safari efface les données d'un site resté longtemps sans visite.

## Démarrage rapide (version serveur)

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

```bash
npm run build
```

```bash
npm start
```

Ouvre http://localhost:3000 et crée ton compte. La base est créée automatiquement dans `data/forge.db`.

Pour explorer l'application avec 12 semaines de données simulées (compte `demo@forge.local` / `demo1234`) :

```bash
npm run seed:demo
```

### Développement

```bash
npm run dev
```

Lance l'API sur le port 3000 (rechargement automatique) et le front Vite sur http://localhost:5173 (proxy `/api`).

| Commande | Rôle |
|---|---|
| `npm test` | 35 tests : calculs, générateur, analyse, API complète (SQLite en mémoire) |
| `npm run typecheck` | Vérification TypeScript, serveur et front |
| `npm run e2e:pages` | Parcours de la version en ligne, données d'exemple comprises (après `VITE_BASE=/forge/ npm run build:pages`) |
| `npm run e2e` | Parcours complet de la version serveur dans Chromium (après `npm run build`) ; nécessite `npm i -D playwright && npx playwright install chromium` |

### Configuration (variables d'environnement)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `DATABASE_PATH` | `data/forge.db` | Fichier SQLite |
| `ALLOW_REGISTRATION` | `true` | `false` ferme les inscriptions (à faire une fois ton compte créé sur une instance publique) |
| `STATIC_DIR` | `web/dist` | Dossier du front compilé |

## Fonctionnalités

| Domaine | Détail |
|---|---|
| Séances | Séance libre ou issue d'un programme ; charge, répétitions, RPE par série ; minuteur de repos ; enregistrement automatique ; correction a posteriori ; exercices personnalisés |
| Aide à la progression | Rappel de la dernière performance et charge conseillée (double progression : d'abord les répétitions, puis +2,5 %) |
| Programmes | Générateur selon objectif, jours/semaine, niveau, matériel, durée, muscles prioritaires ; chaque règle est justifiée et sourcée ; substitution d'exercices |
| Planning | Calendrier mensuel ; planification d'un programme sur 4 à 16 semaines avec semaines de décharge ; séances manquées signalées |
| Progression | 1RM estimé (Epley), volume par séance, records par exercice, détection des records en fin de séance |
| Corps | Poids avec tendance lissée, masse grasse saisie ou estimée (méthode US Navy), masse maigre, mensurations |
| Analyse | Volume et fréquence par muscle, équilibres tirage/poussée et chaîne postérieure/quadriceps, rapports de force, stagnations, assiduité, rythme de variation du poids |
| Données | Export / import JSON, multi-utilisateur avec isolation stricte |

## Architecture

```
forge/
├── server/                  API + logique métier
│   ├── src/
│   │   ├── domain/          Fonctions pures, sans base ni HTTP (testables isolément)
│   │   │   ├── metrics.ts       1RM, régression, tendance, masse grasse, double progression
│   │   │   ├── generator.ts     Générateur de programmes + principes sourcés
│   │   │   ├── analysis.ts      Analyse des points faibles (seuils regroupés dans `T`)
│   │   │   └── exercises.seed.ts Catalogue de 74 exercices
│   │   ├── routes/          workouts · programs · insights (corps, analyse, tableau de bord) · data (export/import)
│   │   ├── queries.ts       Accès aux données partagé entre routes
│   │   ├── auth.ts          Comptes, sessions, limitation de débit
│   │   ├── db.ts            Connexion, migrations versionnées, catalogue
│   │   ├── app.ts           Assemblage Express (sécurité, erreurs, fichiers statiques)
│   │   └── index.ts         Point d'entrée
│   └── test/
├── web/                     Interface React
│   └── src/ pages/ · components/ · lib/ (client API, formats) · styles.css (jetons de design)
├── e2e/smoke.mjs            Test de bout en bout
├── Dockerfile · docker-compose.yml
└── docs/HEBERGEMENT.md
```

Principe directeur : **les calculs vivent dans `server/src/domain/`**, sous forme de fonctions pures. Les routes
chargent les données, appellent le domaine, renvoient du JSON. Le front n'effectue aucun calcul métier.

### Modèle de données

```
users ──< sessions
  │
  ├──< exercises (user_id NULL = catalogue, sinon exercice personnalisé)
  ├──< programs ──< program_days ──< program_day_exercises >── exercises
  ├──< workouts (planned | in_progress | done) ──< workout_exercises ──< sets
  │                                                     └──> exercises
  └──< body_metrics (une ligne par jour)
```

Une séance planifiée et une séance réalisée sont la même entité (`workouts`) avec un statut différent : planifier,
démarrer puis terminer ne fait que changer ce statut, sans copie de données. Records, volumes et tendances sont
**calculés à la lecture** à partir des séries ; rien n'est stocké en double, donc corriger une ancienne séance met
tout à jour.

### Faire évoluer l'application

- **Schéma** : ajouter une entrée à la fin de `MIGRATIONS` dans `server/src/db.ts` (ne jamais modifier une entrée existante). Elle s'applique au démarrage.
- **Exercices** : ajouter une ligne dans `exercises.seed.ts` ; le catalogue est synchronisé au démarrage.
- **Règles d'analyse** : seuils dans l'objet `T` de `analysis.ts`, chaque règle produit un `Finding`.
- **Générateur** : modèles de séances (`DayTemplate`), répartitions (`SPLITS`) et prescriptions (`PRESCRIPTIONS`) dans `generator.ts`.
- **Montée en charge** : SQLite suffit largement pour un usage personnel ou un petit groupe. Pour des milliers d'utilisateurs, migrer `db.ts` et `queries.ts` vers PostgreSQL et mettre en cache les agrégats.

## Méthode et sources

Le générateur n'imite pas la routine d'un champion : elle est calibrée pour sa génétique, son ancienneté et sa
récupération. Il applique les principes communs à la recherche et aux entraîneurs de haut niveau.

| Règle | Source | Nature |
|---|---|---|
| Relation dose-réponse entre séries hebdomadaires et hypertrophie ; repère de 10 séries/muscle | Schoenfeld, Ogborn & Krieger, *J Sports Sci*, 2017 | Méta-analyse (surtout des débutants ; peu de données au-delà de 10 séries) |
| Chaque muscle au moins 2×/semaine | Schoenfeld et al., *Sports Med*, 2016 ; Schoenfeld, Grgic & Krieger, 2019 | Méta-analyses (à volume égal, l'effet propre de la fréquence est faible) |
| Séries proches de l'échec sans l'atteindre (RIR) | Refalo et al., *Sports Med*, 2023 ; Zourdos et al., 2016 | Méta-analyse + validation de l'échelle |
| Charges lourdes pour la force, plage large pour l'hypertrophie | Schoenfeld et al., *J Strength Cond Res*, 2017 | Méta-analyse |
| Temps de repos | ACSM Position Stand, 2009 | Consensus |
| Progression lente, cycles avec décharge | Jim Wendler, *5/3/1* | Méthode d'entraîneur |
| Volume ajusté à la récupération | Mike Israetel, Renaissance Periodization | Cadre d'entraîneur |
| En déficit : garder l'intensité, perdre 0,5–1 %/semaine | Helms, Aragon & Fitschen, *JISSN*, 2014 | Revue |

À lire comme des **estimations ou des repères**, pas comme des faits : le 1RM estimé (formule d'Epley), la masse
grasse par circonférences (US Navy, ±3–4 points), les fourchettes de rapports de force et d'équilibre, le repère de
6 séries/semaine hors hypertrophie et le seuil de 25 séries. L'application ne remplace ni un entraîneur ni un avis médical.

## Sécurité

- Mots de passe hachés avec scrypt (sel aléatoire par compte) ; sessions par cookie `HttpOnly`, `SameSite=Lax`, `Secure` en HTTPS ; seul le hachage du jeton est stocké.
- Toute écriture exige un en-tête personnalisé (protection CSRF) ; connexion et inscription limitées en débit.
- Chaque requête SQL est paramétrée et filtrée par utilisateur ; l'isolation entre comptes est couverte par les tests.
- Toutes les entrées sont validées côté serveur (Zod).

## Limites connues

- Pas de réinitialisation de mot de passe par e-mail (aucun service d'envoi) : en cas d'oubli, il faut intervenir sur la base.
- Pas de mode hors ligne : une connexion est nécessaire pendant la séance (la saisie est enregistrée en continu).
- Unités en kilogrammes et centimètres uniquement.
- L'image Docker fournie n'a pas pu être construite dans l'environnement de développement (pas de démon Docker) ; l'exécution en production hors Docker (`npm run build` puis `npm start`) est, elle, couverte par le test de bout en bout.

Hébergement, HTTPS et sauvegardes : voir [docs/HEBERGEMENT.md](docs/HEBERGEMENT.md).
