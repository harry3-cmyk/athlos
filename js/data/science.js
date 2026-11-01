/* Athlos — principes d'entraînement et sources utilisées par le générateur */
(function (A) {
  'use strict';

  // cat · t : principe · d : ce que dit la recherche · app : comment Athlos l'applique · src : sources
  const SCIENCE = [
    // Hypertrophie
    { cat: 'Hypertrophie', t: 'Volume hebdomadaire', d: "La prise de muscle augmente avec le nombre de séries difficiles par muscle et par semaine, avec des rendements décroissants. Environ 10 séries/semaine est un bon repère, 10 à 20 pour les plus avancés.", app: "L'accueil et l'onglet Progrès comptent tes séries par muscle (1 pour un muscle principal, 0,5 pour un secondaire) et les comparent à la zone 10-20.", src: "Schoenfeld, Ogborn & Krieger (2017), J Sports Sci · repères MEV/MAV/MRV de Mike Israetel (Renaissance Periodization)" },
    { cat: 'Hypertrophie', t: "Proximité de l'échec", d: "Les séries efficaces se terminent proches de l'échec : 0 à 3 répétitions en réserve (RIR). Aller systématiquement à l'échec apporte peu de plus et fatigue davantage.", app: "Chaque exercice affiche un RIR cible : 1-2 sur les polyarticulaires, 0-1 sur l'isolation. Les débutants gardent une marge de plus.", src: "Zourdos et al. (2016), J Strength Cond Res · Refalo et al. (2023), Sports Med" },
    { cat: 'Hypertrophie', t: 'Large plage de répétitions', d: "De ~6 à 30 répétitions, l'hypertrophie est comparable si l'effort est proche de l'échec. Les charges lourdes restent supérieures pour la force maximale.", app: "Polyarticulaires en 6-10, isolation en 10-15, mollets/abdos en 12-20 : chaque zone au meilleur rapport efficacité/fatigue.", src: "Schoenfeld et al. (2017), J Strength Cond Res · Lopez et al. (2021), Med Sci Sports Exerc" },
    { cat: 'Hypertrophie', t: 'Repos entre les séries', d: "2-3 minutes de repos sur les gros mouvements donnent plus de force et de muscle qu'1 minute : les séries suivantes restent de qualité.", app: "Le chrono de repos se règle seul : 3 min et plus en force, 2-2,5 min sur les polyarticulaires, 60-90 s sur l'isolation.", src: "Schoenfeld et al. (2016), J Strength Cond Res · Singer et al. (2024), Front Sports Act Living" },
    { cat: 'Hypertrophie', t: 'Fréquence', d: "Entraîner chaque muscle au moins 2 fois par semaine est un moyen simple de répartir le volume et de garder des séries de qualité.", app: "Le suivi hebdomadaire par muscle te montre ce qui manque pour tes prochaines séances.", src: "Schoenfeld, Ogborn & Krieger (2016), Sports Med" },
    { cat: 'Hypertrophie', t: 'Travail en position étirée', d: "Les exercices qui chargent le muscle en position allongée tendent à produire plus d'hypertrophie : extension triceps au-dessus de la tête, leg curl assis, mollets avec pause en bas…", app: "Le générateur privilégie ces variantes (badge « Étirement ») en hypertrophie.", src: "Maeo et al. (2021), Med Sci Sports Exerc · Maeo et al. (2023), Eur J Sport Sci · Pedrosa et al. (2022), Eur J Sport Sci · Kassiano et al. (2023), J Strength Cond Res" },
    { cat: 'Hypertrophie', t: 'Ordre des exercices', d: "Les exercices placés en début de séance progressent davantage : on y met ce qui compte le plus.", app: "Ton point faible est placé en premier, avec une série et un exercice de plus.", src: "Simão et al. (2012), Sports Med" },
    { cat: 'Hypertrophie', t: 'Surcharge progressive', d: "Pour continuer à progresser, il faut augmenter peu à peu la difficulté. La double progression (d'abord les reps dans la fourchette, puis la charge) est simple et efficace.", app: "Athlos lit ta dernière performance et te suggère la charge : +2,5 kg (haut du corps), +5 kg (bas du corps) ou +1 rep.", src: "ACSM Position Stand (2009), Med Sci Sports Exerc · NSCA, Essentials of Strength Training and Conditioning" },

    // Force
    { cat: 'Force', t: 'Intensité et volume (table de Prilepin)', d: "Pour la force, on accumule des répétitions de qualité à charge lourde : à 70-80 % du max, 12-24 reps par séance en séries de 3-6 ; à 80-90 %, 10-20 reps en séries de 2-4 ; au-delà de 90 %, 4-10 reps en séries de 1-2.", app: "Les blocs force et les plans « M'améliorer » respectent ces fourchettes.", src: "A. S. Prilepin (1974), haltérophilie soviétique" },
    { cat: 'Force', t: 'Autorégulation (RPE / RIR)', d: "Ajuster la charge à la forme du jour grâce à l'effort perçu est au moins aussi efficace que des pourcentages fixes.", app: "Les charges sont indiquées en % et en RIR : si la barre est lente, baisse ; si elle file, monte un peu.", src: "Helms et al. (2018), Front Physiol · Zourdos et al. (2016)" },
    { cat: 'Force', t: 'Spécificité et variantes', d: "Pour progresser sur un mouvement, on le pratique souvent, avec des variantes qui ciblent le point de blocage : pause, prise serrée, déficit, partiels.", app: "Dans « M'améliorer », tu indiques où tu bloques et le plan choisit la variante et les accessoires adaptés.", src: "Jim Wendler (5/3/1) · Boris Sheiko · Greg Nuckols (Stronger by Science)" },
    { cat: 'Force', t: '1RM estimé', d: "Le maximum sur une répétition peut s'estimer à partir d'une série de 2 à 12 reps : 1RM ≈ charge × (1 + reps / 30).", app: "Tes records et courbes de progression utilisent cette estimation, sans avoir à tester ton max.", src: "Epley (1985)" },

    // Endurance
    { cat: 'Endurance', t: 'Distribution polarisée (80/20)', d: "Les meilleurs athlètes d'endurance font environ 80 % de leur volume à basse intensité et 20 % à haute intensité, avec peu de temps « entre les deux ».", app: "Si tu as déjà fait 2 séances intenses dans la semaine, le générateur te propose de la zone 2.", src: "Seiler & Kjerland (2006), Scand J Med Sci Sports · Seiler (2010), Int J Sports Physiol Perform" },
    { cat: 'Endurance', t: 'Intervalles norvégiens 4×4', d: "4 × 4 min à 85-95 % de la FC max avec 3 min de récupération active améliorent davantage la VO₂max qu'un effort continu modéré.", app: "Proposé quand tu as 25 min ou plus de cardio intense.", src: "Helgerud et al. (2007), Med Sci Sports Exerc" },
    { cat: 'Endurance', t: '30/30 et VMA', d: "Alterner 30 s à ~100 % de la VMA et 30 s de récupération permet d'accumuler beaucoup de temps près de la VO₂max.", app: "Séance de base des plans course et Luc Léger, avec allures calculées.", src: "Véronique Billat (2001), Sports Med" },
    { cat: 'Endurance', t: 'Tabata', d: "8 × (20 s d'effort maximal / 10 s de repos) : un format court qui sollicite fortement les filières aérobie et anaérobie.", app: "Utilisé quand il reste moins de 9 min de cardio.", src: "Tabata et al. (1996), Med Sci Sports Exerc" },
    { cat: 'Endurance', t: 'Entraînement concurrent', d: "Combiner force et endurance compromet peu l'hypertrophie et la force maximale ; l'explosivité peut être un peu plus affectée. Le risque augmente avec beaucoup de course.", app: "Dans les séances hybrides, la musculation passe avant le cardio pour protéger la qualité des séries lourdes.", src: "Wilson et al. (2012), J Strength Cond Res · Schumann et al. (2022), Sports Med" },
    { cat: 'Endurance', t: "Charge d'entraînement (sRPE)", d: "Effort perçu de la séance (1-10) × durée en minutes = charge interne, une méthode simple et validée pour suivre la fatigue.", app: "À la fin de chaque séance tu notes ton effort : l'onglet Progrès trace ta charge hebdomadaire.", src: "Foster et al. (2001), J Strength Cond Res" },

    // Santé
    { cat: 'Santé & prévention', t: 'Échauffement RAMP', d: "Élever la température, activer et mobiliser, puis potentialiser avec des séries de montée en charge.", app: "Chaque séance générée commence par un échauffement adapté aux zones travaillées.", src: "Ian Jeffreys (2007), Professional Strength & Conditioning" },
    { cat: 'Santé & prévention', t: 'Nordic hamstring', d: "Les programmes incluant le nordic réduisent d'environ moitié les blessures aux ischio-jambiers.", app: "Présent dans la séance Prévention et proposé pour les ischios.", src: "van Dyk et al. (2019), Br J Sports Med" },
    { cat: 'Santé & prévention', t: 'Planche Copenhague', d: "Un programme de renforcement des adducteurs a réduit de 41 % les problèmes à l'aine chez des footballeurs.", app: "Exercice prioritaire pour les adducteurs.", src: "Harøy et al. (2019), Br J Sports Med" },
    { cat: 'Santé & prévention', t: 'Big 3 de McGill', d: "Curl-up, planche latérale et bird dog : endurance du tronc sans flexions répétées de la colonne, en maintiens courts de ~10 s en pyramide descendante.", app: "Séance « Dos solide » et plan Gainage.", src: "Stuart McGill, Low Back Disorders · Back Mechanic" },
    { cat: 'Santé & prévention', t: 'Protéines', d: "Environ 1,6 g de protéines par kg de poids de corps et par jour maximise en moyenne les gains musculaires (jusqu'à ~2,2 g/kg pour certains).", app: "Repère affiché dans les conseils.", src: "Morton et al. (2018), Br J Sports Med" },
    { cat: 'Santé & prévention', t: 'Sommeil', d: "7 à 9 h par nuit pour les adultes : récupération, performance et santé.", app: "Repère affiché dans les conseils.", src: "Hirshkowitz et al. (2015), Sleep Health (National Sleep Foundation)" },

    // Militaire & tactique
    { cat: 'Militaire & tactique', t: 'Grease the Groove', d: "Des séries fréquentes, sous-maximales (~50 % du max), réparties dans la journée, jamais à l'échec : on « graisse » le schéma moteur.", app: "Utilisé dans les plans Tractions et Pompes pour les premiers paliers.", src: "Pavel Tsatsouline, The Naked Warrior (2004)" },
    { cat: 'Militaire & tactique', t: 'Programme Armstrong', d: "Programme de tractions sur 5 jours (séries max, pyramide, séries d'entraînement à prises variées) conçu pour le test physique des Marines.", app: "Base du plan Tractions pour 5 à 11 reps.", src: "Maj. Charles Lewis Armstrong, US Marine Corps" },
    { cat: 'Militaire & tactique', t: 'Préparation tactique concurrente', d: "Force et endurance travaillées en parallèle, par blocs de ~6 semaines, avec peu de mouvements et beaucoup de constance.", app: "Séance type « Force tactique » et objectif Force + Endurance.", src: "K. Black, Tactical Barbell · US Army H2F, FM 7-22 (2020)" },
    { cat: 'Militaire & tactique', t: 'Test Luc Léger', d: "Course navette de 20 m à vitesse croissante (départ 8,5 km/h, +0,5 km/h par palier d'une minute) : un test de terrain de l'aptitude aérobie utilisé dans de nombreux concours.", app: "Plan dédié avec 30/30, navettes spécifiques et footings.", src: "Léger et al. (1988), J Sports Sci" },
  ];

  const COACHES = [
    { n: 'Brad Schoenfeld', f: 'Hypertrophie', i: 'Volume, charges, repos : les méta-analyses de référence.' },
    { n: 'Eric Helms', f: 'Musculation naturelle', i: 'RIR, autorégulation, priorités de la progression.' },
    { n: 'Mike Israetel', f: 'Périodisation', i: 'Repères de volume MEV / MAV / MRV.' },
    { n: 'Greg Nuckols', f: 'Force', i: 'Synthèse de la recherche en powerlifting.' },
    { n: 'Jim Wendler', f: 'Force', i: '5/3/1 : progression lente, régulière et durable.' },
    { n: 'Mark Rippetoe', f: 'Débutants', i: 'Progression linéaire sur les grands mouvements.' },
    { n: 'Boris Sheiko', f: 'Powerlifting', i: 'Beaucoup de volume technique à charge sous-maximale.' },
    { n: 'Pavel Tsatsouline', f: 'Force & kettlebell', i: 'Grease the Groove, « la force est une compétence ».' },
    { n: 'Stuart McGill', f: 'Biomécanique du dos', i: 'Big 3 et endurance du tronc.' },
    { n: 'Stephen Seiler', f: 'Endurance', i: 'Distribution polarisée 80/20.' },
    { n: 'Véronique Billat', f: 'Course', i: 'VMA et 30/30.' },
    { n: 'Jack Daniels', f: 'Course', i: 'Allures d\'entraînement selon le niveau.' },
    { n: 'Dan John', f: 'Préparation générale', i: 'Portés de charge et simplicité.' },
    { n: 'Joel Jamieson', f: 'Sports de combat', i: 'Conditionnement et base aérobie.' },
    { n: 'Mike Boyle', f: 'Entraînement fonctionnel', i: 'Travail unilatéral et prévention.' },
    { n: 'K. Black', f: 'Militaires & forces de l\'ordre', i: 'Tactical Barbell : force + endurance.' },
  ];

  const TIPS = [
    "Dors 7 à 9 h : c'est là que tu récupères et que tu progresses.",
    "Vise ~1,6 g de protéines par kg de poids de corps et par jour (Morton et al. 2018).",
    "Une séance réussie à 2 RIR vaut mieux qu'une séance ratée à l'échec.",
    "En endurance, ~80 % de ton volume devrait être facile : tu dois pouvoir parler.",
    "Note ton effort en fin de séance : c'est ce qui permet de suivre ta charge d'entraînement.",
    "Ton point faible passe en premier dans la séance : c'est là qu'il progresse le plus.",
    "Les charges lourdes ne sont pas obligatoires pour le muscle : 6 à 30 reps proches de l'échec fonctionnent.",
    "Les nordic curls réduisent d'environ moitié les blessures aux ischios.",
  ];

  A.DATA = Object.assign(A.DATA || {}, { SCIENCE, COACHES, TIPS });
})(window.A);
