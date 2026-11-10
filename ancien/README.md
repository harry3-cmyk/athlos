# Athlos — entraînement basé sur la science

**Site en ligne : https://harry3-cmyk.github.io/athlos/**

Application web de sport (installable sur téléphone) : séances générées à partir de la recherche en sciences du sport, corps humain cliquable, mode séance guidée avec chronos, historique complet et suivi des progrès.

## Fonctionnalités

- **Enregistrer** : quatre façons de démarrer
  - **Crée ma séance** : questionnaire (temps disponible 30 min → 2 h, objectif force / hypertrophie / endurance / mixte / un peu de tout, zones à travailler sur un corps de face et de dos, point faible prioritaire, matériel et niveau). Le générateur construit la séance : échauffement, blocs, séries, reps, RIR, temps de repos, retour au calme.
  - **Je sais ce que je veux faire** : 22 séances types (Push/Pull/Legs, full body débutant et intermédiaire, bras, épaules, German Volume Training, circuit militaire, Murph, force tactique, test militaire, kettlebell Simple & Sinister, zone 2, 4×4 norvégien, 30/30, Tabata, Big 3 de McGill, prévention, mobilité), construction libre ou séance passée à refaire.
  - Les séances générées remplissent le temps choisi avec des **supersets A1/A2** (muscles opposés ou non concurrents, repos complet pour chaque muscle) et plusieurs exercices par grand muscle, dans la limite du volume utile par séance.
  - **M'améliorer sur un exercice** : plans de 6 semaines pour le développé couché, le squat, le soulevé de terre, le développé militaire, les tractions, les pompes, la course 5/10 km, le Luc Léger et le gainage, avec exercices choisis selon ton point de blocage.
  - **Ajouter une activité** faite sans l'app (course, vélo, sport collectif…).
- **Deux modes de séance** : version écrite (imprimable, cases à cocher) ou **mode guidé** (série en cours, charges suggérées, chrono de repos automatique avec bip et vibration, minuteurs d'intervalles, maintiens chronométrés, remplacement d'exercice, bilan final avec records).
- **Historique** de toutes les séances, **Progrès** (temps, volume, charge sRPE par semaine, séries par muscle vs zone 10-20, 1RM estimé par exercice, calendrier de régularité).
- **La science** : chaque règle du générateur est sourcée (Schoenfeld, Helms, Israetel, Prilepin, Seiler, Billat, Helgerud, McGill, Tsatsouline, programme Armstrong, Tactical Barbell…).

Les données restent sur l'appareil (localStorage). L'export / import JSON se fait depuis le Profil.

## Mettre le site en ligne avec GitHub Pages

Aucune installation ni compilation : ce sont des fichiers statiques.

1. Crée le dépôt sur [github.com/new](https://github.com/new) : nom `athlos`, **Public**, puis *Create repository*.
2. Envoie les fichiers :
   - **Sans ligne de commande** : sur la page du dépôt, *Add file → Upload files* (ou le lien « uploading an existing file »), glisse tout le contenu du dossier (index.html, css, js, icons, manifest.webmanifest, sw.js, README.md), puis *Commit changes*. `index.html` doit être à la racine du dépôt, pas dans un sous-dossier.
   - **Avec git** :
     ```bash
     git init
     git add .
     git commit -m "Athlos"
     git branch -M main
     git remote add origin https://github.com/harry3-cmyk/athlos.git
     git push -u origin main
     ```
3. Dans le dépôt : *Settings → Pages → Build and deployment*, source **Deploy from a branch**, branche **main**, dossier **/ (root)**, *Save*.
4. Après une à deux minutes, le site est en ligne sur https://harry3-cmyk.github.io/athlos/.
5. Sur téléphone, ouvre l'adresse puis *Ajouter à l'écran d'accueil* : l'app s'installe et fonctionne hors ligne.

## Tester en local

Ouvre simplement `index.html` dans un navigateur. Pour tester l'installation et le mode hors ligne, sers le dossier avec un petit serveur (par exemple `npx serve` ou `python -m http.server`).

## Structure

```
index.html            page unique
css/style.css         styles (thème sombre / clair)
js/core.js            stockage local et utilitaires
js/data/exercises.js  muscles, matériel, ~130 exercices
js/data/science.js    principes et sources
js/data/programs.js   séances types et plans « M'améliorer »
js/generator.js       générateur de séances et suggestions de charges
js/body.js            silhouette cliquable face / dos
js/views/*.js         écrans
js/player.js          mode séance guidée
sw.js                 fonctionnement hors ligne
```

> Repères d'entraînement généraux : ils ne remplacent pas l'avis d'un médecin ou d'un professionnel de santé.
