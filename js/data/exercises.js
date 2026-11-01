/* Athlos — muscles, matériel et base d'exercices */
(function (A) {
  'use strict';

  // g : région · big : grand groupe musculaire · tip : conseil quand c'est un point faible
  const MUSCLES = {
    trapezes: { n: 'Trapèzes', g: 'haut', tip: "Shrugs lourds, portés de charges (fermier) et soulevés de terre : les trapèzes adorent les charges lourdes tenues longtemps." },
    epaules: { n: 'Épaules', g: 'haut', big: true, tip: "Les deltoïdes latéraux font la largeur : élévations latérales fréquentes (2-4×/sem), 10-20 reps, idéalement à la poulie pour garder la tension en bas." },
    arriere_epaules: { n: "Arrière d'épaules", g: 'haut', tip: "Face pulls et oiseau en 12-20 reps : meilleure posture et épaules plus solides, à placer en début de séance s'ils sont en retard." },
    pectoraux: { n: 'Pectoraux', g: 'haut', big: true, tip: "Amplitude profonde (haltères, écartés à la poulie) et banc incliné à ~30° pour le haut des pecs." },
    haut_dos: { n: 'Haut du dos', g: 'haut', big: true, tip: "Rowings variés, coudes à ~45° du buste, 1 s de pause omoplates serrées. Un haut du dos fort stabilise aussi le développé couché et le squat." },
    dorsaux: { n: 'Dorsaux', g: 'haut', big: true, tip: "Tractions et tirages en partant bras bien tendus (étirement), coudes vers les hanches. Le pullover poulie isole le grand dorsal." },
    biceps: { n: 'Biceps', g: 'bras', tip: "Curl incliné et pupitre pour charger le biceps étiré ; tractions supination en complément." },
    triceps: { n: 'Triceps', g: 'bras', tip: "Le long chef (2/3 du volume du bras) grossit nettement plus avec les extensions bras au-dessus de la tête (Maeo et al. 2023)." },
    avant_bras: { n: 'Avant-bras', g: 'bras', tip: "Portés lourds, suspension à la barre et curl inversé ; la prise progresse vite avec de la fréquence." },
    abdos: { n: 'Abdominaux', g: 'core', tip: "Les abdos se renforcent comme les autres muscles : progression de charge (crunch poulie, relevés de jambes), pas des centaines de reps." },
    obliques: { n: 'Obliques', g: 'core', tip: "Travaille l'anti-rotation (Pallof) et les portés unilatéraux, plus fonctionnels et protecteurs pour le dos que les rotations répétées." },
    lombaires: { n: 'Lombaires', g: 'core', tip: "Charnière de hanche (RDL, good morning) et endurance du tronc (Big 3 de McGill) plutôt que des flexions répétées de la colonne." },
    fessiers: { n: 'Fessiers', g: 'bas', big: true, tip: "Squat bulgare et fentes profondes (étirement), hip thrust pour la contraction maximale." },
    quadriceps: { n: 'Quadriceps', g: 'bas', big: true, tip: "Squat complet, presse, squat bulgare ; le leg extension complète pour le droit fémoral." },
    ischios: { n: 'Ischio-jambiers', g: 'bas', big: true, tip: "Combine flexion du genou (leg curl assis, nordic) et extension de hanche (RDL). Le leg curl assis donne plus d'hypertrophie que couché (Maeo et al. 2021)." },
    adducteurs: { n: 'Adducteurs', g: 'bas', tip: "Planche Copenhague : renforcement et prévention des blessures à l'aine (Harøy et al. 2019)." },
    mollets: { n: 'Mollets', g: 'bas', tip: "Fréquence élevée (2-4×/sem), pause de 2 s talon bas en étirement, 8-20 reps proches de l'échec. L'amplitude en position étirée donne plus de résultats (Kassiano et al. 2023)." },
  };

  const PRESETS = [
    { id: 'full', n: 'Full body', m: ['pectoraux', 'dorsaux', 'haut_dos', 'epaules', 'quadriceps', 'ischios', 'fessiers', 'abdos'] },
    { id: 'haut', n: 'Haut du corps', m: ['pectoraux', 'dorsaux', 'haut_dos', 'epaules', 'arriere_epaules', 'biceps', 'triceps'] },
    { id: 'bas', n: 'Bas du corps', m: ['quadriceps', 'ischios', 'fessiers', 'adducteurs', 'mollets'] },
    { id: 'push', n: 'Push', m: ['pectoraux', 'epaules', 'triceps'] },
    { id: 'pull', n: 'Pull', m: ['dorsaux', 'haut_dos', 'arriere_epaules', 'biceps', 'avant_bras'] },
    { id: 'bras', n: 'Bras', m: ['biceps', 'triceps', 'avant_bras'] },
    { id: 'core', n: 'Gainage / abdos', m: ['abdos', 'obliques', 'lombaires'] },
  ];

  const EQUIP = {
    barre: 'Barre & rack', halteres: 'Haltères', banc: 'Banc incliné', machine: 'Machines',
    poulie: 'Poulies', kb: 'Kettlebell', traction: 'Barre de traction', dips: 'Barres à dips',
    elastique: 'Élastiques', gilet: 'Gilet lesté',
  };

  // Ce que j'ai avec moi : la salle donne accès à tout, les autres utilisent mon matériel personnel (profil.gear)
  const SETUPS = [
    { id: 'salle', n: 'Salle complète', icon: 'dumbbell', eq: Object.keys(EQUIP).filter(e => e !== 'gilet') },
    { id: 'street', n: 'Street workout', icon: 'body', eq: ['traction', 'dips'] },
    { id: 'maison', n: 'Maison équipée', icon: 'home', eq: ['traction', 'dips', 'banc', 'halteres', 'elastique'] },
    { id: 'gilet', n: 'Tractions + gilet lesté', icon: 'shield', eq: ['traction', 'gilet'] },
    { id: 'pdc', n: 'Rien (poids du corps)', icon: 'run', eq: [] },
  ];

  // m : muscles principaux · s : secondaires · eq : matériel requis · t : comp|iso|core|carry|pliom|mob
  // p : schéma moteur · heavy : adapté aux charges lourdes · str : accent position étirée
  // bw : poids du corps · hold : exercice tenu (secondes) · uni : unilatéral · lvl : niveau min · pr : priorité
  // ld : charge typique avec haltères / élastique (L légère, M moyenne, H lourde) · vest : se leste avec un gilet
  const EX = [
    // ——— Pectoraux
    { id: 'bench', n: 'Développé couché (barre)', m: ['pectoraux'], s: ['triceps', 'epaules'], eq: ['barre', 'banc'], t: 'comp', p: 'press_h', heavy: 1, pr: 10, cue: "Omoplates serrées et basses, pieds ancrés, barre sur le bas des pecs, coudes à 45-70° du buste." },
    { id: 'bench_pause', n: 'Développé couché avec pause (2 s)', m: ['pectoraux'], s: ['triceps', 'epaules'], eq: ['barre', 'banc'], t: 'comp', p: 'press_h', heavy: 1, lvl: 2, pr: 4, cue: "Arrêt complet de 2 s sur la poitrine sans relâcher la tension, puis pousse explosif. Supprime le rebond, renforce le départ." },
    { id: 'spoto', n: 'Spoto press', m: ['pectoraux'], s: ['triceps'], eq: ['barre', 'banc'], t: 'comp', p: 'press_h', heavy: 1, lvl: 3, pr: 3, cue: "Arrête la barre 2-3 cm au-dessus de la poitrine pendant 1 s, sans toucher, puis pousse. Cible le milieu de trajectoire." },
    { id: 'incline_db', n: 'Développé incliné (haltères)', m: ['pectoraux'], s: ['epaules', 'triceps'], eq: ['halteres', 'banc'], t: 'comp', p: 'press_h', str: 1, pr: 9, cue: "Banc à ~30°. Descends profond, haltères à hauteur de poitrine, étirement contrôlé en bas." },
    { id: 'bench_db', n: 'Développé couché (haltères)', m: ['pectoraux'], s: ['triceps', 'epaules'], eq: ['halteres', 'banc'], t: 'comp', p: 'press_h', str: 1, pr: 8, cue: "Plus d'amplitude qu'à la barre : descends jusqu'à sentir l'étirement des pecs, coudes sous les poignets." },
    { id: 'incline_bar', n: 'Développé incliné (barre)', m: ['pectoraux'], s: ['epaules', 'triceps'], eq: ['barre', 'banc'], t: 'comp', p: 'press_h', heavy: 1, lvl: 2, pr: 7, cue: "Banc à 30-45°, barre sur le haut de la poitrine, omoplates rétractées." },
    { id: 'chest_press', n: 'Chest press (machine)', m: ['pectoraux'], s: ['triceps', 'epaules'], eq: ['machine'], t: 'comp', p: 'press_h', pr: 6, cue: "Règle le siège pour que les poignées soient à mi-poitrine ; idéal pour aller près de l'échec en sécurité." },
    { id: 'dips', n: 'Dips (buste penché)', m: ['pectoraux', 'triceps'], s: ['epaules'], eq: ['dips'], t: 'comp', p: 'dip', bw: 1, heavy: 1, lvl: 2, pr: 7, cue: "Buste légèrement penché, descends jusqu'à ce que les épaules passent sous les coudes, sans douleur." },
    { id: 'pushup', n: 'Pompes', m: ['pectoraux'], s: ['triceps', 'epaules', 'abdos'], eq: [], t: 'comp', p: 'press_h', bw: 1, pr: 6, cue: "Corps gainé comme une planche, mains un peu plus larges que les épaules, poitrine jusqu'au sol." },
    { id: 'pushup_deficit', n: 'Pompes en déficit (mains surélevées)', m: ['pectoraux'], s: ['triceps', 'epaules'], eq: [], t: 'comp', p: 'press_h', bw: 1, str: 1, lvl: 2, pr: 6, cue: "Mains sur deux supports stables (livres, disques) pour descendre plus bas que les mains : plus d'étirement." },
    { id: 'pushup_incline', n: 'Pompes inclinées (mains surélevées)', m: ['pectoraux'], s: ['triceps'], eq: [], t: 'comp', p: 'press_h', bw: 1, pr: 2, cue: "Mains sur un banc ou une table : plus c'est haut, plus c'est facile. Baisse la hauteur chaque semaine." },
    { id: 'cable_fly', n: 'Écarté à la poulie (vis-à-vis)', m: ['pectoraux'], s: [], eq: ['poulie'], t: 'iso', str: 1, pr: 8, cue: "Coudes légèrement fléchis et fixes, ouvre jusqu'à l'étirement, rapproche les mains devant le sternum." },
    { id: 'db_fly', n: 'Écarté couché (haltères)', m: ['pectoraux'], s: [], eq: ['halteres', 'banc'], t: 'iso', str: 1, pr: 6, cue: "Descente lente jusqu'à l'étirement, remonte en serrant les pecs. Charges modérées." },
    { id: 'pec_deck', n: 'Pec deck (butterfly)', m: ['pectoraux'], s: [], eq: ['machine'], t: 'iso', pr: 6, cue: "Épaules basses, amplitude complète, contrôle le retour." },
    { id: 'band_fly', n: 'Écarté (élastique)', m: ['pectoraux'], s: [], eq: ['elastique'], t: 'iso', pr: 2, cue: "Élastique fixé derrière toi, bras légèrement fléchis, rapproche les mains devant toi." },

    // ——— Épaules
    { id: 'ohp', n: 'Développé militaire debout (barre)', m: ['epaules'], s: ['triceps', 'trapezes', 'abdos'], eq: ['barre'], t: 'comp', p: 'press_v', heavy: 1, pr: 10, cue: "Fessiers et abdos serrés, barre au-dessus du milieu du pied, passe la tête sous la barre en haut." },
    { id: 'db_press', n: 'Développé épaules (haltères, assis)', m: ['epaules'], s: ['triceps'], eq: ['halteres', 'banc'], t: 'comp', p: 'press_v', pr: 8, cue: "Dossier presque vertical, descends les haltères à hauteur d'oreilles, pousse sans verrouiller brutalement." },
    { id: 'kb_press', n: 'Développé kettlebell unilatéral', m: ['epaules'], s: ['triceps', 'obliques'], eq: ['kb'], t: 'comp', p: 'press_v', uni: 1, pr: 5, cue: "Kettlebell en position rack, avant-bras vertical, gainage maximal du côté opposé." },
    { id: 'pike_pushup', n: 'Pompes piquées (pike push-ups)', m: ['epaules'], s: ['triceps'], eq: [], t: 'comp', p: 'press_v', bw: 1, lvl: 2, pr: 6, cue: "Hanches hautes en V inversé, la tête descend vers le sol devant les mains. Pieds surélevés pour progresser." },
    { id: 'machine_press', n: 'Développé épaules (machine)', m: ['epaules'], s: ['triceps'], eq: ['machine'], t: 'comp', p: 'press_v', pr: 5, cue: "Poignées à hauteur d'épaules au départ, dos plaqué." },
    { id: 'lat_raise', n: 'Élévations latérales (haltères)', m: ['epaules'], s: ['trapezes'], eq: ['halteres'], t: 'iso', pr: 9, cue: "Buste légèrement penché, monte jusqu'à l'horizontale en menant avec les coudes, descente lente." },
    { id: 'cable_lat_raise', n: 'Élévations latérales à la poulie', m: ['epaules'], s: [], eq: ['poulie'], t: 'iso', str: 1, uni: 1, pr: 8, cue: "Poulie basse, câble derrière le corps : la tension reste présente en bas du mouvement." },
    { id: 'band_lat_raise', n: 'Élévations latérales (élastique)', m: ['epaules'], s: [], eq: ['elastique'], t: 'iso', pr: 3, cue: "Pieds sur l'élastique, monte jusqu'à l'horizontale, contrôle la descente." },

    // ——— Arrière d'épaules
    { id: 'rear_fly', n: 'Oiseau (élévations postérieures)', m: ['arriere_epaules'], s: ['haut_dos'], eq: ['halteres'], t: 'iso', pr: 8, cue: "Buste penché à ~45°, ouvre les bras vers l'extérieur en gardant les omoplates neutres." },
    { id: 'face_pull', n: 'Face pull (poulie)', m: ['arriere_epaules'], s: ['haut_dos', 'trapezes'], eq: ['poulie'], t: 'iso', pr: 9, cue: "Tire la corde vers le front en écartant les mains, finis en rotation externe (position « double biceps »)." },
    { id: 'reverse_pec', n: 'Pec deck inversé', m: ['arriere_epaules'], s: ['haut_dos'], eq: ['machine'], t: 'iso', pr: 8, cue: "Poignées à hauteur d'épaules, bras quasi tendus, ouvre sans hausser les épaules." },
    { id: 'band_pull_apart', n: 'Band pull-apart', m: ['arriere_epaules'], s: ['haut_dos'], eq: ['elastique'], t: 'iso', pr: 6, cue: "Bras tendus devant toi, écarte l'élastique jusqu'à la poitrine, 1 s de pause." },
    { id: 'prone_ytw', n: 'Y-T-W allongé', m: ['arriere_epaules'], s: ['trapezes', 'haut_dos'], eq: [], t: 'iso', bw: 1, pr: 3, cue: "Allongé sur le ventre, lève les bras en Y, puis T, puis W, pouces vers le ciel, 2 s en haut." },

    // ——— Biceps
    { id: 'curl_bar', n: 'Curl barre', m: ['biceps'], s: ['avant_bras'], eq: ['barre'], t: 'iso', pr: 8, cue: "Coudes fixes le long du corps, pas d'élan, descente contrôlée jusqu'en bas." },
    { id: 'curl_incline', n: 'Curl incliné (haltères)', m: ['biceps'], s: [], eq: ['halteres', 'banc'], t: 'iso', str: 1, pr: 9, cue: "Banc à 45-60°, bras pendants derrière le corps : le biceps travaille en position étirée." },
    { id: 'curl_hammer', n: 'Curl marteau', m: ['biceps', 'avant_bras'], s: [], eq: ['halteres'], t: 'iso', pr: 7, cue: "Prise neutre (pouces vers le haut), coudes fixes. Cible le brachial et le brachio-radial." },
    { id: 'curl_preacher', n: 'Curl pupitre', m: ['biceps'], s: [], eq: ['halteres', 'banc'], t: 'iso', str: 1, pr: 7, cue: "Bras en appui sur le pupitre, descends presque bras tendus sans relâcher, pas de rebond." },
    { id: 'curl_cable', n: 'Curl à la poulie basse', m: ['biceps'], s: ['avant_bras'], eq: ['poulie'], t: 'iso', pr: 6, cue: "Tension constante, coudes légèrement en avant, contraction 1 s en haut." },
    { id: 'curl_band', n: 'Curl (élastique)', m: ['biceps'], s: [], eq: ['elastique'], t: 'iso', pr: 3, cue: "Pieds sur l'élastique, coudes fixes, monte et contrôle." },
    { id: 'towel_curl', n: 'Curl à la serviette (auto-résistance)', m: ['biceps'], s: ['avant_bras'], eq: [], t: 'iso', bw: 1, pr: 1, cue: "Serviette sous le pied, tire vers le haut pendant que la jambe résiste : contrôle la résistance pour finir à 1-2 reps de l'échec." },
    { id: 'chinup', n: 'Tractions supination (chin-ups)', m: ['dorsaux', 'biceps'], s: ['haut_dos'], eq: ['traction'], t: 'comp', p: 'pull_v', bw: 1, heavy: 1, lvl: 2, pr: 8, cue: "Paumes vers toi, écartement des épaules, menton au-dessus de la barre, descente complète." },

    // ——— Triceps
    { id: 'oh_ext_cable', n: 'Extension triceps au-dessus de la tête (poulie)', m: ['triceps'], s: [], eq: ['poulie'], t: 'iso', str: 1, pr: 10, cue: "Dos à la poulie, coudes près de la tête, descends les mains derrière la nuque pour étirer le long chef.", sci: "Maeo et al. 2023 : nettement plus d'hypertrophie qu'au pushdown bras le long du corps." },
    { id: 'oh_ext_db', n: 'Extension triceps nuque (haltère)', m: ['triceps'], s: [], eq: ['halteres'], t: 'iso', str: 1, pr: 8, cue: "Haltère tenu à deux mains au-dessus de la tête, coudes pointés vers le haut, descente profonde." },
    { id: 'pushdown', n: 'Extension triceps poulie haute (pushdown)', m: ['triceps'], s: [], eq: ['poulie'], t: 'iso', pr: 7, cue: "Coudes collés au corps, verrouille en bas, contrôle la remontée." },
    { id: 'cgbp', n: 'Développé couché prise serrée', m: ['triceps'], s: ['pectoraux', 'epaules'], eq: ['barre', 'banc'], t: 'comp', p: 'press_h', heavy: 1, lvl: 2, pr: 8, cue: "Mains à la largeur des épaules, coudes près du corps, barre sur le bas du sternum." },
    { id: 'skull', n: 'Barre au front (skull crusher)', m: ['triceps'], s: [], eq: ['barre', 'banc'], t: 'iso', str: 1, pr: 7, cue: "Descends la barre derrière le sommet du crâne, bras légèrement inclinés vers l'arrière." },
    { id: 'diamond', n: 'Pompes mains serrées (diamant)', m: ['triceps'], s: ['pectoraux'], eq: [], t: 'comp', p: 'press_h', bw: 1, pr: 5, cue: "Mains rapprochées sous la poitrine, coudes le long du corps." },
    { id: 'bench_dips', n: 'Dips entre deux bancs / chaise', m: ['triceps'], s: ['pectoraux'], eq: [], t: 'comp', p: 'dip', bw: 1, pr: 3, cue: "Mains derrière toi sur un support stable, descends à 90° de coude sans douleur à l'épaule." },
    { id: 'band_pushdown', n: 'Extension triceps (élastique)', m: ['triceps'], s: [], eq: ['elastique'], t: 'iso', pr: 3, cue: "Élastique fixé en hauteur, coudes collés, verrouille en bas." },

    // ——— Avant-bras
    { id: 'wrist_curl', n: 'Curl poignets (fléchisseurs)', m: ['avant_bras'], s: [], eq: ['halteres'], t: 'iso', pr: 5, cue: "Avant-bras posés sur les cuisses, laisse rouler l'haltère jusqu'au bout des doigts puis enroule." },
    { id: 'reverse_curl', n: 'Curl inversé (prise pronation)', m: ['avant_bras'], s: ['biceps'], eq: ['barre'], t: 'iso', pr: 7, cue: "Paumes vers le bas, coudes fixes : cible les extenseurs et le brachio-radial." },
    { id: 'farmer', n: 'Marche du fermier', m: ['avant_bras', 'trapezes'], s: ['abdos', 'obliques'], eq: ['halteres'], t: 'carry', p: 'carry', hold: 1, pr: 9, cue: "Charges lourdes, épaules basses et en arrière, marche à petits pas rapides, gainage maximal." },
    { id: 'dead_hang', n: 'Suspension à la barre (dead hang)', m: ['avant_bras'], s: ['dorsaux'], eq: ['traction'], t: 'iso', hold: 1, bw: 1, pr: 7, cue: "Prise pleine, épaules légèrement engagées, respire calmement. Excellent pour la prise et les épaules." },

    // ——— Abdominaux
    { id: 'cable_crunch', n: 'Crunch à la poulie haute (à genoux)', m: ['abdos'], s: [], eq: ['poulie'], t: 'core', pr: 8, cue: "Enroule la colonne en rapprochant les côtes du bassin ; les hanches ne bougent pas." },
    { id: 'hanging_leg_raise', n: 'Relevé de jambes suspendu', m: ['abdos'], s: ['avant_bras'], eq: ['traction'], t: 'core', bw: 1, lvl: 2, pr: 8, cue: "Enroule le bassin vers le haut (pas seulement lever les jambes), sans balancer." },
    { id: 'rollout', n: 'Rollout (roulette ou serviette glissée)', m: ['abdos'], s: ['dorsaux'], eq: [], t: 'core', bw: 1, lvl: 2, pr: 7, cue: "À genoux, avance le plus loin possible sans creuser le dos, reviens en gardant le bassin rétroversé." },
    { id: 'plank', n: 'Planche (gainage ventral)', m: ['abdos'], s: ['obliques'], eq: [], t: 'core', hold: 1, bw: 1, pr: 5, cue: "Coudes sous les épaules, serre fessiers et abdos comme pour pousser le sol, ne creuse pas." },
    { id: 'dead_bug', n: 'Dead bug', m: ['abdos'], s: [], eq: [], t: 'core', bw: 1, pr: 6, cue: "Lombaires plaquées au sol, tends bras et jambe opposés lentement en expirant." },
    { id: 'hollow', n: 'Hollow body (position creuse)', m: ['abdos'], s: [], eq: [], t: 'core', hold: 1, bw: 1, lvl: 2, pr: 6, cue: "Bas du dos collé au sol, épaules et jambes décollées, bras derrière la tête." },
    { id: 'mcgill_curlup', n: 'Curl-up de McGill', m: ['abdos'], s: [], eq: [], t: 'core', bw: 1, pr: 5, cue: "Une jambe pliée, mains sous les lombaires, décolle à peine tête et épaules en bloc, tiens 10 s.", sci: "Un des « Big 3 » de Stuart McGill pour un dos solide." },
    { id: 'reverse_crunch', n: 'Crunch inversé', m: ['abdos'], s: [], eq: [], t: 'core', bw: 1, pr: 5, cue: "Allongé, genoux pliés, enroule le bassin vers la poitrine, redescends lentement." },

    // ——— Obliques
    { id: 'side_plank', n: 'Planche latérale', m: ['obliques'], s: ['abdos'], eq: [], t: 'core', hold: 1, bw: 1, uni: 1, pr: 7, cue: "Coude sous l'épaule, corps aligné, hanches hautes.", sci: "Un des « Big 3 » de McGill." },
    { id: 'pallof', n: 'Pallof press (anti-rotation)', m: ['obliques'], s: ['abdos'], eq: ['poulie'], t: 'core', uni: 1, pr: 8, cue: "De profil à la poulie, pousse les mains devant le sternum et résiste à la rotation 2 s." },
    { id: 'pallof_band', n: 'Pallof press (élastique)', m: ['obliques'], s: ['abdos'], eq: ['elastique'], t: 'core', uni: 1, pr: 6, cue: "Élastique fixé à hauteur de poitrine, pousse et résiste à la rotation." },
    { id: 'woodchop', n: 'Bûcheron à la poulie', m: ['obliques'], s: ['abdos'], eq: ['poulie'], t: 'core', uni: 1, pr: 6, cue: "Rotation depuis les hanches et le thorax, bras quasi tendus, contrôle le retour." },
    { id: 'suitcase', n: 'Marche valise (charge d\'un seul côté)', m: ['obliques'], s: ['avant_bras', 'trapezes'], eq: ['halteres'], t: 'carry', p: 'carry', hold: 1, uni: 1, pr: 7, cue: "Une charge lourde d'un seul côté, reste parfaitement droit, ne penche pas." },

    // ——— Trapèzes
    { id: 'shrug_db', n: 'Shrugs (haltères)', m: ['trapezes'], s: ['avant_bras'], eq: ['halteres'], t: 'iso', pr: 7, cue: "Monte les épaules vers les oreilles, 1 s en haut, pas de rotation." },
    { id: 'shrug_bar', n: 'Shrugs (barre)', m: ['trapezes'], s: ['avant_bras'], eq: ['barre'], t: 'iso', pr: 6, cue: "Barre lourde, bras tendus, monte les épaules à la verticale." },

    // ——— Haut du dos
    { id: 'row_bar', n: 'Rowing barre buste penché', m: ['haut_dos', 'dorsaux'], s: ['biceps', 'arriere_epaules', 'lombaires'], eq: ['barre'], t: 'comp', p: 'pull_h', heavy: 1, lvl: 2, pr: 9, cue: "Buste à ~45°, dos neutre, tire la barre vers le nombril, omoplates serrées en haut." },
    { id: 'row_db', n: 'Rowing haltère unilatéral', m: ['dorsaux', 'haut_dos'], s: ['biceps', 'arriere_epaules'], eq: ['halteres', 'banc'], t: 'comp', p: 'pull_h', uni: 1, str: 1, pr: 8, cue: "Main et genou sur le banc, laisse l'épaule descendre en bas (étirement), tire le coude vers la hanche." },
    { id: 'cable_row', n: 'Tirage horizontal à la poulie', m: ['haut_dos', 'dorsaux'], s: ['biceps', 'arriere_epaules'], eq: ['poulie'], t: 'comp', p: 'pull_h', str: 1, pr: 9, cue: "Laisse les omoplates s'avancer en étirement, puis tire en serrant le dos, buste immobile." },
    { id: 'chest_row', n: 'Rowing poitrine appuyée (banc incliné)', m: ['haut_dos'], s: ['arriere_epaules', 'biceps'], eq: ['halteres', 'banc'], t: 'comp', p: 'pull_h', pr: 8, cue: "Poitrine sur un banc incliné : aucune triche possible, le dos fait tout le travail." },
    { id: 'inverted_row', n: 'Rowing inversé (barre basse / anneaux)', m: ['haut_dos'], s: ['biceps', 'arriere_epaules'], eq: ['traction'], t: 'comp', p: 'pull_h', bw: 1, pr: 6, cue: "Corps gainé, tire la poitrine vers la barre. Plus les pieds sont loin, plus c'est dur." },
    { id: 'table_row', n: 'Rowing inversé sous une table', m: ['haut_dos', 'dorsaux'], s: ['biceps', 'arriere_epaules'], eq: [], t: 'comp', p: 'pull_h', bw: 1, pr: 2, cue: "Uniquement sous une table lourde et stable qui ne peut pas basculer. Allongé dessous, mains sur le bord, corps gainé, tire la poitrine vers la table." },
    { id: 'machine_row', n: 'Rowing (machine)', m: ['haut_dos', 'dorsaux'], s: ['biceps'], eq: ['machine'], t: 'comp', p: 'pull_h', pr: 6, cue: "Poitrine contre l'appui, tire les coudes en arrière, contrôle le retour." },
    { id: 'band_row', n: 'Rowing (élastique)', m: ['haut_dos'], s: ['biceps'], eq: ['elastique'], t: 'comp', p: 'pull_h', pr: 4, cue: "Élastique fixé devant toi, tire les coudes en arrière, omoplates serrées." },

    // ——— Dorsaux
    { id: 'pullup', n: 'Tractions pronation', m: ['dorsaux'], s: ['biceps', 'haut_dos', 'avant_bras'], eq: ['traction'], t: 'comp', p: 'pull_v', bw: 1, heavy: 1, lvl: 2, pr: 10, cue: "Pars bras tendus, poitrine vers la barre, coudes vers les hanches, contrôle la descente." },
    { id: 'pullup_neg', n: 'Tractions négatives (descente 5 s)', m: ['dorsaux'], s: ['biceps'], eq: ['traction'], t: 'comp', p: 'pull_v', bw: 1, pr: 3, cue: "Monte avec un saut ou une chaise, puis descends le plus lentement possible (5 s ou plus)." },
    { id: 'pullup_band', n: 'Tractions assistées (élastique)', m: ['dorsaux'], s: ['biceps'], eq: ['traction', 'elastique'], t: 'comp', p: 'pull_v', bw: 1, pr: 5, cue: "Élastique sous les genoux ou les pieds ; diminue l'assistance au fil des semaines." },
    { id: 'lat_pulldown', n: 'Tirage vertical poulie haute', m: ['dorsaux'], s: ['biceps', 'haut_dos'], eq: ['poulie'], t: 'comp', p: 'pull_v', str: 1, pr: 9, cue: "Bras tendus en haut pour l'étirement, tire la barre vers le haut de la poitrine, coudes vers le bas." },
    { id: 'cable_pullover', n: 'Pullover à la poulie (bras tendus)', m: ['dorsaux'], s: [], eq: ['poulie'], t: 'iso', str: 1, pr: 7, cue: "Buste penché, bras quasi tendus, ramène la barre vers les cuisses en pensant « coudes vers les hanches »." },
    { id: 'db_pullover', n: 'Pullover (haltère)', m: ['dorsaux'], s: ['pectoraux'], eq: ['halteres', 'banc'], t: 'iso', str: 1, pr: 5, cue: "Allongé, haltère au-dessus de la poitrine, descends derrière la tête bras légèrement fléchis." },
    { id: 'scap_pull', n: 'Tractions scapulaires (suspension active)', m: ['dorsaux'], s: ['haut_dos'], eq: ['traction'], t: 'comp', p: 'pull_v', bw: 1, pr: 2, cue: "Suspendu bras tendus, abaisse et serre les omoplates pour monter de quelques cm, sans plier les coudes." },

    // ——— Lombaires / chaîne postérieure
    { id: 'deadlift', n: 'Soulevé de terre', m: ['lombaires', 'fessiers', 'ischios'], s: ['haut_dos', 'trapezes', 'avant_bras', 'quadriceps'], eq: ['barre'], t: 'comp', p: 'hinge', heavy: 1, pr: 10, cue: "Barre au-dessus du milieu du pied, dos neutre, « pousse le sol », hanches et épaules montent ensemble." },
    { id: 'deficit_dl', n: 'Soulevé de terre en déficit', m: ['lombaires', 'fessiers', 'ischios'], s: ['quadriceps', 'haut_dos'], eq: ['barre'], t: 'comp', p: 'hinge', heavy: 1, lvl: 3, pr: 2, cue: "Debout sur un disque de 2-5 cm : départ plus bas, renforce le décollage du sol." },
    { id: 'block_pull', n: 'Soulevé de terre partiel (depuis blocs)', m: ['lombaires', 'fessiers'], s: ['trapezes', 'haut_dos'], eq: ['barre'], t: 'comp', p: 'hinge', heavy: 1, lvl: 3, pr: 2, cue: "Barre posée sur des blocs juste sous les genoux : surcharge le verrouillage." },
    { id: 'back_ext', n: 'Extensions lombaires (banc à 45°)', m: ['lombaires'], s: ['fessiers', 'ischios'], eq: ['machine'], t: 'iso', pr: 7, cue: "Charnière de hanche contrôlée, monte jusqu'à l'alignement du corps, pas d'hyperextension." },
    { id: 'good_morning', n: 'Good morning', m: ['ischios', 'lombaires'], s: ['fessiers'], eq: ['barre'], t: 'comp', p: 'hinge', str: 1, lvl: 2, pr: 4, cue: "Barre sur le haut du dos, genoux légèrement fléchis, recule les hanches en gardant le dos neutre." },
    { id: 'bird_dog', n: 'Bird dog', m: ['lombaires'], s: ['abdos', 'fessiers'], eq: [], t: 'core', bw: 1, pr: 6, cue: "À quatre pattes, tends bras et jambe opposés, tiens 10 s sans bouger le bassin.", sci: "Un des « Big 3 » de McGill." },
    { id: 'superman', n: 'Superman au sol', m: ['lombaires'], s: ['fessiers'], eq: [], t: 'core', bw: 1, pr: 2, cue: "Allongé sur le ventre, décolle bras et jambes quelques secondes sans forcer sur la nuque." },

    // ——— Fessiers
    { id: 'hip_thrust', n: 'Hip thrust (barre)', m: ['fessiers'], s: ['ischios'], eq: ['barre', 'banc'], t: 'comp', p: 'bridge', heavy: 1, pr: 9, cue: "Haut du dos sur le banc, menton rentré, monte le bassin et serre fort 1 s en haut, tibias verticaux." },
    { id: 'hip_thrust_db', n: 'Hip thrust (haltère)', m: ['fessiers'], s: ['ischios'], eq: ['halteres', 'banc'], t: 'comp', p: 'bridge', pr: 6, cue: "Haltère sur les hanches, même technique qu'à la barre." },
    { id: 'glute_bridge', n: 'Pont fessier', m: ['fessiers'], s: ['ischios'], eq: [], t: 'comp', p: 'bridge', bw: 1, pr: 5, cue: "Allongé, pieds proches des fesses, monte le bassin en serrant les fessiers. Version unijambiste pour progresser." },
    { id: 'bulgarian', n: 'Squat bulgare (haltères)', m: ['quadriceps', 'fessiers'], s: ['adducteurs'], eq: ['halteres', 'banc'], t: 'comp', p: 'lunge', uni: 1, str: 1, pr: 9, cue: "Pied arrière sur le banc, descends profond. Buste penché = plus de fessiers, buste droit = plus de quadriceps." },
    { id: 'bulgarian_bw', n: 'Squat bulgare (poids du corps)', m: ['quadriceps', 'fessiers'], s: ['adducteurs'], eq: ['banc'], t: 'comp', p: 'lunge', uni: 1, str: 1, bw: 1, pr: 6, cue: "Pied arrière sur un banc ou une chaise, descends lentement (3 s) jusqu'à frôler le sol avec le genou." },
    { id: 'walking_lunge', n: 'Fentes marchées (haltères)', m: ['quadriceps', 'fessiers'], s: ['adducteurs'], eq: ['halteres'], t: 'comp', p: 'lunge', uni: 1, pr: 7, cue: "Grands pas, genou arrière qui frôle le sol, buste droit." },
    { id: 'reverse_lunge', n: 'Fentes arrière', m: ['fessiers', 'quadriceps'], s: [], eq: [], t: 'comp', p: 'lunge', uni: 1, bw: 1, pr: 6, cue: "Recule d'un grand pas, descends à la verticale, pousse avec la jambe avant." },
    { id: 'step_up', n: 'Montées sur banc (step-up)', m: ['quadriceps', 'fessiers'], s: [], eq: ['banc'], t: 'comp', p: 'lunge', uni: 1, bw: 1, pr: 5, cue: "Pied entier sur le banc, monte sans t'aider de la jambe arrière." },
    { id: 'abduction', n: 'Abduction de hanche (machine)', m: ['fessiers'], s: [], eq: ['machine'], t: 'iso', pr: 6, cue: "Buste légèrement penché en avant pour cibler le moyen fessier." },
    { id: 'kb_swing', n: 'Kettlebell swing', m: ['fessiers', 'ischios'], s: ['lombaires', 'avant_bras'], eq: ['kb'], t: 'pliom', p: 'hinge', pr: 8, cue: "Charnière de hanche explosive (pas un squat), la kettlebell flotte à hauteur de poitrine, fessiers serrés en haut." },

    // ——— Quadriceps
    { id: 'squat', n: 'Squat (barre arrière)', m: ['quadriceps', 'fessiers'], s: ['adducteurs', 'lombaires'], eq: ['barre'], t: 'comp', p: 'squat', heavy: 1, pr: 10, cue: "Inspire et gaine, genoux dans l'axe des pieds, descends au moins à la parallèle, buste solide." },
    { id: 'pause_squat', n: 'Squat avec pause (2 s en bas)', m: ['quadriceps', 'fessiers'], s: ['adducteurs'], eq: ['barre'], t: 'comp', p: 'squat', heavy: 1, lvl: 2, pr: 3, cue: "Tiens 2 s en bas sans te relâcher, puis remonte explosif. Renforce la sortie du trou." },
    { id: 'front_squat', n: 'Squat avant (front squat)', m: ['quadriceps'], s: ['fessiers', 'haut_dos', 'abdos'], eq: ['barre'], t: 'comp', p: 'squat', heavy: 1, lvl: 2, pr: 8, cue: "Barre sur les deltoïdes avant, coudes hauts, buste vertical." },
    { id: 'goblet', n: 'Goblet squat', m: ['quadriceps', 'fessiers'], s: ['abdos', 'adducteurs'], eq: ['halteres'], t: 'comp', p: 'squat', pr: 7, cue: "Haltère contre la poitrine, coudes entre les genoux en bas, buste droit." },
    { id: 'leg_press', n: 'Presse à cuisses', m: ['quadriceps', 'fessiers'], s: ['adducteurs'], eq: ['machine'], t: 'comp', p: 'squat', pr: 9, cue: "Descends aussi bas que possible sans que le bassin décolle du dossier." },
    { id: 'hack_squat', n: 'Hack squat (machine)', m: ['quadriceps'], s: ['fessiers'], eq: ['machine'], t: 'comp', p: 'squat', str: 1, pr: 8, cue: "Pieds au milieu de la plateforme, descente profonde et contrôlée." },
    { id: 'leg_ext', n: 'Leg extension', m: ['quadriceps'], s: [], eq: ['machine'], t: 'iso', pr: 8, cue: "Tends complètement, contrôle la descente jusqu'en bas ; dossier incliné vers l'arrière pour étirer le droit fémoral." },
    { id: 'air_squat', n: 'Squat au poids du corps', m: ['quadriceps', 'fessiers'], s: [], eq: [], t: 'comp', p: 'squat', bw: 1, pr: 3, cue: "Pieds largeur d'épaules, descends le plus bas possible en gardant les talons au sol." },
    { id: 'jump_squat', n: 'Squats sautés', m: ['quadriceps', 'fessiers'], s: ['mollets'], eq: [], t: 'pliom', p: 'squat', bw: 1, pr: 5, cue: "Descends à mi-hauteur, saute le plus haut possible, réception souple." },
    { id: 'pistol', n: 'Pistol squat (assisté si besoin)', m: ['quadriceps', 'fessiers'], s: ['abdos'], eq: [], t: 'comp', p: 'squat', bw: 1, uni: 1, lvl: 3, pr: 5, cue: "Sur une jambe, l'autre tendue devant. Tiens-toi à un support au début." },
    { id: 'wall_sit', n: 'Chaise contre le mur', m: ['quadriceps'], s: [], eq: [], t: 'iso', hold: 1, bw: 1, pr: 2, cue: "Dos au mur, cuisses parallèles au sol, genoux à 90°." },

    // ——— Ischio-jambiers
    { id: 'seated_curl', n: 'Leg curl assis', m: ['ischios'], s: [], eq: ['machine'], t: 'iso', str: 1, pr: 10, cue: "Buste penché en avant pour étirer davantage les ischios, contrôle la remontée.", sci: "Maeo et al. 2021 : plus d'hypertrophie des ischios qu'en leg curl couché." },
    { id: 'lying_curl', n: 'Leg curl couché', m: ['ischios'], s: [], eq: ['machine'], t: 'iso', pr: 7, cue: "Bassin plaqué, ramène les talons vers les fesses, descente lente." },
    { id: 'rdl', n: 'Soulevé de terre roumain (barre)', m: ['ischios', 'fessiers'], s: ['lombaires', 'avant_bras'], eq: ['barre'], t: 'comp', p: 'hinge', heavy: 1, str: 1, pr: 9, cue: "Genoux légèrement fléchis, recule les hanches, barre le long des cuisses jusqu'à l'étirement des ischios." },
    { id: 'rdl_db', n: 'Soulevé de terre roumain (haltères)', m: ['ischios', 'fessiers'], s: ['lombaires'], eq: ['halteres'], t: 'comp', p: 'hinge', str: 1, pr: 8, cue: "Haltères le long des jambes, recule les hanches, dos neutre." },
    { id: 'sl_rdl', n: 'Soulevé de terre roumain unijambiste', m: ['ischios', 'fessiers'], s: ['obliques'], eq: ['halteres'], t: 'comp', p: 'hinge', uni: 1, pr: 5, cue: "Sur une jambe, bascule le buste en tendant l'autre jambe derrière, bassin bien horizontal." },
    { id: 'nordic', n: 'Nordic hamstring curl', m: ['ischios'], s: [], eq: [], t: 'iso', bw: 1, str: 1, lvl: 2, pr: 8, cue: "Chevilles bloquées, corps droit des genoux à la tête, freine la chute le plus longtemps possible.", sci: "Programmes nordiques : environ −50 % de blessures aux ischios (van Dyk et al. 2019)." },
    { id: 'slider_curl', n: 'Leg curl glissé au sol', m: ['ischios'], s: ['fessiers'], eq: [], t: 'iso', bw: 1, pr: 5, cue: "Allongé, talons sur une serviette, bassin en l'air, ramène et repousse les talons." },

    // ——— Adducteurs
    { id: 'copenhagen', n: 'Planche Copenhague', m: ['adducteurs'], s: ['obliques'], eq: ['banc'], t: 'core', hold: 1, bw: 1, uni: 1, pr: 8, cue: "En planche latérale, jambe du dessus posée sur le banc, décolle le bassin. Genou sur le banc pour la version facile.", sci: "Harøy et al. 2019 : −41 % de problèmes à l'aine chez des footballeurs." },
    { id: 'adduction', n: 'Adduction de hanche (machine)', m: ['adducteurs'], s: [], eq: ['machine'], t: 'iso', pr: 7, cue: "Amplitude complète, ouverture contrôlée en étirement." },
    { id: 'sumo_squat', n: 'Squat sumo (haltère)', m: ['adducteurs', 'quadriceps', 'fessiers'], s: [], eq: ['halteres'], t: 'comp', p: 'squat', pr: 6, cue: "Pieds larges, pointes ouvertes, haltère tenu entre les jambes, descends profond." },
    { id: 'cossack', n: 'Squat cosaque', m: ['adducteurs'], s: ['quadriceps', 'fessiers'], eq: [], t: 'comp', p: 'lunge', bw: 1, uni: 1, pr: 5, cue: "Pieds très écartés, descends sur une jambe en gardant l'autre tendue, pointe vers le haut." },

    // ——— Mollets
    { id: 'calf_machine', n: 'Mollets debout (machine)', m: ['mollets'], s: [], eq: ['machine'], t: 'iso', str: 1, pr: 9, cue: "Pause 2 s en bas en étirement complet, monte le plus haut possible, aucun rebond.", sci: "Kassiano et al. 2023 : travailler en position étirée donne plus d'hypertrophie du gastrocnémien." },
    { id: 'calf_single', n: 'Mollets unilatéral sur marche', m: ['mollets'], s: [], eq: [], t: 'iso', str: 1, uni: 1, bw: 1, pr: 8, cue: "Sur une marche, talon le plus bas possible 2 s, monte haut. Ajoute un haltère quand 20 reps deviennent faciles." },
    { id: 'calf_seated', n: 'Mollets assis (soléaire)', m: ['mollets'], s: [], eq: ['machine'], t: 'iso', pr: 7, cue: "Genoux pliés à 90° : cible le soléaire. Pause en bas." },
    { id: 'calf_press', n: 'Mollets à la presse', m: ['mollets'], s: [], eq: ['machine'], t: 'iso', str: 1, pr: 7, cue: "Avant des pieds sur le bas de la plateforme, genoux tendus, étirement maximal." },
    { id: 'jump_rope', n: 'Corde à sauter / sautillements', m: ['mollets'], s: [], eq: [], t: 'pliom', hold: 1, bw: 1, pr: 4, cue: "Sauts bas et rapides sur l'avant des pieds, poignets qui tournent." },

    // ——— Conditionnement
    { id: 'burpee', n: 'Burpees', m: ['quadriceps', 'pectoraux'], s: ['epaules', 'abdos'], eq: [], t: 'pliom', bw: 1, pr: 4, cue: "Poitrine au sol, relève-toi d'un bond et saute bras en l'air. Rythme régulier." },
    { id: 'mountain', n: 'Mountain climbers', m: ['abdos'], s: ['epaules', 'quadriceps'], eq: [], t: 'pliom', bw: 1, pr: 3, cue: "En position de pompe, ramène les genoux vers la poitrine en alternance, bassin bas." },

    // ——— Mobilité (utilisée pour l'échauffement, le retour au calme et les séances dédiées)
    { id: 'couch_stretch', n: 'Étirement du psoas (couch stretch)', m: ['quadriceps'], s: [], eq: [], t: 'mob', hold: 1, uni: 1, bw: 1, pr: 5, cue: "Genou arrière contre un mur ou un banc, serre le fessier, buste droit." },
    { id: 'hip_9090', n: 'Rotations de hanches 90/90', m: ['fessiers'], s: ['adducteurs'], eq: [], t: 'mob', bw: 1, pr: 5, cue: "Assis, jambes à 90°, bascule les genoux d'un côté à l'autre lentement." },
    { id: 'wgs', n: 'World\'s greatest stretch', m: ['ischios', 'fessiers'], s: ['haut_dos'], eq: [], t: 'mob', bw: 1, uni: 1, pr: 5, cue: "Grande fente, coude vers la cheville, puis rotation du buste bras vers le ciel." },
    { id: 'thoracic_rot', n: 'Rotations thoraciques (open book)', m: ['haut_dos'], s: [], eq: [], t: 'mob', bw: 1, uni: 1, pr: 5, cue: "Allongé sur le côté, genoux pliés, ouvre le bras du dessus vers l'arrière en suivant la main des yeux." },
    { id: 'cat_camel', n: 'Cat-camel', m: ['lombaires'], s: [], eq: [], t: 'mob', bw: 1, pr: 5, cue: "À quatre pattes, alterne doucement dos rond et dos creux, sans forcer les amplitudes." },
    { id: 'deep_squat_hold', n: 'Squat profond tenu', m: ['adducteurs', 'quadriceps'], s: ['mollets'], eq: [], t: 'mob', hold: 1, bw: 1, pr: 5, cue: "Descends au plus bas, talons au sol, coudes qui poussent les genoux vers l'extérieur." },
  ];

  // Charge typique par exercice, pour choisir quoi faire avec des haltères ou des élastiques de poids fixe
  const LOAD = {
    L: ['db_fly', 'lat_raise', 'rear_fly', 'band_lat_raise', 'band_pull_apart'],
    H: ['farmer', 'suitcase', 'shrug_db', 'row_db', 'hip_thrust_db', 'goblet', 'rdl_db', 'sumo_squat', 'pullup_band', 'band_row'],
  };
  // Exercices au poids du corps qui se lestent avec un gilet
  const VEST = ['pullup', 'chinup', 'dips', 'pushup', 'pushup_deficit', 'diamond', 'pike_pushup', 'inverted_row', 'air_squat',
    'reverse_lunge', 'step_up', 'bulgarian_bw', 'pistol', 'plank', 'glute_bridge', 'calf_single', 'cossack'];

  EX.forEach(e => {
    e.s = e.s || []; e.lvl = e.lvl || 1; e.pr = e.pr || 5;
    if (e.eq.includes('halteres') || e.eq.includes('elastique')) e.ld = LOAD.L.includes(e.id) ? 'L' : LOAD.H.includes(e.id) ? 'H' : 'M';
    if (VEST.includes(e.id)) e.vest = 1;
  });
  const MAP = {};
  EX.forEach(e => { MAP[e.id] = e; });

  A.DATA = Object.assign(A.DATA || {}, { MUSCLES, PRESETS, EQUIP, SETUPS, EX });

  // Exercices de la base + exercices personnalisés de l'utilisateur
  A.exList = () => EX.concat((A.store.data.customEx || []));
  A.exById = id => MAP[id] || (A.store.data.customEx || []).find(e => e.id === id) || null;
  A.mName = id => (MUSCLES[id] ? MUSCLES[id].n : id);

  // ——— Matériel avec moi ———
  const kgList = l => l.map(w => String(w).replace('.', ',')).join(' et ');
  A.setupById = id => SETUPS.find(s => s.id === id) || null;
  A.setupName = id => (A.setupById(id) ? A.setupById(id).n : 'Matériel personnalisé');
  // Charges fixes de mon matériel personnel, limitées à ce qui est présent (aucune en salle complète)
  A.gearFor = (setupId, eq) => {
    if (setupId === 'salle') return null;
    const g = A.store.data.profile.gear || {}, has = new Set(eq), out = {};
    ['halteres', 'elastique', 'gilet'].forEach(k => { if (has.has(k) && g[k] && g[k].length) out[k] = g[k].slice(); });
    return Object.keys(out).length ? out : null;
  };
  A.setupDesc = (setupId, eq) => {
    if (setupId === 'salle') return 'Accès à tout le matériel : barres, haltères, machines, poulies.';
    const g = A.store.data.profile.gear || {}, has = new Set(eq);
    const parts = [];
    if (has.has('traction')) parts.push('tractions');
    if (has.has('dips')) parts.push('dips');
    parts.push('pompes', 'abdos');
    if (has.has('banc')) parts.push('banc incliné');
    if (has.has('halteres')) parts.push(g.halteres && g.halteres.length ? `2 haltères de ${kgList(g.halteres)} kg` : 'haltères');
    if (has.has('elastique')) parts.push(g.elastique && g.elastique.length ? `élastiques de ${kgList(g.elastique)} kg` : 'élastiques');
    if (has.has('gilet')) parts.push(g.gilet && g.gilet.length ? `gilet lesté de ${kgList(g.gilet)} kg` : 'gilet lesté');
    ['barre', 'machine', 'poulie', 'kb'].forEach(k => { if (has.has(k)) parts.push(EQUIP[k].toLowerCase()); });
    if (!eq.length) return 'Juste toi et le sol : pompes, squats, gainage…';
    const t = parts.join(', ');
    return t.charAt(0).toUpperCase() + t.slice(1) + '.';
  };
})(window.A);
