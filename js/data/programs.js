/* Athlos — séances types et plans « M'améliorer sur un exercice » */
(function (A) {
  'use strict';
  const G = A.gen, ui = A.ui;
  const { I, B, S, C } = G;

  // ———————————————————— Séances types ————————————————————
  const TEMPLATES = [
    { id: 'fb_debutant', cat: 'Musculation', n: 'Full body débutant', d: "Squat, développé couché, rowing en 3 × 5 : ajoute 2,5 kg dès que tout est réussi. Progression linéaire inspirée de Mark Rippetoe.",
      build: () => S('Full body débutant', [
        B('force', 'Polyarticulaires', [I('squat', 3, '5', 180, { rir: '2' }), I('bench', 3, '5', 180, { rir: '2' }), I('row_bar', 3, '5', 150, { rir: '2' })]),
        B('hyper', 'Complément', [I('rdl', 2, '8', 120, { rir: '2' }), I('plank', 3, 30, 60)]),
      ], { goal: 'force' }) },
    { id: 'push', cat: 'Musculation', n: 'Push · pecs, épaules, triceps', d: "Hypertrophie du haut du corps « poussée », avec variantes en étirement.",
      build: () => S('Push · pecs, épaules, triceps', [
        B('hyper', 'Hypertrophie', [I('bench', 3, '6-8', 180, { rir: '1-2' }), I('incline_db', 3, '8-12', 150, { rir: '1-2' }), I('cable_fly', 3, '12-15', 90, { rir: '0-1' }),
          I('lat_raise', 4, '12-20', 60, { rir: '0-1' }), I('oh_ext_cable', 3, '10-15', 90, { rir: '0-1' }), I('pushdown', 2, '12-15', 60, { rir: '0-1' })]),
      ], { goal: 'hypertrophie' }) },
    { id: 'pull', cat: 'Musculation', n: 'Pull · dos, biceps', d: "Dos en largeur et en épaisseur, arrière d'épaules et biceps.",
      build: () => S('Pull · dos, biceps', [
        B('hyper', 'Hypertrophie', [I('pullup', 3, '6-10', 150, { rir: '1-2' }), I('cable_row', 3, '8-12', 150, { rir: '1-2' }), I('row_db', 3, '8-12', 120, { rir: '1' }),
          I('cable_pullover', 2, '12-15', 90, { rir: '0-1' }), I('face_pull', 3, '15-20', 60, { rir: '0-1' }), I('curl_incline', 3, '10-15', 90, { rir: '0-1' }), I('curl_hammer', 2, '10-12', 60, { rir: '0-1' })]),
      ], { goal: 'hypertrophie' }) },
    { id: 'legs', cat: 'Musculation', n: 'Legs · jambes complètes', d: "Quadriceps, ischios, fessiers et mollets, avec leg curl assis et mollets en étirement.",
      build: () => S('Legs · jambes complètes', [
        B('hyper', 'Hypertrophie', [I('squat', 3, '6-8', 180, { rir: '1-2' }), I('rdl', 3, '8-10', 150, { rir: '1-2' }), I('bulgarian', 3, '8-12', 120, { rir: '1' }),
          I('seated_curl', 3, '10-15', 90, { rir: '0-1' }), I('leg_ext', 2, '12-15', 90, { rir: '0-1' }), I('calf_machine', 4, '10-15', 60, { rir: '0-1' })]),
      ], { goal: 'hypertrophie' }) },
    { id: 'upper', cat: 'Musculation', n: 'Haut du corps · force-hypertrophie', d: "Un lourd en poussée et en tirage, puis du volume.",
      build: () => S('Haut du corps · force-hypertrophie', [
        B('force', 'Force', [I('bench', 4, '4-6', 180, { rir: '1-2', pctRange: [0.8, 0.85] }), I('row_bar', 4, '5-7', 150, { rir: '2' })]),
        B('hyper', 'Hypertrophie', [I('db_press', 3, '8-12', 120, { rir: '1' }), I('lat_pulldown', 3, '10-12', 120, { rir: '1' }), I('lat_raise', 3, '12-20', 60, { rir: '0-1' }),
          I('oh_ext_db', 2, '10-15', 90, { rir: '0-1' }), I('curl_incline', 2, '10-15', 90, { rir: '0-1' })]),
      ], { goal: 'force_hyper' }) },
    { id: 'lower', cat: 'Musculation', n: 'Bas du corps · force-hypertrophie', d: "Squat lourd, charnière de hanche, puis volume ciblé.",
      build: () => S('Bas du corps · force-hypertrophie', [
        B('force', 'Force', [I('squat', 4, '4-6', 210, { rir: '1-2', pctRange: [0.8, 0.85] }), I('deadlift', 3, '3-5', 210, { rir: '2', pctRange: [0.8, 0.85] })]),
        B('hyper', 'Hypertrophie', [I('leg_press', 3, '10-12', 120, { rir: '1' }), I('seated_curl', 3, '10-15', 90, { rir: '0-1' }), I('calf_single', 3, '12-20', 60, { rir: '0-1' }), I('hanging_leg_raise', 3, '10-15', 60, { rir: '1' })]),
      ], { goal: 'force_hyper' }) },
    { id: 'mil_circuit', cat: 'Militaire & tactique', n: 'Circuit préparation militaire', d: "Pompes, tractions, squats, gainage et burpees en circuit, puis course : le socle des tests de sélection.",
      build: () => S('Circuit préparation militaire', [
        B('circuit', 'Circuit (5 tours)', [I('pushup', 5, '15-20', 20), I('pullup', 5, '5-10', 20), I('air_squat', 5, '20-25', 20), I('burpee', 5, '10', 20), I('plank', 5, 45, 20)], { rounds: 5, restEx: 20, restRound: 90 }),
        B('cardio', 'Course', [C.billat('course', 12)]),
      ], { goal: 'force_endu' }) },
    { id: 'murph', cat: 'Militaire & tactique', n: 'Murph partitionné', d: "Hommage au Lt Michael Murphy (Navy SEAL) : 1,6 km de course, 20 tours de 5 tractions / 10 pompes / 15 squats, 1,6 km de course. Réduis à 10 tours si besoin.",
      build: () => S('Murph partitionné', [
        B('cardio', 'Course 1', [{ type: 'cardio', id: 'run1', name: 'Course 1,6 km', protocol: 'steady', duration: 600, intensity: 'Allure soutenue mais régulière', note: 'Adapte la durée à ta vitesse : 1,6 km.', hard: true, mod: 'course' }]),
        B('circuit', '20 tours', [I('pullup', 20, '5', 0), I('pushup', 20, '10', 0), I('air_squat', 20, '15', 0)], { rounds: 20, restEx: 0, restRound: 30 }),
        B('cardio', 'Course 2', [{ type: 'cardio', id: 'run2', name: 'Course 1,6 km', protocol: 'steady', duration: 600, intensity: 'Tout ce qui reste', note: '', hard: true, mod: 'course' }]),
      ], { goal: 'endurance' }) },
    { id: 'tactical', cat: 'Militaire & tactique', n: 'Force tactique', d: "Trois mouvements lourds en 5 × 3-5, puis conditionnement court. Inspiré de Tactical Barbell (K. Black).",
      build: () => S('Force tactique', [
        B('force', 'Force', [I('squat', 5, '3-5', 180, { rir: '2', pctRange: [0.8, 0.85] }), I('bench', 5, '3-5', 180, { rir: '2', pctRange: [0.8, 0.85] }), I('pullup', 5, '3-5', 150, { rir: '2', load: 'Lesté si possible' })]),
        B('cardio', 'Conditionnement', [C.hiit11('course', 16)]),
      ], { goal: 'force_endu' }) },
    { id: 'z2_45', cat: 'Endurance', n: 'Zone 2 · 45 min', d: "Footing, vélo ou rameur à allure de conversation : 80 % de ton volume d'endurance devrait ressembler à ça (Seiler).",
      build: () => S('Zone 2 · 45 min', [B('cardio', 'Endurance fondamentale', [C.z2('course', 45)])], { goal: 'endurance' }) },
    { id: 'n4x4', cat: 'Endurance', n: 'Intervalles norvégiens 4×4', d: "4 × 4 min à 85-95 % FC max, 3 min de récupération active (Helgerud et al. 2007).",
      build: () => S('Intervalles norvégiens 4×4', [B('cardio', 'Intervalles', [C.n4x4('course')])], { goal: 'endurance' }) },
    { id: 'billat', cat: 'Endurance', n: '30/30 de Billat', d: "2 séries de 10 × 30 s à VMA / 30 s de récupération, 3 min entre les séries.",
      build: () => S('30/30 de Billat', [B('cardio', 'VMA', [Object.assign(C.billat('course', 20), { rounds: 10 })])], { goal: 'endurance' }) },
    { id: 'tabata', cat: 'Endurance', n: 'Tabata express', d: "Deux blocs Tabata au poids du corps : 15 min chrono, échauffement compris.",
      build: () => S('Tabata express', [B('cardio', 'Tabata', [C.tabata('circuit'), Object.assign(C.tabata('circuit'), { labels: ['Squats sautés', 'Pompes'] })])], { goal: 'endurance' }) },
    { id: 'mcgill', cat: 'Santé & prévention', n: 'Dos solide · Big 3 de McGill', d: "Curl-up, planche latérale, bird dog en maintiens de 10 s, pyramide descendante.",
      build: () => S('Dos solide · Big 3 de McGill', [
        B('hyper', 'Big 3', [I('mcgill_curlup', 3, '6/4/2 × 10 s', 45, { setReps: [6, 4, 2] }), I('side_plank', 3, 10, 45, { note: 'Pyramide 6/4/2 maintiens de 10 s par côté' }), I('bird_dog', 3, '6/4/2 × 10 s', 45, { setReps: [6, 4, 2] })]),
        B('hyper', 'Mobilité douce', [I('cat_camel', 2, '8', 30), I('hip_9090', 2, '8', 30)]),
      ], { goal: 'endurance', warmup: [{ n: 'Marche', d: '5 min de marche rapide : McGill la recommande pour préparer le dos' }] }) },
    { id: 'prevention', cat: 'Santé & prévention', n: 'Prévention des blessures', d: "Ischios (nordic), adducteurs (Copenhague), mollets, épaules et tronc : les exercices qui ont fait leurs preuves.",
      build: () => S('Prévention des blessures', [
        B('hyper', 'Prévention', [I('nordic', 3, '4-6', 120, { rir: '1-2' }), I('copenhagen', 3, 20, 60), I('calf_single', 3, '12-15', 60), I('face_pull', 3, '15-20', 60), I('side_plank', 2, 30, 45), I('sl_rdl', 2, '8-10', 60)]),
      ], { goal: 'hypertrophie' }) },
    { id: 'mobility', cat: 'Santé & prévention', n: 'Mobilité · 20 min', d: "Hanches, dos et épaules : idéal les jours de repos ou après une séance.",
      build: () => S('Mobilité · 20 min', [
        B('hyper', 'Mobilité', [I('cat_camel', 2, '10', 20), I('thoracic_rot', 2, '8', 20), I('wgs', 2, '5', 20), I('hip_9090', 2, '10', 20), I('couch_stretch', 2, 45, 20), I('deep_squat_hold', 3, 40, 20)]),
      ], { goal: 'endurance', warmup: [], cooldown: [] }) },
  ];

  // ———————————————————— Plans de progression ————————————————————
  const BAR_WEEKS = [
    { h: [4, 5, 0.75], v: [4, 7, 0.65], note: 'Prise en main : technique parfaite et barre rapide.' },
    { h: [4, 4, 0.80], v: [4, 6, 0.70], note: "On monte l'intensité." },
    { h: [5, 3, 0.85], v: [4, 6, 0.72], note: 'Semaine la plus dure du bloc.' },
    { h: [3, 3, 0.75], v: [3, 5, 0.60], note: 'Décharge : la fatigue se dissipe, les gains apparaissent.' },
    { h: [4, 2, 0.90], v: [3, 5, 0.72], note: 'Intensification : charges proches du max.' },
    { h: 'test', note: 'Test : nouveau 1RM (ou série maximale à 90 %).' },
  ];

  const IMPROVE = {
    bench: {
      n: 'Développé couché', ex: 'bench', kind: 'barbell', icon: 'dumbbell',
      intro: "Le développé couché dépend des pecs, des triceps, des épaules avant et d'un haut du dos solide qui sert de base. On le pratique 2 ×/semaine : un jour lourd, un jour volume avec une variante qui cible ton point de blocage.",
      weak: [
        { v: 'bas', n: 'En bas (décoller la barre de la poitrine)', variant: 'bench_pause', f: 0.92, acc: ['incline_db', 'cable_fly', 'row_db'], tip: "Le départ dépend des pecs et des épaules avant : pause marquée et amplitude profonde." },
        { v: 'milieu', n: 'Au milieu de la trajectoire', variant: 'spoto', f: 0.9, acc: ['dips', 'bench_db', 'row_bar'], tip: "Le Spoto press renforce la zone critique 2-3 cm au-dessus de la poitrine." },
        { v: 'haut', n: 'En haut (verrouillage des bras)', variant: 'cgbp', f: 0.9, acc: ['oh_ext_cable', 'skull', 'dips'], tip: "Le verrouillage est l'affaire des triceps : prise serrée et extensions." },
        { v: 'stab', n: 'Barre instable / épaules qui gênent', variant: 'bench_pause', f: 0.92, acc: ['chest_row', 'face_pull', 'rear_fly'], tip: "Un haut du dos fort stabilise les épaules et la trajectoire." },
        { v: 'nsp', n: 'Je ne sais pas', variant: 'bench_pause', f: 0.92, acc: ['cgbp', 'incline_db', 'row_bar'], tip: "Plan équilibré : pecs, triceps et dos." },
      ],
      principles: ['2 séances par semaine sur le mouvement (Greg Nuckols : la fréquence aide la technique).', 'Charges en % du 1RM selon la table de Prilepin.', 'Le dos doit être aussi fort que la poitrine : au moins autant de tirages que de poussées.'],
    },
    squat: {
      n: 'Squat', ex: 'squat', kind: 'barbell', icon: 'dumbbell',
      intro: "Le squat repose sur les quadriceps, les fessiers, les adducteurs et un tronc rigide. Deux séances par semaine : une lourde, une en volume avec la variante adaptée.",
      weak: [
        { v: 'bas', n: 'En bas (sortie du trou)', variant: 'pause_squat', f: 0.85, acc: ['bulgarian', 'leg_press', 'copenhagen'], tip: "La pause supprime le rebond et renforce la position la plus difficile." },
        { v: 'buste', n: 'Le buste plonge vers l\'avant', variant: 'front_squat', f: 0.8, acc: ['leg_press', 'leg_ext', 'chest_row'], tip: "Souvent des quadriceps en retard : le squat avant les oblige à travailler, buste droit." },
        { v: 'genoux', n: 'Les genoux rentrent', variant: 'pause_squat', f: 0.85, acc: ['copenhagen', 'bulgarian', 'abduction'], tip: "Adducteurs et fessiers forts stabilisent les genoux ; travaille aussi la technique à vide." },
        { v: 'nsp', n: 'Je ne sais pas', variant: 'pause_squat', f: 0.85, acc: ['bulgarian', 'rdl', 'leg_press'], tip: "Plan équilibré : quadriceps, chaîne postérieure et unilatéral." },
      ],
      principles: ['Profondeur constante (au moins la parallèle) sur toutes les séries.', 'Gainage : inspire, bloque, pousse le ventre contre la ceinture abdominale.', 'Unilatéral en accessoire pour corriger les déséquilibres (Mike Boyle).'],
    },
    deadlift: {
      n: 'Soulevé de terre', ex: 'deadlift', kind: 'barbell', icon: 'dumbbell',
      intro: "Le soulevé de terre sollicite toute la chaîne postérieure, le dos et la prise. Un jour lourd par semaine suffit souvent ; le deuxième jour utilise une variante moins fatigante.",
      weak: [
        { v: 'sol', n: 'Au décollage du sol', variant: 'deficit_dl', f: 0.8, acc: ['front_squat', 'row_bar', 'leg_press'], tip: "Le déficit allonge la phase difficile ; les quadriceps aident au décollage." },
        { v: 'genoux', n: 'Au passage des genoux', variant: 'rdl', f: 0.75, acc: ['good_morning', 'row_bar', 'seated_curl'], tip: "Chaîne postérieure et dos : RDL et good morning." },
        { v: 'haut', n: 'Au verrouillage', variant: 'block_pull', f: 0.95, acc: ['hip_thrust', 'shrug_bar', 'back_ext'], tip: "Surcharge la fin du mouvement et renforce les fessiers." },
        { v: 'prise', n: 'La barre glisse des mains', variant: 'rdl', f: 0.75, acc: ['farmer', 'dead_hang', 'shrug_db'], tip: "Portés lourds et suspension ; essaie la prise alternée ou la prise crochet." },
        { v: 'nsp', n: 'Je ne sais pas', variant: 'rdl', f: 0.75, acc: ['row_bar', 'hip_thrust', 'farmer'], tip: "Plan équilibré : dos, fessiers et prise." },
      ],
      principles: ['Technique avant tout : dos neutre, barre au contact des jambes.', 'Peu de reps par série (le dos fatigue vite) et beaucoup de qualité.', 'Variante légère le 2ᵉ jour pour limiter la fatigue (Sheiko, Wendler).'],
    },
    ohp: {
      n: 'Développé militaire', ex: 'ohp', kind: 'barbell', icon: 'dumbbell',
      intro: "Le développé militaire dépend des épaules, des triceps et d'un gainage complet. Deux séances par semaine sur le mouvement.",
      weak: [
        { v: 'bas', n: 'Au départ (sous le menton)', variant: 'ohp', f: 0.85, acc: ['db_press', 'pike_pushup', 'lat_raise'], tip: "Les épaules avant décident du départ : haltères et pompes piquées." },
        { v: 'haut', n: 'Au verrouillage', variant: 'ohp', f: 0.85, acc: ['oh_ext_db', 'dips', 'lat_raise'], tip: "Triceps et deltoïdes latéraux pour finir le mouvement." },
        { v: 'gainage', n: 'Je me cambre / perds l\'équilibre', variant: 'ohp', f: 0.85, acc: ['kb_press', 'pallof', 'plank'], tip: "Le tronc transmet la force : travail unilatéral et anti-rotation." },
        { v: 'nsp', n: 'Je ne sais pas', variant: 'ohp', f: 0.85, acc: ['db_press', 'oh_ext_cable', 'face_pull'], tip: "Plan équilibré : épaules, triceps et arrière d'épaules." },
      ],
      principles: ['Fessiers serrés et côtes basses à chaque rep.', 'Progression lente : +1 à 2,5 kg suffit sur ce mouvement.', 'Arrière d\'épaules et haut du dos pour la santé de l\'épaule.'],
    },
    pullups: { n: 'Tractions', ex: 'pullup', kind: 'pullups', icon: 'body', intro: "Les tractions dépendent du rapport force/poids, des dorsaux, des biceps et de la prise. Méthodes : Grease the Groove (Pavel Tsatsouline) et programme Armstrong (US Marine Corps), puis lest." },
    pushups: { n: 'Pompes', ex: 'pushup', kind: 'pushups', icon: 'body', intro: "Les pompes demandent pecs, triceps, épaules et un gainage solide. Volume fréquent et sous-maximal, progression régulière : l'approche des préparations militaires." },
    run: { n: 'Course 5 / 10 km', ex: null, kind: 'run', icon: 'run', intro: "Plan polarisé : une séance de VMA, une au seuil et une longue en zone 2 chaque semaine. Allures calculées à partir de ton chrono actuel (Seiler, Billat, Daniels)." },
    leger: { n: 'Test Luc Léger', ex: null, kind: 'leger', icon: 'run', intro: "Le Luc Léger mesure ta capacité aérobie en navettes de 20 m. Plan : VMA courte (30/30), navettes spécifiques aux demi-tours et footings en zone 2." },
    core: { n: 'Gainage', ex: 'plank', kind: 'core', icon: 'shield', intro: "Plutôt que des planches interminables, Stuart McGill recommande des maintiens courts et répétés (10 s) et le Big 3 : curl-up, planche latérale, bird dog." },
  };

  // Paramètres demandés à l'utilisateur pour chaque type de plan
  const INPUTS = {
    barbell: [{ id: 'orm', n: 'Ton 1RM actuel (kg)', type: 'number', step: 2.5, hint: 'Ou estime-le : charge × (1 + reps / 30) sur une série récente de 3 à 8 reps.' }],
    pullups: [{ id: 'max', n: 'Tractions strictes maximum (en une série)', type: 'number', step: 1 }],
    pushups: [{ id: 'max', n: 'Pompes maximum (en une série)', type: 'number', step: 1 }],
    run: [{ id: 'dist', n: 'Distance visée', type: 'select', opts: [['5', '5 km'], ['10', '10 km']] }, { id: 'time', n: 'Ton chrono actuel (mm:ss)', type: 'text', placeholder: '25:00' }],
    leger: [{ id: 'palier', n: 'Ton dernier palier atteint', type: 'number', step: 0.5 }],
    core: [{ id: 'max', n: 'Planche maximum (secondes)', type: 'number', step: 5 }],
  };

  const parseTime = s => { const p = String(s || '').split(':').map(Number); if (p.some(isNaN)) return 0; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60; };
  const runWarm = [{ n: 'Footing progressif', d: '12-15 min très facile' }, { n: 'Gammes', d: 'Montées de genoux, talons-fesses, pas chassés, 3 accélérations progressives' }];
  const runCool = [{ n: 'Retour au calme', d: '5-10 min de footing très lent puis marche' }];
  const runS = (title, items, extra) => S(title, [B('cardio', 'Course', items)], Object.assign({ goal: 'endurance', warmup: runWarm, cooldown: runCool, warmupSec: 900, cooldownSec: 420 }, extra));
  const iv = (name, work, rest, rounds, intensity, extra) => Object.assign({ type: 'cardio', id: 'iv', name, protocol: 'interval', work: Math.round(work), rest: Math.round(rest), rounds, intensity, hard: true, mod: 'course' }, extra);
  const steady = (name, min, intensity, extra) => Object.assign({ type: 'cardio', id: 'st', name, protocol: 'steady', duration: Math.round(min * 60), intensity, hard: false, mod: 'course' }, extra);

  function barbellPlan(T, inp) {
    const orm = Number(inp.orm) || 0;
    const W = T.weak.find(w => w.v === inp.weak) || T.weak[T.weak.length - 1];
    const kg = p => (orm ? A.round25(orm * p) : null);
    const balance = { bench: ['row_bar', 'pullup'], squat: ['rdl', 'seated_curl'], deadlift: ['front_squat', 'lat_pulldown'], ohp: ['pullup', 'chest_row'] }[T.ex] || [];
    const weeks = BAR_WEEKS.map((wk, wi) => {
      const sessions = [];
      if (wk.h === 'test') {
        sessions.push(S(`S${wi + 1} · Ouverture`, [B('force', T.n, [I(T.ex, 3, '2', 180, { pct: 0.8, rir: '3', note: 'Séance légère et rapide pour arriver frais au test.' })]), B('hyper', 'Accessoire léger', [I(W.acc[0], 2, '8-10', 90, { rir: '3' })])], { goal: 'force' }));
        const pcts = [0.85, 0.92, 0.97, 1.02];
        sessions.push(S(`S${wi + 1} · Test 1RM`, [B('force', 'Test', [I(T.ex, 4, '1', 240, { setW: pcts.map(kg), load: 'Singles : 85 %, 92 %, 97 %, puis tentative à ~102 %', note: 'Après les séries de montée (50 % × 5, 70 % × 3). Si la 3ᵉ passe vite, tente plus lourd ; sinon garde 97 %.' })])], { goal: 'force' }));
        return { n: `Semaine ${wi + 1}`, note: wk.note, sessions };
      }
      const [hs, hr, hp] = wk.h, [vs, vr, vp] = wk.v;
      const deload = wi === 3;
      sessions.push(S(`S${wi + 1} · Jour lourd`, [
        B('force', T.n, [I(T.ex, hs, String(hr), 210, { pct: hp, rir: deload ? '3-4' : '1-2', load: `${Math.round(hp * 100)} % du 1RM${kg(hp) ? ' · ' + ui.num(kg(hp), 1) + ' kg' : ''}` })]),
        B('hyper', 'Accessoires ciblés', W.acc.slice(0, 2).map(id => I(id, deload ? 2 : 3, '6-10', 120, { rir: deload ? '3' : '1-2' }))),
      ], { goal: 'force', planNote: wk.note }));
      const variant = W.variant;
      const vItem = A.exById(variant).eq.includes('barre') && orm
        ? I(variant, vs, String(vr), 180, { pct: vp * W.f, rir: '2-3', load: `${Math.round(vp * W.f * 100)} % du 1RM de ${T.n.toLowerCase()}` })
        : I(variant, vs, String(vr + 2), 150, { rir: '2' });
      sessions.push(S(`S${wi + 1} · Jour volume`, [
        B('force', 'Variante ciblée', [vItem]),
        B('hyper', 'Accessoires', [I(W.acc[2], deload ? 2 : 3, '8-12', 90, { rir: '1-2' }), ...balance.map(id => I(id, deload ? 2 : 3, '8-12', 120, { rir: '1-2' }))]),
      ], { goal: 'force_hyper', planNote: wk.note }));
      return { n: `Semaine ${wi + 1}`, note: wk.note, sessions };
    });
    const lo = A.round25(orm * 1.025), hi = Math.max(lo + 2.5, A.round25(orm * 1.05));
    return {
      weeks, tip: W.tip,
      summary: orm ? `Base : 1RM de ${ui.num(orm, 1)} kg. Objectif réaliste en 6 semaines : +2 à +5 % (${ui.num(lo, 1)} à ${ui.num(hi, 1)} kg), davantage si tu débutes.` : 'Renseigne ton 1RM pour que les charges soient calculées en kilos.',
    };
  }

  function pullupPlan(inp) {
    const M = Math.max(0, Math.round(Number(inp.max) || 0));
    const weeks = [];
    let summary, extra = [];
    for (let w = 1; w <= 6; w++) {
      const dl = w === 4, test = w === 6;
      const sessions = [];
      if (M === 0) {
        summary = "Phase fondations : tractions négatives, suspension active et rowing inversé jusqu'à ta première traction stricte.";
        const reps = Math.min(5, 2 + Math.ceil(w / 2));
        sessions.push(S(`S${w} · Négatives`, [B('hyper', 'Tractions', [I('pullup_neg', dl ? 3 : 4 + (w > 2 ? 1 : 0), `${reps}`, 120, { note: 'Descente de 5 s minimum.' }), I('scap_pull', 3, '8', 60), I('inverted_row', 3, '8-12', 90, { rir: '2' }), I('curl_hammer', 2, '10-12', 60)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Assistées`, [B('hyper', 'Tractions', [test ? I('pullup', 3, 'max', 180, { note: 'Test : ta première traction stricte ?' }) : I('pullup_band', 4, '5-8', 120, { rir: '2' }), I('dead_hang', 3, 20 + w * 5, 60), I('row_db', 3, '8-12', 90, { rir: '1-2' })])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Négatives + gainage`, [B('hyper', 'Tractions', [I('pullup_neg', 3, `${reps}`, 120), I('hollow', 3, 20 + w * 3, 60), I('lat_pulldown', 3, '8-12', 90, { rir: '1-2' })])], { goal: 'hypertrophie' }));
      } else if (M <= 4) {
        const gtg = Math.max(1, Math.floor(M / 2));
        summary = `Grease the Groove : ${gtg} traction${gtg > 1 ? 's' : ''} 5 à 8 fois par jour, 5 jours sur 7, jamais à l'échec. Plus 2 séances par semaine.`;
        const ladderTop = Math.max(2, Math.min(5, M + (w > 4 ? 1 : 0)));
        sessions.push(S(`S${w} · Échelles`, [B('hyper', 'Tractions', [I('pullup', dl ? 3 : 3 + Math.floor(w / 2), `1→${ladderTop} (échelle)`, 90, { note: `Fais 1, repos, 2, repos… jusqu'à ${ladderTop}, puis recommence. Une échelle = une série.` }), I('pullup_neg', 3, '3', 120), I('inverted_row', 3, '10-12', 90)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Volume`, [B('hyper', 'Tractions', [test ? I('pullup', 1, 'max', 180, { note: 'Test : série maximale stricte.' }) : I('pullup', dl ? 4 : 6, String(Math.max(1, M - 1)), 120, { rir: '2' }), I('chinup', 3, String(Math.max(1, M - 1)), 120), I('curl_incline', 2, '10-12', 60)])], { goal: 'hypertrophie' }));
        extra = [{ n: 'Grease the Groove (chaque jour)', d: `${gtg} rep${gtg > 1 ? 's' : ''} parfaite${gtg > 1 ? 's' : ''}, 5-8 fois dans la journée, au moins 15 min d'écart.` }];
      } else if (M <= 11) {
        const T = Math.max(2, Math.round(M * 0.55)) + (dl ? 0 : Math.floor((w - 1) / 2));
        summary = `Programme inspiré d'Armstrong (USMC) : 5 jours par semaine, séries d'entraînement de ${T} reps qui augmentent toutes les 2 semaines.`;
        sessions.push(S(`S${w} · J1 Séries max`, [B('hyper', 'Tractions', [I('pullup', 5, 'max', 90, { note: '5 séries au maximum de reps strictes, 90 s de repos.' })])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · J2 Pyramide`, [B('hyper', 'Tractions', [I('pullup', 8, '1, 2, 3… (pyramide)', 10, { note: '1 rep, 10 s par rep de repos, 2 reps, etc. jusqu\'à l\'échec ; puis une dernière série max.' })])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · J3 Prises variées`, [B('hyper', 'Tractions', [I('pullup', 3, String(T), 60, { note: 'Prise pronation serrée.' }), I('chinup', 3, String(T), 60, { note: 'Prise supination.' }), I('pullup', 3, String(T), 60, { note: 'Prise large.' })])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · J4 Séries d'entraînement`, [B('hyper', 'Tractions', [I('pullup', dl ? 6 : 9, String(T), 60, { note: `Autant de séries de ${T} que possible avec 60 s de repos (vise 9).` })])], { goal: 'hypertrophie' }));
        if (!dl) sessions.push(S(`S${w} · J5 ${test ? 'Test' : 'Jour le plus dur'}`, [B('hyper', 'Tractions', [test ? I('pullup', 1, 'max', 180, { note: 'Test : série maximale stricte.' }) : I('pullup', 5, 'max', 90, { note: 'Refais la séance qui t\'a semblé la plus dure cette semaine.' })])], { goal: 'hypertrophie' }));
        extra = [{ n: 'Chaque matin (Armstrong)', d: '3 séries max de pompes, repos libre : prépare les épaules et le volume global.' }];
      } else {
        summary = 'Tractions lestées : un jour lourd, un jour volume, un jour accessoires. Ajoute 1-2 kg par semaine quand toutes les reps passent.';
        sessions.push(S(`S${w} · Lourd`, [B('force', 'Tractions lestées', [I('pullup', dl ? 3 : 5, '3-5', 180, { rir: '2', load: `Lest de départ : la charge pour ~6 reps max, +1-2 kg / sem${dl ? ' (−20 % en décharge)' : ''}` })]), B('hyper', 'Complément', [I('row_bar', 3, '6-8', 120), I('curl_incline', 3, '8-12', 90)])], { goal: 'force' }));
        sessions.push(S(`S${w} · Volume`, [B('hyper', 'Tractions', [test ? I('pullup', 1, 'max', 180, { note: 'Test : série maximale au poids du corps.' }) : I('pullup', dl ? 4 : 6, String(Math.round(M * 0.6)), 90, { rir: '2-3' }), I('chinup', 3, String(Math.round(M * 0.5)), 90), I('cable_pullover', 3, '12-15', 60)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Prise et dos`, [B('hyper', 'Accessoires', [I('dead_hang', 3, 45, 60), I('face_pull', 3, '15-20', 60), I('hanging_leg_raise', 3, '10-12', 60)])], { goal: 'hypertrophie' }));
      }
      weeks.push({ n: `Semaine ${w}`, note: dl ? 'Décharge : un peu moins de volume.' : test ? 'Test en fin de semaine.' : '', sessions });
    }
    return { weeks, summary, daily: extra, tip: 'Tractions strictes : bras tendus en bas, menton au-dessus de la barre, aucun balancement.' };
  }

  function pushupPlan(inp) {
    const M = Math.max(0, Math.round(Number(inp.max) || 0));
    const weeks = [];
    let summary;
    for (let w = 1; w <= 6; w++) {
      const dl = w === 4, test = w === 6;
      const sessions = [];
      if (M < 8) {
        summary = 'Fondations : pompes inclinées dont tu baisses la hauteur chaque semaine, négatives et gainage.';
        const A1 = S(`S${w} · Force`, [B('hyper', 'Pompes', [I('pushup_incline', dl ? 3 : 4, '8-12', 90, { rir: '2', note: 'Baisse la hauteur des mains quand 12 reps passent.' }), I('pushup', 3, test ? 'max' : '3', 120, { note: test ? 'Test : série maximale.' : 'Négatives : descente de 3-4 s, remonte à genoux si besoin.' }), I('plank', 3, 25 + w * 5, 60)])], { goal: 'hypertrophie' });
        sessions.push(A1, S(`S${w} · Volume`, [B('hyper', 'Pompes', [I('pushup_incline', 5, '6-10', 60, { rir: '2-3' }), I('dead_bug', 3, '8', 45), I('bench_dips', 2, '6-10', 60)])], { goal: 'hypertrophie' }));
      } else if (M < 30) {
        const vol = Math.round(M * 0.6) + (dl ? 0 : w - 1);
        summary = `Volume sous-maximal : séries de ${Math.round(M * 0.6)} reps qui augmentent de 1 chaque semaine, échelles et séries max. Ajoute des pompes « Grease the Groove » dans la journée si tu veux accélérer.`;
        sessions.push(S(`S${w} · Volume`, [B('hyper', 'Pompes', [I('pushup', dl ? 3 : 5, String(vol), 90, { rir: '2-3' }), I('plank', 3, 40, 60)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Échelles`, [B('hyper', 'Pompes', [I('pushup', dl ? 3 : 4, `2→${Math.max(6, Math.round(M * 0.4))} (échelle, +2)`, 60, { note: '2, 4, 6… jusqu\'au sommet, 15-30 s entre les marches. Une échelle = une série.' }), I('pike_pushup', 3, '6-10', 90)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Série max`, [B('hyper', 'Pompes', [I('pushup', 1, 'max', 180, { note: test ? 'Test officiel de fin de plan.' : 'Une série maximale, notée pour suivre ta progression.' }), I('pushup', dl ? 2 : 3, String(Math.round(M * 0.5)), 90, { note: 'Séries de retour.' }), I('diamond', 2, '8-12', 60)])], { goal: 'hypertrophie' }));
      } else {
        summary = 'Niveau avancé : surcharge (déficit, lest, tempo) et densité (100 pompes le plus vite possible).';
        sessions.push(S(`S${w} · Surcharge`, [B('hyper', 'Pompes', [I('pushup_deficit', dl ? 3 : 5, '8-12', 90, { rir: '1-2', note: 'Ajoute un sac lesté quand 12 reps passent.' }), I('dips', 3, '8-12', 120)])], { goal: 'hypertrophie' }));
        sessions.push(S(`S${w} · Densité`, [B('hyper', 'Pompes', [I('pushup', 6, String(Math.round(M * 0.45)), 45, { note: 'Objectif : 100 reps (ou 3 × ton max) le plus vite possible, note ton temps.' })])], { goal: 'endurance' }));
        sessions.push(S(`S${w} · Tempo et test`, [B('hyper', 'Pompes', [test ? I('pushup', 1, 'max', 180, { note: 'Test officiel.' }) : I('pushup', 4, String(Math.max(5, Math.round(M * 0.35))), 90, { note: 'Tempo 3 s de descente, 1 s de pause en bas.' }), I('plank', 3, 60, 60)])], { goal: 'hypertrophie' }));
      }
      weeks.push({ n: `Semaine ${w}`, note: dl ? 'Décharge.' : test ? 'Test en fin de semaine.' : '', sessions });
    }
    return { weeks, summary, tip: 'Pompe stricte : corps aligné, poitrine au sol, bras tendus en haut.' };
  }

  function runPlan(inp) {
    const dist = Number(inp.dist) || 5;
    const sec = parseTime(inp.time);
    if (!sec) return { error: 'Indique ton chrono au format mm:ss (ex. 25:00).' };
    const speed = dist / (sec / 3600);
    const vma = speed / (dist === 5 ? 0.93 : 0.88);
    const at = p => ui.pace(vma * p);
    const t1000 = p => 1000 / (vma * p / 3.6);
    const m30 = p => Math.round(vma * p / 3.6 * 30);
    const ten = dist === 10;
    const W = [
      () => [iv('30/30 · 2 × 8', 30, 30, 8, `30 s à ${at(1.0)} (≈ ${m30(1.0)} m), 30 s de trot`, { series: 2, seriesRest: 180 }), iv('Seuil 2 × 10 min', 600, 120, 2, `${at(0.85)}, 2 min trot`, { hard: false }), steady('Endurance fondamentale', ten ? 50 : 40, `Zone 2 · ${at(0.68)}`)],
      () => [iv('30/30 · 2 × 10', 30, 30, 10, `30 s à ${at(1.0)} (≈ ${m30(1.0)} m)`, { series: 2, seriesRest: 180 }), iv('Seuil 3 × 8 min', 480, 120, 3, at(0.85), { hard: false }), steady('Endurance fondamentale', ten ? 55 : 45, `Zone 2 · ${at(0.68)}`)],
      () => [iv(`${ten ? 6 : 5} × 1000 m`, t1000(ten ? 0.92 : 0.95), 120, ten ? 6 : 5, `1000 m en ${ui.fmtClock(t1000(ten ? 0.92 : 0.95))} (${at(ten ? 0.92 : 0.95)}), 2 min trot`), iv('Seuil 2 × 12 min', 720, 150, 2, at(0.86), { hard: false }), steady('Sortie longue', ten ? 65 : 50, `Zone 2 · ${at(0.66)}`)],
      () => [iv('30/30 · 1 × 10', 30, 30, 10, `30 s à ${at(1.0)}`), steady('Seuil continu 15 min', 15, at(0.85), { hard: false }), steady('Endurance fondamentale', 35, `Zone 2 · ${at(0.66)}`)],
      () => [iv(`${ten ? 5 : 6} × 800 m`, 800 / (vma * (ten ? 0.94 : 0.97) / 3.6), 90, ten ? 5 : 6, `800 m en ${ui.fmtClock(800 / (vma * (ten ? 0.94 : 0.97) / 3.6))}, 90 s trot`), iv('Seuil 3 × 10 min', 600, 120, 3, at(0.86), { hard: false }), steady('Sortie longue', ten ? 70 : 55, `Zone 2 · ${at(0.66)}`)],
      () => [iv('Rappel 30/30 × 8', 30, 30, 8, `30 s à ${at(1.0)}`), steady('Footing très facile', 25, `${at(0.62)}`), steady(`Course test ${dist} km`, (sec / 60) * 0.97, `Objectif : ${ui.fmtClock(sec * 0.97)} (${ui.pace(speed / 0.97)})`, { hard: true, note: 'Pars régulier, accélère sur le dernier kilomètre.' })],
    ];
    const names = [['VMA', 'Seuil', 'Endurance'], ['VMA', 'Seuil', 'Endurance'], ['VMA longue', 'Seuil', 'Sortie longue'], ['VMA (allégé)', 'Seuil (allégé)', 'Endurance'], ['VMA longue', 'Seuil', 'Sortie longue'], ['Rappel', 'Footing', 'Test']];
    const weeks = W.map((f, i) => ({ n: `Semaine ${i + 1}`, note: i === 3 ? 'Semaine allégée.' : i === 5 ? 'Affûtage et test.' : '', sessions: f().map((it, j) => runS(`S${i + 1} · ${names[i][j]}`, [it])) }));
    return { weeks, summary: `VMA estimée : ${ui.num(vma, 1)} km/h. Allures : zone 2 ${at(0.68)} · seuil ${at(0.85)} · VMA ${at(1.0)}. Objectif : ${ui.fmtClock(sec * 0.97)} sur ${dist} km.`, tip: '80 % du temps à allure facile : résiste à l\'envie d\'accélérer les footings (Seiler).' };
  }

  function legerPlan(inp) {
    const pal = Math.max(1, Number(inp.palier) || 6);
    const vma = 8 + 0.5 * pal;
    const target = pal + 2;
    const vt = 8 + 0.5 * target;
    const shuttle = v => ui.num(20 / (v / 3.6), 1);
    const m30 = p => Math.round(vma * p / 3.6 * 30);
    const weeks = [];
    for (let w = 1; w <= 6; w++) {
      const dl = w === 4, test = w === 6;
      const reps = dl ? 8 : Math.min(12, 7 + w);
      const sessions = [
        runS(`S${w} · VMA courte`, [iv(`30/30 · 2 × ${reps}`, 30, 30, reps, `30 s ≈ ${m30(1.02)} m (${ui.pace(vma * 1.02)}), 30 s marche/trot`, { series: 2, seriesRest: 180 })]),
        runS(`S${w} · Navettes spécifiques`, [iv(`${dl ? 5 : 6 + Math.min(w, 4)} × 1 min de navettes`, 60, 60, dl ? 5 : 6 + Math.min(w, 4), `Allers de 20 m en ${shuttle(vt)} s (vitesse du palier ${target}), demi-tours rapides`, { note: 'Pose deux plots à 20 m. Travaille les appuis : pivot sur le pied extérieur, regard déjà tourné.' })]),
        test ? runS(`S${w} · Test Luc Léger`, [steady('Test Luc Léger', Math.max(6, target + 1), `Objectif : palier ${target} ou plus`, { hard: true, note: 'Utilise une bande sonore officielle du test.' })]) : runS(`S${w} · Footing`, [steady('Footing zone 2', dl ? 30 : 35 + w * 2, `Zone 2 · ${ui.pace(vma * 0.65)}`)]),
      ];
      weeks.push({ n: `Semaine ${w}`, note: dl ? 'Semaine allégée.' : test ? 'Test en fin de semaine.' : '', sessions });
    }
    return { weeks, summary: `Palier actuel ${pal} (≈ ${ui.num(vma, 1)} km/h). Objectif réaliste en 6 semaines : palier ${target}.`, tip: 'Sur le test, reste au plus près du bip : partir trop vite coûte cher dans les derniers paliers.' };
  }

  function corePlan(inp) {
    const M = Math.max(10, Number(inp.max) || 45);
    const weeks = [];
    for (let w = 1; w <= 6; w++) {
      const dl = w === 4, test = w === 3 || w === 6;
      const pyr = w <= 2 ? [6, 4, 2] : w === 4 ? [4, 2, 1] : [8, 6, 4];
      const hold = Math.round(M * (0.5 + 0.05 * (dl ? 0 : w)));
      weeks.push({ n: `Semaine ${w}`, note: dl ? 'Décharge.' : test ? 'Test de planche en fin de semaine.' : '', sessions: [
        S(`S${w} · Big 3 de McGill`, [B('hyper', 'Big 3', [I('mcgill_curlup', 3, `${pyr.join('/')} × 10 s`, 45, { setReps: pyr }), I('side_plank', 3, 10, 30, { note: `Pyramide ${pyr.join('/')} maintiens de 10 s par côté` }), I('bird_dog', 3, `${pyr.join('/')} × 10 s`, 45, { setReps: pyr })])], { goal: 'endurance' }),
        S(`S${w} · Gainage force`, [B('hyper', 'Gainage', [I('plank', dl ? 3 : 5, 12, 45, { note: 'Planche « RKC » : contracte tout au maximum (fessiers, abdos, cuisses), 10-15 s.' }), I('dead_bug', 3, '8', 45), I('hollow', 3, 20 + w * 3, 60), I('pallof_band', 3, '10', 45)])], { goal: 'hypertrophie' }),
        S(`S${w} · ${test ? 'Test' : 'Endurance du tronc'}`, [B('hyper', 'Gainage', [test ? I('plank', 1, M + 30, 120, { note: 'Test : tiens le plus longtemps possible en forme parfaite, note ton temps.' }) : I('plank', 3, hold, 60), I('side_plank', 3, Math.round(hold * 0.6), 45), I('suitcase', 3, 30, 60)])], { goal: 'endurance' }),
      ] });
    }
    return { weeks, summary: `Planche actuelle : ${M} s. Le plan alterne Big 3 (McGill), contractions maximales courtes et endurance.`, tip: 'La qualité prime : arrête la série dès que le bas du dos se creuse.' };
  }

  function buildPlan(id, inp) {
    const T = IMPROVE[id];
    if (!T) return null;
    let plan;
    if (T.kind === 'barbell') plan = barbellPlan(T, inp);
    else if (T.kind === 'pullups') plan = pullupPlan(inp);
    else if (T.kind === 'pushups') plan = pushupPlan(inp);
    else if (T.kind === 'run') plan = runPlan(inp);
    else if (T.kind === 'leger') plan = legerPlan(inp);
    else plan = corePlan(inp);
    if (plan.weeks) plan.weeks.forEach((wk, wi) => wk.sessions.forEach((s, si) => { s.source = 'plan'; s.planRef = { id, w: wi, s: si }; }));
    return plan;
  }

  A.DATA = Object.assign(A.DATA || {}, { TEMPLATES, IMPROVE, INPUTS });
  A.plans = { build: buildPlan, parseTime };
})(window.A);
