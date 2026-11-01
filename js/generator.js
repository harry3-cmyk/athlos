/* Athlos — générateur de séances et logique de progression */
(function (A) {
  'use strict';
  const D = A.DATA, ui = A.ui, MUS = D.MUSCLES;

  const GOALS = {
    force: { n: 'Force', d: '3-5 reps lourdes · repos 3 min', split: { force: 1 } },
    hypertrophie: { n: 'Hypertrophie', d: '6-15 reps proches de l\'échec · repos 1,5-2,5 min', split: { hyper: 1 } },
    endurance: { n: 'Endurance', d: 'Cardio et endurance musculaire', split: null },
    force_hyper: { n: 'Force + Hypertrophie', d: 'Lourd d\'abord, puis volume', split: { force: .45, hyper: .55 } },
    force_endu: { n: 'Force + Endurance', d: 'Profil tactique / hybride', split: { force: .6, cardio: .4 } },
    hyper_endu: { n: 'Hypertrophie + Endurance', d: 'Muscle puis cardio', split: { hyper: .65, cardio: .35 } },
    tout: { n: 'Un peu de tout', d: 'Force, muscle et cardio', split: { force: .35, hyper: .4, cardio: .25 } },
  };
  const LEVELS = { debutant: 1, inter: 2, avance: 3 };
  const LEVEL_NAMES = { debutant: 'Débutant', inter: 'Intermédiaire', avance: 'Avancé' };
  const MOD = { course: 'Course', velo: 'Vélo / rameur', circuit: 'Circuit poids du corps' };
  const COMPLEMENT = {
    pectoraux: ['triceps', 'epaules'], dorsaux: ['biceps', 'arriere_epaules'], haut_dos: ['arriere_epaules', 'trapezes'],
    epaules: ['arriere_epaules', 'triceps'], arriere_epaules: ['haut_dos'], biceps: ['triceps', 'avant_bras'],
    triceps: ['biceps', 'epaules'], avant_bras: ['biceps'], abdos: ['obliques', 'lombaires'], obliques: ['abdos'],
    lombaires: ['fessiers', 'abdos'], fessiers: ['ischios', 'adducteurs'], quadriceps: ['fessiers', 'mollets'],
    ischios: ['fessiers', 'lombaires'], adducteurs: ['fessiers'], mollets: ['quadriceps'], trapezes: ['haut_dos'],
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Répétitions et durées ----------
  const nums = reps => (String(reps ?? '').match(/\d+/g) || []).slice(0, 2).map(Number);
  const repsAvg = reps => { const n = nums(reps); return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 8; };
  const repsTop = reps => { const n = nums(reps); return n.length ? Math.max(...n) : 10; };
  const repsLow = reps => { const n = nums(reps); return n.length ? n[0] : 8; };

  function cardioSeconds(c) {
    if (c.protocol === 'steady') return c.duration || 0;
    const series = c.series || 1;
    return series * (c.rounds * c.work + (c.rounds - 1) * (c.rest || 0)) + (series - 1) * (c.seriesRest || 0);
  }
  function itemSeconds(it, inCircuit) {
    if (it.type === 'cardio') return cardioSeconds(it);
    const ex = A.exById(it.exId) || {};
    const work = (it.hold ? it.hold : repsAvg(it.reps) * 3.5 + 8) * (ex.uni ? 2 : 1);
    if (inCircuit) return work;
    return it.sets * work + Math.max(0, it.sets - 1) * (it.rest || 0) + 75 + (it.ramp || 0);
  }
  function blockSeconds(b) {
    if (b.kind === 'circuit') {
      const per = b.items.reduce((s, it) => s + itemSeconds(it, true) + (b.restEx || 0), 0);
      return b.rounds * per + Math.max(0, b.rounds - 1) * (b.restRound || 0) + 60;
    }
    return b.items.reduce((s, it) => s + itemSeconds(it), 0);
  }
  function sessionSeconds(s) {
    return (s.warmup && s.warmup.length ? (s.warmupSec || 360) : 0)
      + s.blocks.reduce((t, b) => t + blockSeconds(b), 0)
      + (s.cooldown && s.cooldown.length ? (s.cooldownSec || 180) : 0);
  }

  // ---------- Contexte de génération ----------
  function makeCtx(p) {
    const hist = A.store.data.history;
    const recent = new Set();
    hist.slice(0, 2).forEach(h => (h.exercises || []).forEach(e => recent.add(e.exId)));
    const weekAgo = Date.now() - 7 * 864e5;
    const ctx = {
      lvl: LEVELS[p.level] || 2, eq: new Set(p.equipment || []), muscles: new Set(p.muscles || []), weak: p.weak || null,
      duration: p.duration, rand: rng(p.seed), used: new Set(), cov: {}, recent, cardio: p.cardio || 'auto',
      hardRecent: hist.filter(h => h.date > weekAgo && (h.cardio || []).some(c => c.hard)).length,
    };
    Object.keys(MUS).forEach(m => { ctx.cov[m] = 0; });
    ctx.use = (ex, sets) => {
      ctx.used.add(ex.id);
      ex.m.forEach(m => { ctx.cov[m] += sets; });
      ex.s.forEach(m => { ctx.cov[m] += sets * 0.5; });
    };
    return ctx;
  }

  function pool(ctx, filter) {
    return A.exList().filter(ex => ex.m && ex.m.length && ex.t !== 'mob' && !ctx.used.has(ex.id)
      && (ex.eq || []).every(e => ctx.eq.has(e)) && (ex.lvl || 1) <= ctx.lvl && filter(ex));
  }
  function pick(cands, score, ctx) {
    let best = null, bs = -Infinity;
    cands.forEach(ex => { const s = score(ex) + ctx.rand() * 2.5; if (s > bs) { bs = s; best = ex; } });
    return best;
  }
  function baseScore(ex, ctx) {
    let s = ex.pr || 5;
    s += (ex.m.filter(m => ctx.muscles.has(m)).length - 1) * 1.2;
    s += ex.s.filter(m => ctx.muscles.has(m)).length * 0.3;
    if (ctx.recent.has(ex.id)) s -= 1.5;
    // Avec du matériel, on préfère les versions chargées aux versions au poids du corps
    if (ex.bw && !ex.heavy && ctx.eq.size >= 3) s -= 1.5;
    return s;
  }
  const needScore = (ex, ctx) => ex.m.reduce((s, m) => s + (ctx.muscles.has(m) && ctx.cov[m] < 3 ? 1.5 : 0), 0);
  function orderMuscles(ctx) {
    const order = Object.keys(MUS).filter(m => ctx.muscles.has(m));
    return order.sort((a, b) => ((b === ctx.weak) - (a === ctx.weak)) || ((!!MUS[b].big) - (!!MUS[a].big)));
  }

  // ---------- Blocs ----------
  function buildForce(budget, ctx) {
    const items = [];
    let t = 0;
    const L = ctx.lvl;
    const sets = L === 1 ? 3 : L === 2 ? 4 : 5;
    const maxMain = ctx.duration >= 90 ? 3 : ctx.duration >= 60 ? 2 : 1;
    const patterns = new Set();
    for (let k = 0; k < maxMain; k++) {
      const cands = pool(ctx, ex => ex.heavy && ex.pr >= 6 && !patterns.has(ex.p) && ex.m.some(m => ctx.muscles.has(m)));
      const ex = pick(cands, ex => baseScore(ex, ctx) + needScore(ex, ctx) + (ctx.weak && ex.m.includes(ctx.weak) ? 6 : 0) - (ex.bw ? 1 : 0), ctx);
      if (!ex) break;
      const it = {
        exId: ex.id, sets, rest: L === 3 ? 240 : 180, rir: L === 1 ? '2-3' : '1-2', role: 'main', ramp: k === 0 ? 240 : 150,
        reps: ex.bw ? '3-6' : (L === 1 ? '5' : '3-5'),
        load: ex.bw ? 'Leste-toi pour rester entre 3 et 6 reps' : '≈ 80-87 % de ton 1RM',
        pctRange: ex.bw ? null : [0.8, 0.87],
      };
      if (k > 0 && t + itemSeconds(it) > budget) break;
      items.push(it); t += itemSeconds(it); ctx.use(ex, sets); patterns.add(ex.p);
    }
    let guard = 0;
    while (budget - t > 300 && guard++ < 6) {
      const cands = pool(ctx, ex => ex.t === 'comp' && ex.m.some(m => ctx.muscles.has(m)));
      const ex = pick(cands, ex => baseScore(ex, ctx) + needScore(ex, ctx) * 2 + (ctx.weak && ex.m.includes(ctx.weak) ? 4 : 0), ctx);
      if (!ex) break;
      const it = { exId: ex.id, sets: 3, reps: ex.bw ? '5-8' : '6-8', rest: 150, rir: '2', role: 'acc', load: ex.bw ? 'Leste-toi si besoin' : 'Lourd mais propre' };
      if (t + itemSeconds(it) > budget + 120) break;
      items.push(it); t += itemSeconds(it); ctx.use(ex, 3);
    }
    if (!items.length) {
      // Aucun mouvement lourd dispo (ex. bras seuls) : force relative sur les meilleurs exercices
      for (const m of orderMuscles(ctx)) {
        if (budget - t < 300) break;
        const ex = pick(pool(ctx, e => e.m.includes(m) && e.t !== 'pliom' && !e.hold), e => baseScore(e, ctx), ctx);
        if (!ex) continue;
        const it = { exId: ex.id, sets: 4, reps: '5-8', rest: 150, rir: '1-2', role: 'acc' };
        items.push(it); t += itemSeconds(it); ctx.use(ex, 4);
      }
    }
    return { kind: 'force', title: 'Bloc force', items, note: 'Séries lourdes et repos longs : la qualité de chaque répétition prime.' };
  }

  function hyperItem(ex, m, ctx) {
    const L = ctx.lvl;
    const small = ['mollets', 'abdos', 'obliques', 'avant_bras', 'trapezes'].includes(m);
    let it;
    if (ex.hold) it = { exId: ex.id, sets: 3, hold: ex.t === 'carry' ? 40 : 20 + L * 10, rest: 60, rir: '1-2' };
    else if (ex.t === 'comp' && !small) it = { exId: ex.id, sets: 3, reps: ex.bw ? '8-15' : '6-10', rest: 150, rir: L === 1 ? '2-3' : '1-2' };
    else if (small) it = { exId: ex.id, sets: 3, reps: '12-20', rest: 60, rir: L === 1 ? '1-2' : '0-1' };
    else it = { exId: ex.id, sets: 3, reps: '10-15', rest: 90, rir: L === 1 ? '1-2' : '0-1' };
    if (m === ctx.weak) { it.sets += 1; it.weak = true; }
    if (ex.str) it.note = "Accent sur l'étirement : descente en 2-3 s, courte pause en bas.";
    return it;
  }

  function buildHyper(budget, ctx, title) {
    const items = [];
    let t = 0;
    // Point faible d'abord, puis les muscles les moins travaillés par les blocs précédents
    const start = Object.assign({}, ctx.cov);
    const order = orderMuscles(ctx).sort((a, b) => ((b === ctx.weak) - (a === ctx.weak)) || (start[a] - start[b]));
    const cap = m => (m === ctx.weak ? 12 : MUS[m].big ? 9 : 6);
    const passes = [order, order.filter(m => m === ctx.weak || MUS[m].big), order, order];
    outer:
    for (const pass of passes) {
      for (const m of pass) {
        if (budget - t < 240) break outer;
        if (ctx.cov[m] >= cap(m)) continue;
        const wantComp = ctx.cov[m] < 1 && MUS[m].big;
        const cands = pool(ctx, ex => ex.m.includes(m) && ex.t !== 'pliom' && !(ex.heavy && ex.p === 'hinge' && ex.m.includes('lombaires')));
        const ex = pick(cands, ex => baseScore(ex, ctx) + (ex.str ? 3 : 0)
          + (wantComp ? (ex.t === 'comp' ? 4 : 0) : (ex.t === 'iso' ? 2 : 0)) + (ex.m[0] === m ? 1.5 : 0), ctx);
        if (!ex) continue;
        const it = hyperItem(ex, m, ctx);
        let sec = itemSeconds(it);
        if (t + sec > budget + 90 && it.sets > 2) { it.sets = 2; sec = itemSeconds(it); }
        if (t + sec > budget + 90) continue;
        items.push(it); t += sec; ctx.use(ex, it.sets);
      }
    }
    // Point faible d'abord, puis polyarticulaires, isolation, et enfin gainage / mollets
    const rank = it => {
      const ex = A.exById(it.exId);
      if (it.weak) return 0;
      if (ex.t === 'comp') return 1;
      if (ex.t === 'core' || ex.t === 'carry' || ex.m.includes('mollets')) return 3;
      return 2;
    };
    items.sort((a, b) => rank(a) - rank(b));
    return { kind: 'hyper', title: title || 'Bloc hypertrophie', items };
  }

  function buildCircuit(budget, ctx) {
    const items = [];
    orderMuscles(ctx).slice(0, 6).forEach(m => {
      const cands = pool(ctx, ex => ex.m.includes(m) && (!ex.heavy || ex.bw));
      const ex = pick(cands, ex => baseScore(ex, ctx) + (ex.bw ? 2 : 0) + (ex.t === 'comp' ? 2 : 0) + (ex.t === 'pliom' ? 1 : 0) - (ex.eq.includes('machine') ? 2 : 0), ctx);
      if (!ex) return;
      items.push(ex.hold ? { exId: ex.id, hold: 30 } : { exId: ex.id, reps: ex.t === 'pliom' ? '12-15' : '15-20' });
      ctx.use(ex, 3);
    });
    const restEx = ctx.lvl === 1 ? 30 : 20, restRound = 90;
    const b = { kind: 'circuit', title: 'Circuit endurance musculaire', items, restEx, restRound, rounds: 1, note: 'Enchaîne les exercices avec peu de repos, récupère entre les tours.' };
    if (!items.length) return b;
    const one = blockSeconds(b) - 60;
    b.rounds = ui.clamp(Math.floor((budget - 60 + restRound) / (one + restRound)), 2, 6);
    items.forEach(it => { it.sets = b.rounds; it.rest = restEx; });
    return b;
  }

  // ---------- Protocoles cardio ----------
  const C = {
    z2(mod, min) {
      min = Math.max(10, Math.round(min));
      if (mod === 'circuit') {
        return { type: 'cardio', id: 'z2c', name: 'Circuit aérobie (zone 2)', protocol: 'interval', work: 120, rest: 0, rounds: Math.max(5, Math.round(min / 2)),
          labels: ['Step-ups', 'Jumping jacks', 'Shadow boxing', 'Squats lents', 'Montées de genoux légères'],
          intensity: 'Zone 2 · 60-70 % FC max · respiration aisée, tu peux parler', note: "Change d'exercice toutes les 2 min sans t'arrêter.", hard: false, mod };
      }
      return { type: 'cardio', id: 'z2', name: `${MOD[mod]} en zone 2`, protocol: 'steady', duration: min * 60,
        intensity: 'Zone 2 · 60-70 % FC max · tu peux tenir une conversation', note: 'La base aérobie : endurance, récupération et santé cardiovasculaire (Seiler).', hard: false, mod };
    },
    seuil(mod, min) {
      const reps = min >= 30 ? 3 : 2;
      const work = ui.clamp(Math.floor((min - (reps - 1) * 2) / reps), 5, 12) * 60;
      return { type: 'cardio', id: 'seuil', name: `Seuil ${reps} × ${work / 60} min`, protocol: 'interval', work, rest: 120, rounds: reps,
        intensity: 'Seuil · ~85-90 % FC max · « confortablement difficile » (RPE 7)', note: 'Améliore la vitesse que tu peux tenir longtemps.', hard: false, mod };
    },
    billat(mod, min) {
      let series = 1, rounds = ui.clamp(Math.floor(min), 6, 12);
      if (min >= 13) { series = 2; rounds = ui.clamp(Math.floor((min - 3) / 2), 6, 10); }
      return { type: 'cardio', id: '3030', name: `30/30 · ${series > 1 ? series + ' × ' : ''}${rounds}`, protocol: 'interval', work: 30, rest: 30, rounds, series, seriesRest: 180,
        intensity: mod === 'course' ? '30 s à ~100 % VMA, 30 s de trot lent' : '30 s très intense (RPE 9), 30 s très facile',
        note: 'Format de Véronique Billat : beaucoup de temps passé près de la VO₂max.', hard: true, mod };
    },
    hiit11(mod, min) {
      const rounds = ui.clamp(Math.floor(min / 2), 5, 10);
      return { type: 'cardio', id: '1x1', name: `${rounds} × 1 min / 1 min`, protocol: 'interval', work: 60, rest: 60, rounds,
        intensity: "90-95 % FC max sur l'effort, récupération active", note: 'Intervalles courts classiques pour la VO₂max.', hard: true, mod };
    },
    n4x4(mod) {
      return { type: 'cardio', id: '4x4', name: '4 × 4 min norvégien', protocol: 'interval', work: 240, rest: 180, rounds: 4,
        intensity: '85-95 % FC max sur les 4 min, récupération active ~70 %', note: "Helgerud et al. 2007 : plus efficace qu'un effort continu modéré pour la VO₂max.", hard: true, mod };
    },
    tabata(mod) {
      return { type: 'cardio', id: 'tabata', name: 'Tabata 8 × 20 s / 10 s', protocol: 'interval', work: 20, rest: 10, rounds: 8,
        labels: mod === 'circuit' ? ['Burpees', 'Mountain climbers'] : null, intensity: 'Effort maximal sur chaque 20 s',
        note: 'Tabata et al. 1996 : court mais très exigeant.', hard: true, mod };
    },
    c4020(min) {
      const rounds = ui.clamp(Math.floor(min), 6, 24);
      return { type: 'cardio', id: '4020', name: `Circuit 40/20 × ${rounds}`, protocol: 'interval', work: 40, rest: 20, rounds,
        labels: ['Burpees', 'Mountain climbers', 'Squats sautés', 'Jumping jacks', 'Pompes', 'Montées de genoux'],
        intensity: 'Intense mais régulier (RPE 8)', note: "Un exercice par intervalle, dans l'ordre.", hard: true, mod: 'circuit' };
    },
  };

  function buildCardio(budget, ctx) {
    const mod = ctx.cardio === 'auto' ? (ctx.eq.has('machine') ? 'velo' : 'course') : ctx.cardio;
    const min = budget / 60;
    const hardOk = ctx.hardRecent < 2;
    const items = [];
    if (min < 9) items.push(C.tabata(mod));
    else if (!hardOk) {
      if (min >= 25 && mod !== 'circuit' && ctx.rand() < 0.35) items.push(C.seuil(mod, min));
      else items.push(C.z2(mod, min));
    } else if (min < 26) {
      items.push(mod === 'circuit' ? C.c4020(min) : (ctx.rand() < 0.55 ? C.billat(mod, min) : C.hiit11(mod, min)));
    } else if (mod === 'circuit') {
      items.push(C.c4020(20));
      if (min - 21 >= 10) items.push(C.z2('circuit', min - 21));
    } else {
      const r = ctx.rand();
      if (r < 0.5) {
        items.push(C.n4x4(mod));
        if (min - 26 >= 10) items.push(C.z2(mod, min - 26));
      } else if (r < 0.75) {
        const s = C.seuil(mod, Math.min(min, 40));
        items.push(s);
        const left = min - cardioSeconds(s) / 60 - 1;
        if (left >= 10) items.push(C.z2(mod, left));
      } else items.push(C.z2(mod, min));
    }
    return { kind: 'cardio', title: `Cardio · ${MOD[mod]}`, items, note: hardOk ? null : "Déjà 2 séances intenses cette semaine : place à l'aérobie (règle 80/20)." };
  }

  // ---------- Échauffement, notes, titre ----------
  function warmupFor(muscles, kinds, first) {
    const has = g => [...muscles].some(m => MUS[m] && MUS[m].g === g);
    const lifting = kinds.has('force') || kinds.has('hyper') || kinds.has('circuit');
    const list = [{ n: 'Élever la température', d: lifting ? '3-5 min de cardio léger (vélo, rameur, corde, footing) en accélérant doucement' : '8-10 min très facile, en accélérant progressivement' }];
    if (has('bas')) list.push({ n: 'Mobilité hanches et jambes', d: 'Balancés de jambes ×10/côté, squats lents ×8, fentes avec rotation ×5/côté' });
    if (has('haut') || has('bras')) list.push({ n: 'Mobilité épaules', d: 'Cercles de bras ×10, band pull-apart ou W au mur ×15, pompes scapulaires ×10' });
    if (lifting) list.push({ n: 'Activation du tronc', d: 'Dead bug ×6/côté, bird dog ×6/côté' });
    if (kinds.has('cardio') && !lifting) list.push({ n: 'Gammes', d: 'Montées de genoux, talons-fesses, pas chassés (2 × 20 m), puis 2-3 accélérations progressives' });
    if (first) list.push({ n: 'Montée en charge', d: `${first} : séries progressives (≈ 50 % × 8, 70 % × 4, 85 % × 2) avant les séries de travail` });
    return list;
  }
  const COOLDOWN = [
    { n: 'Retour au calme', d: '2-3 min de marche ou de vélo très facile, respiration lente par le nez' },
    { n: 'Mobilité légère (facultatif)', d: '20-30 s par muscle travaillé, sans forcer : pour le confort, pas pour éviter les courbatures' },
  ];

  function notesFor(ctx, kinds) {
    const n = [];
    if (kinds.has('force')) n.push("Force : charges lourdes (≈ 80-87 % du max), 3-5 reps, 1-3 reps en réserve et ~3 min de repos (Prilepin ; Schoenfeld et al. 2016).");
    if (kinds.has('hyper')) n.push("Hypertrophie : 6-15 reps proches de l'échec, variantes en position étirée privilégiées, 2 min et plus de repos sur les polyarticulaires (Schoenfeld et al. 2017 ; Maeo et al. 2021-2023).");
    if (kinds.has('circuit')) n.push('Endurance musculaire : 15-20 reps, repos courts, plusieurs tours.');
    if (kinds.has('cardio')) n.push(ctx.hardRecent >= 2 ? 'Cardio facile pour respecter la distribution 80/20 (Seiler).' : 'Cardio : protocole choisi selon le temps disponible (Billat, Helgerud, Tabata).');
    if ((kinds.has('force') || kinds.has('hyper')) && kinds.has('cardio')) n.push('Musculation avant le cardio pour préserver la qualité des séries (Schumann et al. 2022).');
    if (ctx.weak) n.push(`Point faible (${A.mName(ctx.weak)}) placé en premier avec plus de volume : ce qui est travaillé en début de séance progresse davantage (Simão et al. 2012).`);
    if (ctx.lvl === 1) n.push('Niveau débutant : 2-3 reps en réserve, priorité absolue à la technique.');
    return n;
  }

  function titleFor(goal, muscles) {
    const g = GOALS[goal] ? GOALS[goal].n : 'Séance';
    if (!muscles.length) return g;
    for (const pr of D.PRESETS) if (pr.m.length === muscles.length && pr.m.every(m => muscles.includes(m))) return `${g} · ${pr.n}`;
    if (muscles.length >= 3 && muscles.every(m => MUS[m].g === 'bas')) return `${g} · Bas du corps`;
    if (muscles.length >= 4 && muscles.every(m => MUS[m].g === 'haut' || MUS[m].g === 'bras')) return `${g} · Haut du corps`;
    return `${g} · ${muscles.slice(0, 3).map(A.mName).join(', ')}${muscles.length > 3 ? '…' : ''}`;
  }

  // ---------- Génération complète ----------
  function generate(input) {
    const p = Object.assign({ duration: 60, goal: 'hypertrophie', muscles: [], weak: null, equipment: A.ALL_EQ, level: 'inter', cardio: 'auto' }, input);
    p.seed = p.seed || Math.floor(Math.random() * 1e9);
    p.muscles = p.muscles.slice();
    if (!p.muscles.length && p.goal !== 'endurance') p.muscles = D.PRESETS[0].m.slice();
    if (p.weak && !p.muscles.includes(p.weak)) p.muscles.unshift(p.weak);
    const ctx = makeCtx(p);
    const split = p.goal === 'endurance' ? (p.muscles.length ? { circuit: .5, cardio: .5 } : { cardio: 1 }) : GOALS[p.goal].split;
    const kinds = Object.keys(split);
    const pureCardio = kinds.length === 1 && kinds[0] === 'cardio';
    const total = p.duration * 60;
    const warmupSec = pureCardio ? 480 : p.duration <= 30 ? 300 : p.duration <= 60 ? 420 : 540;
    const coolSec = pureCardio ? 300 : p.duration <= 30 ? 120 : 180;
    let remaining = total - warmupSec - coolSec;
    let shareLeft = kinds.reduce((s, k) => s + split[k], 0);
    const blocks = [];
    for (const k of kinds) {
      const budget = remaining * split[k] / shareLeft;
      const b = k === 'force' ? buildForce(budget, ctx) : k === 'hyper' ? buildHyper(budget, ctx) : k === 'circuit' ? buildCircuit(budget, ctx) : buildCardio(budget, ctx);
      shareLeft -= split[k];
      if (b.items.length) { blocks.push(b); remaining -= blockSeconds(b); }
    }
    // Peu de muscles choisis pour beaucoup de temps : complément facultatif sur les muscles voisins
    const notes = notesFor(ctx, new Set(kinds));
    if (remaining > 600 && (split.hyper || split.force)) {
      const extra = new Set();
      p.muscles.forEach(m => (COMPLEMENT[m] || []).forEach(c => { if (!ctx.muscles.has(c)) extra.add(c); }));
      if (extra.size) {
        const saved = ctx.muscles;
        ctx.muscles = extra;
        const b = buildHyper(remaining, ctx, 'Complément (facultatif)');
        ctx.muscles = saved;
        if (b.items.length) { b.optional = true; blocks.push(b); remaining -= blockSeconds(b); }
      }
      if (remaining > 600) notes.push("Séance plus courte que le temps disponible : au-delà de ~10 séries difficiles par muscle et par séance, les séries supplémentaires rapportent peu.");
    }
    const first = blocks[0] && blocks[0].kind === 'force' && blocks[0].items[0] ? A.exById(blocks[0].items[0].exId).n : null;
    // Muscles non travaillés : faute de matériel, ou faute de temps
    const uncovered = p.muscles.filter(m => ctx.cov[m] === 0);
    const noGear = uncovered.filter(m => !A.exList().some(ex => ex.m.includes(m) && ex.t !== 'mob' && ex.eq.every(e => ctx.eq.has(e)) && (ex.lvl || 1) <= ctx.lvl));
    const session = {
      id: ui.uid(), title: titleFor(p.goal, p.muscles), createdAt: Date.now(), source: 'quiz', params: p, goal: p.goal,
      muscles: p.muscles, weak: p.weak, warmup: warmupFor(ctx.muscles, new Set(kinds), first), warmupSec,
      blocks, cooldown: COOLDOWN, cooldownSec: coolSec, notes,
      missing: noGear, skipped: uncovered.filter(m => !noGear.includes(m)),
    };
    session.estMin = Math.round(sessionSeconds(session) / 60);
    return session;
  }

  // Exercices de remplacement pour le même muscle principal
  function alternatives(item, session, eq) {
    const ex = A.exById(item.exId);
    if (!ex) return [];
    const inSession = new Set(session.blocks.flatMap(b => b.items.map(i => i.exId)).filter(Boolean));
    const eqSet = new Set(eq || A.store.data.profile.equipment);
    const sim = e => e.pr + (e.t === ex.t ? 3 : 0) + (e.p && e.p === ex.p ? 2 : 0) + e.m.filter(m => ex.m.includes(m)).length;
    return A.exList()
      .filter(e => e.id !== ex.id && !inSession.has(e.id) && e.t !== 'mob' && e.m.includes(ex.m[0]) && e.eq.every(q => eqSet.has(q)))
      .sort((a, b) => sim(b) - sim(a));
  }
  function applySwap(item, newId) {
    const ex = A.exById(newId);
    item.exId = newId;
    delete item.pct; delete item.setW; delete item.pctRange;
    if (ex.hold && !item.hold) { item.hold = 30; delete item.reps; }
    if (!ex.hold && item.hold) { delete item.hold; item.reps = '10-15'; }
    item.note = ex.str ? "Accent sur l'étirement : descente en 2-3 s, courte pause en bas." : null;
  }

  // ---------- Constructeurs pour les séances types et les plans ----------
  function I(exId, sets, reps, rest, extra) {
    const ex = A.exById(exId);
    const it = { exId, sets, rest };
    if (ex && ex.hold) it.hold = typeof reps === 'number' ? reps : (ex.t === 'carry' ? 40 : 30);
    else it.reps = String(reps);
    return Object.assign(it, extra || {});
  }
  const B = (kind, title, items, extra) => Object.assign({ kind, title, items }, extra || {});
  function musclesOf(blocks) {
    return [...new Set(blocks.flatMap(b => b.items.filter(i => i.exId).flatMap(i => (A.exById(i.exId) || { m: [] }).m)))];
  }
  function S(title, blocks, extra = {}) {
    const muscles = musclesOf(blocks);
    const kinds = new Set(blocks.map(b => b.kind));
    const fb = blocks.find(b => b.kind === 'force' && b.items[0] && b.items[0].exId);
    const s = Object.assign({
      id: ui.uid(), title, createdAt: Date.now(), source: 'template', muscles, blocks,
      warmup: warmupFor(new Set(muscles), kinds, fb ? A.exById(fb.items[0].exId).n : null),
      warmupSec: kinds.size === 1 && kinds.has('cardio') ? 480 : 420, cooldown: COOLDOWN, cooldownSec: 180, notes: [],
    }, extra);
    s.estMin = Math.round(sessionSeconds(s) / 60);
    return s;
  }
  function refresh(s) {
    s.muscles = musclesOf(s.blocks);
    s.estMin = Math.round(sessionSeconds(s) / 60);
    return s;
  }

  A.gen = {
    GOALS, LEVELS, LEVEL_NAMES, MOD, C, COOLDOWN, generate, alternatives, applySwap, I, B, S, refresh, warmupFor,
    itemSeconds, blockSeconds, sessionSeconds, cardioSeconds, repsAvg, repsTop, repsLow,
  };

  // ---------- Progression : historique, charges suggérées, volume ----------
  const prog = A.prog = {};
  const LOWER = ['quadriceps', 'fessiers', 'ischios', 'lombaires', 'adducteurs'];

  prog.entriesFor = exId => {
    const out = [];
    A.store.data.history.forEach(h => (h.exercises || []).forEach(e => {
      if (e.exId === exId && e.sets && e.sets.length) out.push({ date: h.date, sets: e.sets, hid: h.id });
    }));
    return out.sort((a, b) => b.date - a.date);
  };
  prog.last = exId => prog.entriesFor(exId)[0] || null;
  prog.bestE1RM = (exId, before) => {
    let best = 0;
    A.store.data.history.forEach(h => {
      if (before && h.date >= before) return;
      (h.exercises || []).forEach(e => { if (e.exId === exId) e.sets.forEach(s => { best = Math.max(best, A.e1rm(s.w, s.r)); }); });
    });
    return Math.round(best * 10) / 10;
  };
  prog.bestReps = (exId, before) => {
    let best = 0;
    A.store.data.history.forEach(h => {
      if (before && h.date >= before) return;
      (h.exercises || []).forEach(e => { if (e.exId === exId) e.sets.forEach(s => { if (!s.w) best = Math.max(best, s.r || 0); }); });
    });
    return best;
  };
  prog.orm = exId => Number(A.store.data.profile.orm[exId]) || prog.bestE1RM(exId) || 0;

  prog.suggest = function (it, setIdx = 0) {
    const ex = A.exById(it.exId);
    if (!ex) return null;
    if (it.setW && it.setW[setIdx] != null) return { w: it.setW[setIdx], why: 'Charge prévue par le plan' };
    const orm = prog.orm(it.exId);
    if (it.pct && orm) return { w: A.round25(orm * it.pct), why: `${Math.round(it.pct * 100)} % de ton 1RM (${ui.num(orm, 1)} kg)` };
    if (it.pct && !orm) return { why: `${Math.round(it.pct * 100)} % de ton 1RM — renseigne ton 1RM pour le calcul automatique` };
    const last = prog.last(it.exId);
    if (last) {
      const ws = last.sets.filter(s => s.w > 0);
      const summary = last.sets.map(s => (s.w ? ui.num(s.w, 1) + ' × ' : '') + s.r).join(', ');
      if (ex.hold) return { why: `Dernière fois : ${last.sets.map(s => s.r + ' s').join(', ')}` };
      if (!ws.length) {
        const best = Math.max(...last.sets.map(s => s.r || 0));
        return { r: best + 1, why: `Dernière fois : ${summary} reps — vise +1 rep` };
      }
      const w = Math.max(...ws.map(s => s.w));
      const top = repsTop(it.reps);
      const hit = ws.filter(s => s.w === w).every(s => s.r >= top);
      const inc = (ex.t === 'iso' || ex.t === 'core') ? 1 : ex.m.some(m => LOWER.includes(m)) ? 5 : 2.5;
      return hit
        ? { w: w + inc, why: `${top} reps atteintes partout la dernière fois → +${ui.num(inc, 1)} kg` }
        : { w, why: `Dernière fois : ${summary} — même charge, vise +1 rep` };
    }
    if (it.pctRange && orm) {
      const pct = (it.pctRange[0] + it.pctRange[1]) / 2;
      return { w: A.round25(orm * pct), why: `≈ ${Math.round(pct * 100)} % de ton 1RM estimé (${ui.num(orm, 1)} kg)` };
    }
    return null;
  };

  // Séries par muscle sur une période (1 pour un muscle principal, 0,5 pour un secondaire)
  prog.muscleSets = (from, to = Infinity) => {
    const out = {};
    Object.keys(MUS).forEach(m => { out[m] = 0; });
    A.store.data.history.forEach(h => {
      if (h.date < from || h.date >= to) return;
      (h.exercises || []).forEach(e => {
        const ex = A.exById(e.exId);
        if (!ex) return;
        const n = e.sets.length;
        ex.m.forEach(m => { if (m in out) out[m] += n; });
        ex.s.forEach(m => { if (m in out) out[m] += n * 0.5; });
      });
    });
    return out;
  };

  // Semaines consécutives avec au moins une séance (série en cours)
  prog.weekStreak = () => {
    const weeks = new Set(A.store.data.history.map(h => ui.startOfWeek(h.date)));
    let w = ui.startOfWeek(Date.now()), n = 0;
    if (!weeks.has(w)) w -= 7 * 864e5; // la semaine en cours n'est pas encore « perdue »
    while (weeks.has(w)) { n++; w = ui.startOfWeek(w - 3 * 864e5); }
    return n;
  };
})(window.A);
