/* Athlos — générateur de séances et logique de progression */
(function (A) {
  'use strict';
  const D = A.DATA, ui = A.ui, MUS = D.MUSCLES;

  const GOALS = {
    force: { n: 'Force', d: '3-5 reps lourdes · repos 3 min', split: { force: 1 } },
    hypertrophie: { n: 'Hypertrophie', d: '6-15 reps proches de l\'échec · repos 1,5-2,5 min', split: { hyper: 1 } },
    endurance: { n: 'Endurance', d: 'Cardio et endurance musculaire', split: null },
    force_hyper: { n: 'Force + Hypertrophie', d: 'Lourd d\'abord, puis volume', split: { force: .4, hyper: .6 } },
    force_endu: { n: 'Force + Endurance', d: 'Profil tactique / hybride', split: { force: .6, cardio: .4 } },
    hyper_endu: { n: 'Hypertrophie + Endurance', d: 'Muscle puis cardio', split: { hyper: .65, cardio: .35 } },
    tout: { n: 'Un peu de tout', d: 'Force, muscle et cardio', split: { force: .3, hyper: .5, cardio: .2 } },
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
    return it.sets * work + Math.max(0, it.sets - 1) * (it.rest || 0) + 60 + (it.ramp || 0);
  }

  // ---------- Supersets (A1 / A2) ----------
  // Exercices consécutifs avec le même it.ss : une série de chaque, puis le repos (it.rest) après la paire
  const SS_REST = 30; // le temps de changer de poste entre A1 et A2
  function runs(items) {
    const out = [];
    items.forEach(it => {
      const last = out[out.length - 1];
      if (it.ss != null && last && last[0].ss === it.ss) last.push(it); else out.push([it]);
    });
    return out;
  }
  function runSeconds(run) {
    if (run.length === 1) return itemSeconds(run[0]);
    const sets = Math.max(...run.map(it => it.sets || 1));
    return run.reduce((s, it, i) => s + (it.sets || 1) * (itemSeconds(it, true) + (i < run.length - 1 ? (it.ssRest ?? SS_REST) : 0)) + (it.ramp || 0), 0)
      + (sets - 1) * (run[run.length - 1].rest || 0) + 90;
  }
  // Repos après la paire : chaque muscle garde au moins le repos prévu entre deux de ses propres séries
  function pairRest(run) {
    run.forEach(it => { if (it.ssRest == null) it.ssRest = SS_REST; });
    const w = run.map(it => itemSeconds(it, true));
    const round = w.reduce((a, b) => a + b, 0) + run.slice(0, -1).reduce((a, it) => a + it.ssRest, 0);
    const need = Math.max(...run.map((it, i) => (it.rest0 ?? it.rest ?? 90) - (round - w[i])));
    const r = ui.clamp(Math.ceil(need / 15) * 15, 45, 150);
    run.forEach(it => { if (it.rest0 == null) it.rest0 = it.rest; it.rest = r; });
  }
  // Paire cassée (exercice retiré ou déplacé) : l'exercice restant reprend son repos normal
  function fixPairs(s) {
    s.blocks.forEach(b => runs(b.items).forEach(r => {
      if (r.length > 1 || r[0].ss == null) return;
      const it = r[0];
      if (it.rest0 != null) it.rest = it.rest0;
      ['ss', 'ssRest', 'rest0'].forEach(k => delete it[k]);
    }));
  }
  // Libellés A1, A2, B1… dans l'ordre de la séance, par clé « bloc-exercice »
  function ssLabels(s) {
    const out = {};
    let n = 0;
    s.blocks.forEach((b, bi) => {
      let ii = 0;
      runs(b.items).forEach(r => {
        if (r.length > 1) {
          const L = String.fromCharCode(65 + (n++ % 26));
          r.forEach((it, k) => { out[`${bi}-${ii + k}`] = { lab: L + (k + 1), next: k < r.length - 1 ? L + (k + 2) : null, first: L + '1' }; });
        }
        ii += r.length;
      });
    });
    return out;
  }

  function blockSeconds(b) {
    if (b.kind === 'circuit') {
      const per = b.items.reduce((s, it) => s + itemSeconds(it, true) + (b.restEx || 0), 0);
      return b.rounds * per + Math.max(0, b.rounds - 1) * (b.restRound || 0) + 60;
    }
    return runs(b.items).reduce((s, r) => s + runSeconds(r), 0);
  }
  function sessionSeconds(s) {
    return (s.warmup && s.warmup.length ? (s.warmupSec || 360) : 0)
      + s.blocks.reduce((t, b) => t + blockSeconds(b), 0)
      + (s.cooldown && s.cooldown.length ? (s.cooldownSec || 180) : 0);
  }

  // ---------- Matériel à charge fixe : haltères, élastiques, gilet ----------
  // Fourchettes de charge (kg) adaptées à un exercice léger, moyen ou lourd
  const DB_RANGE = { L: [2, 12], M: [8, 24], H: [16, 60] };
  const BAND_RANGE = { L: [3, 20], M: [12, 40], H: [30, 90] };
  function fit(ld, ws, R) {
    const [lo, hi] = R[ld || 'M'];
    const ok = ws.filter(w => w >= lo && w <= hi);
    if (ok.length) return { k: 'ok', w: ld === 'H' ? Math.max(...ok) : Math.min(...ok) };
    if (ws.every(w => w > hi)) return { k: 'heavy', w: Math.min(...ws) };
    return { k: 'light', w: Math.max(...ws) };
  }
  function gearFit(ex, gear) {
    if (!gear || !ex) return null;
    if (ex.eq.includes('halteres') && gear.halteres) return Object.assign({ kind: 'db' }, fit(ex.ld, gear.halteres, DB_RANGE));
    if (ex.eq.includes('elastique') && gear.elastique) return Object.assign({ kind: 'band' }, fit(ex.ld, gear.elastique, BAND_RANGE));
    return null;
  }

  // Indique quelle charge utiliser avec mon matériel et adapte les reps quand la charge ne peut pas changer
  function applyGear(s, setupId, eq, gear) {
    const has = new Set(eq || []);
    const kg = w => ui.num(w, 1);
    s.blocks.forEach(b => b.items.forEach(it => {
      if (it.type === 'cardio') return;
      if (it.gearLoad) { it.load = it.baseLoad; it.reps = it.baseReps ?? it.reps; }
      ['fixedW', 'band', 'vest', 'vestOn', 'gearNote', 'gearLoad', 'baseLoad', 'baseReps'].forEach(k => delete it[k]);
      const ex = A.exById(it.exId);
      if (!ex) return;
      const gf = gearFit(ex, gear);
      const set = (load, reps) => {
        it.baseLoad = it.load; it.baseReps = it.reps; it.gearLoad = true;
        it.load = load;
        if (reps && !it.hold) it.reps = reps;
      };
      if (gf && gf.kind === 'db') {
        it.fixedW = gf.w;
        if (gf.k === 'light') {
          set(`Haltères de ${kg(gf.w)} kg`, b.kind === 'force' ? '8-12' : '12-25');
          if (!it.hold) it.gearNote = `Avec ${kg(gf.w)} kg, reste proche de l'échec : descente en 3 s et pause d'1 s en bas.`;
        } else if (gf.k === 'heavy') {
          set(`Haltères de ${kg(gf.w)} kg`, '6-10');
          it.gearNote = `${kg(gf.w)} kg est lourd pour cet exercice : technique stricte avant tout.`;
        } else set(`Haltères de ${kg(gf.w)} kg`);
      } else if (gf && gf.kind === 'band') {
        it.band = gf.w;
        set(ex.id === 'pullup_band' ? `Élastique de ${kg(gf.w)} kg : le plus fort aide le plus, passe au plus léger quand tu fais 8 reps`
          : `Élastique de ${kg(gf.w)} kg${gf.k === 'heavy' ? " : rapproche-toi du point d'ancrage pour réduire la tension" : ''}`);
      } else if (ex.vest && has.has('gilet') && gear && gear.gilet) {
        const v = Math.max(...gear.gilet);
        it.vest = v;
        if (b.kind === 'force') { it.vestOn = true; set(`Avec le gilet lesté (${kg(v)} kg)`); }
        else if (it.hold) set(`Gilet de ${kg(v)} kg pour corser le maintien`);
        else set(`Gilet de ${kg(v)} kg dès que tu dépasses ${repsTop(it.reps)} reps au poids du corps`);
      } else if (ex.bw && ex.heavy && b.kind === 'force' && setupId !== 'salle') {
        set('Sans lest : si tu dépasses 6 reps, descente en 4 s et pause d\'1 s en haut');
      }
    }));
    return s;
  }

  // ---------- Contexte de génération ----------
  function makeCtx(p) {
    const hist = A.store.data.history;
    const recent = new Set();
    hist.slice(0, 2).forEach(h => (h.exercises || []).forEach(e => recent.add(e.exId)));
    const weekAgo = Date.now() - 7 * 864e5;
    const ctx = {
      lvl: LEVELS[p.level] || 2, eq: new Set(p.equipment || []), muscles: new Set(p.muscles || []), weak: p.weak || null, goal: p.goal,
      duration: p.duration, rand: rng(p.seed), used: new Set(), cov: {}, recent, cardio: p.cardio || 'auto', gear: p.gear || null, setup: p.setup,
      hardRecent: hist.filter(h => h.date > weekAgo && (h.cardio || []).some(c => c.hard)).length,
    };
    Object.keys(MUS).forEach(m => { ctx.cov[m] = 0; });
    ctx.fams = new Set();
    // Séries difficiles par séance : au-delà, la fatigue l'emporte sur le gain (repères Schoenfeld, Israetel, Pelland 2024)
    ctx.sets = 0;
    ctx.maxSets = Math.round(8 + (p.duration || 60) * 0.3);
    ctx.use = (ex, sets) => {
      ctx.used.add(ex.id);
      ctx.fams.add(fam(ex));
      ctx.sets += sets;
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
    // Haltères ou élastiques trop lourds pour l'exercice : on préfère autre chose
    const gf = gearFit(ex, ctx.gear);
    if (gf) s += gf.k === 'heavy' ? -5 : gf.k === 'light' ? -1 : 0;
    // Deuxième exercice d'un muscle : un autre angle plutôt qu'une variante du premier (Fonseca 2014, Kassiano 2022)
    if (ctx.fams.has(fam(ex))) s -= 4;
    return s;
  }
  const needScore = (ex, ctx) => ex.m.reduce((s, m) => s + (ctx.muscles.has(m) && ctx.cov[m] < 3 ? 1.5 : 0), 0);
  // Grands groupes d'abord, jambes et pectoraux / dos en tête comme dans une séance classique
  const BIG_ORDER = ['quadriceps', 'pectoraux', 'dorsaux', 'ischios', 'fessiers', 'epaules', 'haut_dos'];
  const bigRank = m => { const i = BIG_ORDER.indexOf(m); return i < 0 ? 99 : i; };
  function orderMuscles(ctx) {
    const order = Object.keys(MUS).filter(m => ctx.muscles.has(m));
    return order.sort((a, b) => ((b === ctx.weak) - (a === ctx.weak)) || ((!!MUS[b].big) - (!!MUS[a].big)) || (bigRank(a) - bigRank(b)));
  }
  // Alterne muscles opposés et haut / bas du corps : les exercices choisis se rangent ensuite en supersets
  // (deux gros mouvements du bas du corps ne s'associent pas : un muscle des jambes appelle un muscle du haut)
  function interleave(list) {
    const out = [], rest = list.slice();
    while (rest.length) {
      const m = rest.shift();
      out.push(m);
      const other = x => MUS[x].g !== MUS[m].g;
      let j = MUS[m].g === 'bas' ? -1 : rest.findIndex(x => (ANTAG[m] || []).includes(x));
      if (j < 0) j = rest.findIndex(other);
      if (j >= 0) out.push(rest.splice(j, 1)[0]);
    }
    return out;
  }
  // Famille d'exercices : même schéma moteur sur les mêmes muscles (rowings entre eux, squat bulgare chargé / au poids du corps…)
  const fam = ex => `${ex.p || ex.t}|${ex.m.slice().sort().join('+')}`;

  // ---------- Ordre des exercices et supersets ----------
  // Muscles opposés : les paires agoniste / antagoniste gardent la performance de chaque série (Robbins et al. 2010)
  const ANTAG = {
    pectoraux: ['dorsaux', 'haut_dos'], dorsaux: ['pectoraux', 'epaules'], haut_dos: ['pectoraux', 'epaules'], epaules: ['dorsaux', 'haut_dos'],
    arriere_epaules: ['pectoraux'], biceps: ['triceps'], triceps: ['biceps'], avant_bras: ['triceps'],
    quadriceps: ['ischios'], ischios: ['quadriceps'], abdos: ['lombaires'], lombaires: ['abdos'],
  };
  const region = ex => (ex.m.some(m => MUS[m].g === 'bas') ? 'bas' : ex.m.every(m => MUS[m].g === 'core') ? 'core' : 'haut');
  const loadsBack = ex => ex.m.includes('lombaires') || ex.s.includes('lombaires');
  function canPair(a, b) {
    // Aucun muscle en commun, sinon la deuxième série perd en qualité
    if (a.m.some(m => b.m.includes(m) || b.s.includes(m)) || b.m.some(m => a.s.includes(m))) return false;
    if (a.t === 'pliom' || b.t === 'pliom') return false;
    // Jamais deux gros mouvements du bas du corps, ni deux exercices qui chargent le bas du dos
    if (a.t === 'comp' && b.t === 'comp' && region(a) === 'bas' && region(b) === 'bas') return false;
    return !(loadsBack(a) && loadsBack(b));
  }
  function pairScore(a, b) {
    let s = 0;
    if (a.m.some(m => (ANTAG[m] || []).some(x => b.m.includes(x)))) s += 4;
    if (region(a) !== region(b)) s += 2;
    if (a.t === b.t || (a.t !== 'comp' && b.t !== 'comp')) s += 1;
    if (a.uni && b.uni) s -= 1;
    return s;
  }
  // Exercice principal, point faible, polyarticulaires, isolation, puis gainage / mollets
  function rank(it) {
    const ex = A.exById(it.exId);
    if (it.role === 'main') return -1;
    if (it.weak) return 0;
    if (ex.t === 'comp') return 1;
    if (ex.t === 'core' || ex.t === 'carry' || ex.m.includes('mollets')) return 3;
    return 2;
  }
  const unpair = it => { if (it.rest0 != null) it.rest = it.rest0; ['ss', 'ssRest', 'rest0'].forEach(k => delete it[k]); };
  // Range les exercices et forme les supersets. Le point faible reste en séries classiques avec son repos complet ;
  // deux mouvements principaux ne s'associent qu'en poussée / tirage du haut du corps (Robbins et al. 2010).
  // limit : nombre maximal de paires ; quand le temps le permet, les premières (polyarticulaires) repassent en séries classiques.
  function arrange(items, limit = Infinity) {
    items.forEach(unpair);
    items.sort((a, b) => rank(a) - rank(b));
    const left = items.splice(0, items.length);
    const pairs = [];
    while (left.length) {
      const it = left.shift();
      items.push(it);
      if (it.weak) continue;
      const ex = A.exById(it.exId), main = it.role === 'main';
      let best = -1, bs = -Infinity;
      left.forEach((o, i) => {
        const eo = A.exById(o.exId);
        if (o.weak || (o.role === 'main') !== main || !canPair(ex, eo)) return;
        if (main && (region(ex) !== 'haut' || region(eo) !== 'haut' || pairScore(ex, eo) < 4)) return;
        const sc = pairScore(ex, eo) - i * 0.3;
        if (sc > bs) { bs = sc; best = i; }
      });
      if (best < 0) continue;
      const o = left.splice(best, 1)[0];
      items.push(o);
      it.ss = o.ss = pairs.length + 1;
      pairRest([it, o]);
      pairs.push([it, o]);
    }
    pairs.slice(0, Math.max(0, pairs.length - limit)).forEach(p => p.forEach(unpair));
    return items;
  }
  // Le moins de supersets possible pour tenir dans le temps : repos complet dès qu'on peut se le permettre
  function settle(kind, items, max) {
    let lim = 0;
    while (lim < 20 && blockSeconds({ kind, items: arrange(items.slice(), lim) }) > max) lim++;
    return arrange(items, lim);
  }

  // ---------- Blocs ----------
  // Durée du bloc une fois les exercices rangés en supersets
  const costOf = (kind, list) => blockSeconds({ kind, items: arrange(list.slice()) });
  // Reps adaptées à mes haltères / élastiques dès le choix de l'exercice, pour que la durée prévue soit juste
  const gearIt = (it, kind, ctx) => { applyGear({ blocks: [{ kind, items: [it] }] }, ctx.setup, ctx.eq, ctx.gear); return it; };

  function buildForce(budget, ctx) {
    const items = [];
    let t = 0;
    const L = ctx.lvl;
    const short = ctx.duration <= 45;
    // Séance mixte : un mouvement lourd puis des polyarticulaires en supersets ; force pure ou tactique : jusqu'à 3 mouvements lourds
    const mixed = ctx.goal === 'tout' || ctx.goal === 'force_hyper';
    const sets = Math.max(3, (L === 1 ? 3 : L === 2 ? 4 : 5) - (short || mixed ? 1 : 0));
    const maxMain = mixed ? (ctx.duration >= 120 ? 2 : 1) : ctx.duration >= 60 ? 3 : ctx.duration >= 45 ? 2 : 1;
    const patterns = new Set();
    for (let k = 0; k < maxMain; k++) {
      const cands = pool(ctx, ex => ex.heavy && ex.pr >= 6 && !patterns.has(ex.p) && ex.m.some(m => ctx.muscles.has(m)));
      // Bonus au mouvement opposé d'un développé ou d'un tirage déjà choisi : les deux s'alterneront
      const opp = ex => items.some(i => { const e = A.exById(i.exId); return region(e) === 'haut' && region(ex) === 'haut' && canPair(e, ex) && pairScore(e, ex) >= 4; });
      const ex = pick(cands, ex => baseScore(ex, ctx) + needScore(ex, ctx) + (ctx.weak && ex.m.includes(ctx.weak) ? 6 : 0) - (ex.bw ? 1 : 0) + (opp(ex) ? 3 : 0), ctx);
      if (!ex) break;
      // Premier mouvement : volume complet ; les suivants une série de moins (Prilepin : 10-20 reps lourdes par mouvement)
      const it = {
        exId: ex.id, sets: k === 0 ? sets : Math.max(3, sets - 1), rest: L === 3 ? 240 : 180, rir: L === 1 ? '2-3' : '1-2', role: 'main', ramp: k === 0 ? (short ? 180 : 240) : 120,
        reps: ex.bw ? '3-6' : (L === 1 ? '5' : '3-5'),
        load: ex.bw ? 'Leste-toi pour rester entre 3 et 6 reps' : '≈ 80-87 % de ton 1RM',
        pctRange: ex.bw ? null : [0.8, 0.87],
      };
      gearIt(it, 'force', ctx);
      const t2 = costOf('force', [...items, it]);
      if (k > 0 && t2 > budget + 60) break;
      items.push(it); t = t2; ctx.use(ex, it.sets); patterns.add(ex.p);
    }
    // Polyarticulaires secondaires, en supersets de muscles opposés (développé + rowing, squat + tractions…)
    let guard = 0;
    while (budget + 120 - t > 120 && ctx.sets + 3 <= ctx.maxSets && guard++ < 10) {
      const cands = pool(ctx, ex => ex.t === 'comp' && ex.m.some(m => ctx.muscles.has(m)) && !(ex.heavy && ex.p === 'hinge' && ex.m.includes('lombaires')));
      const ex = pick(cands, ex => baseScore(ex, ctx) + needScore(ex, ctx) * 2 + (ctx.weak && ex.m.includes(ctx.weak) ? 4 : 0), ctx);
      if (!ex) break;
      const it = gearIt({ exId: ex.id, sets: 3, reps: ex.bw ? (ex.heavy ? '5-8' : '6-12') : '6-8', rest: 150, rir: '2', role: 'acc',
        load: ex.bw ? (ex.heavy ? 'Leste-toi si besoin' : 'Variante assez dure pour rester sous 12 reps : descente en 3 s, pause en bas, sac lesté') : 'Lourd mais propre' }, 'force', ctx);
      const t2 = costOf('force', [...items, it]);
      if (t2 > budget + 120) break;
      items.push(it); t = t2; ctx.use(ex, 3);
    }
    if (!items.length) {
      // Aucun mouvement lourd dispo (ex. bras seuls) : force relative sur les meilleurs exercices
      for (const m of orderMuscles(ctx)) {
        if (budget - t < 200) break;
        const ex = pick(pool(ctx, e => e.m.includes(m) && e.t !== 'pliom' && !e.hold), e => baseScore(e, ctx), ctx);
        if (!ex) continue;
        const it = gearIt({ exId: ex.id, sets: 4, reps: '5-8', rest: 150, rir: '1-2', role: 'acc' }, 'force', ctx);
        const t2 = costOf('force', [...items, it]);
        if (t2 > budget + 120) continue;
        items.push(it); t = t2; ctx.use(ex, 4);
      }
    }
    settle('force', items, Math.max(t, budget + 120));
    return { kind: 'force', title: 'Bloc force', items, note: 'Séries lourdes et repos longs : la qualité de chaque répétition prime.' };
  }

  function hyperItem(ex, m, ctx) {
    const L = ctx.lvl;
    const small = ['mollets', 'abdos', 'obliques', 'avant_bras', 'trapezes'].includes(m);
    let it;
    if (ex.hold) it = { exId: ex.id, sets: 3, hold: ex.t === 'carry' ? 40 : 20 + L * 10, rest: 60, rir: '1-2' };
    else if (ex.t === 'comp' && !small) it = { exId: ex.id, sets: 3, reps: ex.bw ? '8-15' : '6-10', rest: 120, rir: L === 1 ? '2-3' : '1-2' };
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
    const order = interleave(orderMuscles(ctx).sort((a, b) => ((b === ctx.weak) - (a === ctx.weak)) || (start[a] - start[b])));
    const cap = m => (m === ctx.weak ? 12 : MUS[m].big ? 9 : 6);
    // 1er passage : un exercice pour chaque muscle pas encore travaillé ; ensuite, du volume en plus sous un autre angle
    const passes = [order, order.filter(m => m === ctx.weak || MUS[m].big), order, order];
    const max = budget + 90;
    outer:
    for (const [pi, pass] of passes.entries()) {
      for (const m of pass) {
        if (max - t < 120 || ctx.sets + 2 > ctx.maxSets) break outer;
        if (ctx.cov[m] >= cap(m) || (pi === 0 && ctx.cov[m] >= 3)) continue;
        const wantComp = ctx.cov[m] < 1 && MUS[m].big;
        const cands = pool(ctx, ex => ex.m.includes(m) && ex.t !== 'pliom' && !(ex.heavy && ex.p === 'hinge' && ex.m.includes('lombaires')));
        const ex = pick(cands, ex => baseScore(ex, ctx) + (ex.str ? 3 : 0)
          + (wantComp ? (ex.t === 'comp' ? 4 : 0) : (ex.t === 'iso' ? 2 : 0)) + (ex.m[0] === m ? 1.5 : 0), ctx);
        if (!ex) continue;
        const it = gearIt(hyperItem(ex, m, ctx), 'hyper', ctx);
        if (ctx.sets + it.sets > ctx.maxSets) it.sets = 2;
        let t2 = costOf('hyper', [...items, it]);
        if (t2 > max && it.sets > 2) { it.sets = 2; t2 = costOf('hyper', [...items, it]); }
        if (t2 > max) continue;
        items.push(it); t = t2; ctx.use(ex, it.sets);
      }
    }
    settle('hyper', items, max);
    return { kind: 'hyper', title: title || 'Bloc hypertrophie', items };
  }

  function buildCircuit(budget, ctx) {
    const items = [];
    // Une station par muscle (8 au plus), sans deux variantes du même mouvement
    for (const m of orderMuscles(ctx)) {
      if (items.length >= 8) break;
      if (ctx.cov[m] >= 3) continue;
      const cands = pool(ctx, ex => ex.m.includes(m) && (!ex.heavy || ex.bw) && !ctx.fams.has(fam(ex)));
      const ex = pick(cands, ex => baseScore(ex, ctx) + (ex.bw ? 2 : 0) + (ex.t === 'comp' ? 2 : 0) + (ex.t === 'pliom' ? 1 : 0) - (ex.eq.includes('machine') ? 2 : 0), ctx);
      if (!ex) continue;
      // Tractions, dips… : 15-20 reps n'est pas réaliste, on reste sous le maximum
      items.push(ex.hold ? { exId: ex.id, hold: 30 } : { exId: ex.id, reps: ex.t === 'pliom' ? '12-15' : ex.heavy ? '6-12' : '15-20' });
      ctx.use(ex, 3);
    }
    const restEx = ctx.lvl === 1 ? 30 : 20, restRound = 90;
    const b = { kind: 'circuit', title: 'Circuit endurance musculaire', items, restEx, restRound, rounds: 2, note: 'Enchaîne les exercices avec peu de repos, récupère entre les tours.' };
    if (!items.length) return b;
    // Au moins 2 tours : avec peu de temps, moins de stations
    while (items.length > 4 && blockSeconds(b) > budget + 120) items.pop();
    b.rounds = 1;
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
        if (min - 26 >= 8) items.push(C.z2(mod, min - 26));
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
  // first : premier exercice lourd (objet exercice), pour les séries de montée en charge
  function warmupFor(muscles, kinds, first) {
    const has = g => [...muscles].some(m => MUS[m] && MUS[m].g === g);
    const lifting = kinds.has('force') || kinds.has('hyper') || kinds.has('circuit');
    const list = [{ n: 'Élever la température', d: lifting ? '3-5 min de cardio léger (vélo, rameur, corde, footing) en accélérant doucement' : '8-10 min très facile, en accélérant progressivement' }];
    if (has('bas')) list.push({ n: 'Mobilité hanches et jambes', d: 'Balancés de jambes ×10/côté, squats lents ×8, fentes avec rotation ×5/côté' });
    if (has('haut') || has('bras')) list.push({ n: 'Mobilité épaules', d: 'Cercles de bras ×10, band pull-apart ou W au mur ×15, pompes scapulaires ×10' });
    if (lifting) list.push({ n: 'Activation du tronc', d: 'Dead bug ×6/côté, bird dog ×6/côté' });
    if (kinds.has('cardio') && !lifting) list.push({ n: 'Gammes', d: 'Montées de genoux, talons-fesses, pas chassés (2 × 20 m), puis 2-3 accélérations progressives' });
    if (first) list.push({ n: 'Montée en charge', d: first.bw
      ? `${first.n} : 2 séries faciles de 3-5 reps, loin de l'échec, avant les séries de travail`
      : `${first.n} : séries progressives (≈ 50 % × 8, 70 % × 4, 85 % × 2) avant les séries de travail` });
    return list;
  }
  const COOLDOWN = [
    { n: 'Retour au calme', d: '2-3 min de marche ou de vélo très facile, respiration lente par le nez' },
    { n: 'Mobilité légère (facultatif)', d: '20-30 s par muscle travaillé, sans forcer : pour le confort, pas pour éviter les courbatures' },
  ];

  function notesFor(ctx, kinds) {
    const n = [];
    if (kinds.has('force')) n.push("Force : charges lourdes (≈ 80-87 % du max), 3-5 reps, 1-3 reps en réserve et ~3 min de repos (Prilepin ; Schoenfeld et al. 2016).");
    if (kinds.has('hyper')) n.push("Hypertrophie : 6-15 reps proches de l'échec, variantes en position étirée privilégiées, ~2 min de repos sur les polyarticulaires (Schoenfeld et al. 2017 ; Maeo et al. 2021-2023 ; Singer et al. 2024).");
    if (kinds.has('hyper') || kinds.has('force')) n.push("Plusieurs exercices par grand muscle, sous des angles différents (presse + écarté, tirage vertical + rowing…) : la variation des exercices développe mieux toutes les portions du muscle (Fonseca et al. 2014 ; Kassiano et al. 2022).");
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
    const p = Object.assign({ duration: 60, goal: 'hypertrophie', muscles: [], weak: null, equipment: A.ALL_EQ, level: 'inter', cardio: 'auto', setup: 'salle' }, input);
    p.seed = p.seed || Math.floor(Math.random() * 1e9);
    if (p.gear === undefined) p.gear = A.gearFor(p.setup, p.equipment);
    p.muscles = p.muscles.slice();
    if (!p.muscles.length && p.goal !== 'endurance') p.muscles = D.PRESETS[0].m.slice();
    if (p.weak && !p.muscles.includes(p.weak)) p.muscles.unshift(p.weak);
    const ctx = makeCtx(p);
    const split = p.goal === 'endurance' ? (p.muscles.length ? { circuit: .5, cardio: .5 } : { cardio: 1 }) : GOALS[p.goal].split;
    const kinds = Object.keys(split);
    const pureCardio = kinds.length === 1 && kinds[0] === 'cardio';
    const total = p.duration * 60;
    const warmupSec = pureCardio ? 480 : p.duration <= 30 ? 300 : p.duration <= 45 ? 360 : p.duration <= 60 ? 420 : 540;
    const coolSec = pureCardio ? 300 : p.duration <= 45 ? 120 : 180;
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
    if (blocks.some(b => b.items.some(it => it.ss != null))) notes.push("Supersets A1/A2 : deux exercices de muscles opposés ou non concurrents, enchaînés. Chaque muscle garde son repos complet, la performance est la même qu'en séries classiques et la séance contient beaucoup plus d'exercices dans le même temps (Robbins et al. 2010 ; Weakley et al. 2017 ; Iversen et al. 2021). Exercice principal et point faible restent en séries classiques.");
    const first = blocks[0] && blocks[0].kind === 'force' && blocks[0].items[0] ? A.exById(blocks[0].items[0].exId) : null;
    // Muscles non travaillés : faute de matériel, ou faute de temps
    const uncovered = p.muscles.filter(m => ctx.cov[m] === 0);
    const noGear = uncovered.filter(m => !A.exList().some(ex => ex.m.includes(m) && ex.t !== 'mob' && ex.eq.every(e => ctx.eq.has(e)) && (ex.lvl || 1) <= ctx.lvl));
    const session = {
      id: ui.uid(), title: titleFor(p.goal, p.muscles), createdAt: Date.now(), source: 'quiz', params: p, goal: p.goal,
      muscles: p.muscles, weak: p.weak, warmup: warmupFor(ctx.muscles, new Set(kinds), first), warmupSec,
      blocks, cooldown: COOLDOWN, cooldownSec: coolSec, notes,
      missing: noGear, skipped: uncovered.filter(m => !noGear.includes(m)),
      setup: p.setup, eq: p.equipment.slice(), gear: p.gear,
    };
    applyGear(session, p.setup, p.equipment, p.gear);
    session.estMin = Math.round(sessionSeconds(session) / 60);
    return session;
  }

  // Exercices de remplacement : mêmes muscles, même mouvement si possible, avec le matériel disponible
  function alternatives(item, session, eq, gear) {
    const ex = A.exById(item.exId);
    if (!ex) return [];
    const P = A.store.data.profile;
    const inSession = new Set(session.blocks.flatMap(b => b.items.map(i => i.exId)).filter(Boolean));
    const eqSet = new Set(eq || session.eq || P.equipment);
    const g = gear !== undefined ? gear : (session.setup ? session.gear : A.gearFor(P.setup, [...eqSet]));
    const sim = e => {
      const gf = gearFit(e, g);
      return e.pr + (e.t === ex.t ? 3 : 0) + (e.p && e.p === ex.p ? 4 : 0) + e.m.filter(m => ex.m.includes(m)).length * 2
        + (e.m[0] === ex.m[0] ? 2 : 0) + (!!e.hold === !!ex.hold ? 1 : -2) + (gf ? (gf.k === 'heavy' ? -6 : gf.k === 'light' ? -1 : 0) : 0);
    };
    return A.exList()
      .filter(e => e.id !== ex.id && !inSession.has(e.id) && e.t !== 'mob' && e.m.some(m => ex.m.includes(m)) && e.eq.every(q => eqSet.has(q)))
      .sort((a, b) => sim(b) - sim(a));
  }

  // Adapte une séance existante (séance type, plan, favori…) au matériel que j'ai avec moi
  function adapt(s, setupId, eq) {
    const gear = A.gearFor(setupId, eq);
    const eqSet = new Set(eq);
    if (!s.orig) s.orig = ui.clone(s.blocks);
    s.blocks = ui.clone(s.orig);
    s.setup = setupId; s.eq = eq.slice(); s.gear = gear;
    let swapped = 0, removed = 0;
    s.blocks.forEach(b => {
      b.items = b.items.filter(it => {
        if (it.type === 'cardio') return true;
        const ex = A.exById(it.exId);
        if (!ex) return false;
        if (ex.eq.every(e => eqSet.has(e))) return true;
        const alt = alternatives(it, s, eq, gear)[0];
        if (alt) { applySwap(it, alt.id); swapped++; return true; }
        removed++;
        return false;
      });
    });
    s.blocks = s.blocks.filter(b => b.items.length);
    applyGear(s, setupId, eq, gear);
    const pl = n => (n > 1 ? 's' : '');
    s.adaptNote = swapped || removed ? `Adaptée à ton matériel : ${swapped} exercice${pl(swapped)} remplacé${pl(swapped)}${removed ? `, ${removed} retiré${pl(removed)}` : ''}.` : null;
    return refresh(s);
  }
  // Recalcule les charges après une modification (remplacement, ajout d'exercice)
  const regear = s => applyGear(s, s.setup || A.store.data.profile.setup, s.eq || A.store.data.profile.equipment, s.setup ? s.gear : A.gearFor(A.store.data.profile.setup, A.store.data.profile.equipment));

  function applySwap(item, newId) {
    const ex = A.exById(newId);
    if (item.gearLoad) { item.load = item.baseLoad; item.reps = item.baseReps ?? item.reps; }
    ['fixedW', 'band', 'vest', 'vestOn', 'gearNote', 'gearLoad', 'baseLoad', 'baseReps'].forEach(k => delete item[k]);
    item.exId = newId;
    delete item.pct; delete item.setW; delete item.pctRange;
    if (item.load && /1RM|Leste/.test(item.load)) delete item.load;
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
      warmup: warmupFor(new Set(muscles), kinds, fb ? A.exById(fb.items[0].exId) : null),
      warmupSec: kinds.size === 1 && kinds.has('cardio') ? 480 : 420, cooldown: COOLDOWN, cooldownSec: 180, notes: [],
    }, extra);
    blocks.forEach(b => { if (b.kind !== 'circuit') runs(b.items).forEach(r => { if (r.length > 1) pairRest(r); }); });
    s.estMin = Math.round(sessionSeconds(s) / 60);
    return s;
  }
  function refresh(s) {
    fixPairs(s);
    s.muscles = musclesOf(s.blocks);
    s.estMin = Math.round(sessionSeconds(s) / 60);
    return s;
  }

  A.gen = {
    GOALS, LEVELS, LEVEL_NAMES, MOD, C, COOLDOWN, generate, alternatives, applySwap, adapt, applyGear, regear, gearFit, I, B, S, refresh, warmupFor,
    itemSeconds, blockSeconds, sessionSeconds, cardioSeconds, repsAvg, repsTop, repsLow, runs, ssLabels,
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
    // Matériel à charge fixe : on progresse en reps puis en tempo, pas en kilos
    if (it.fixedW || it.band) {
      const last = prog.last(it.exId), top = repsTop(it.reps);
      const reps = last ? last.sets.map(x => x.r).join(', ') : '';
      const what = it.fixedW ? `haltères de ${ui.num(it.fixedW, 1)} kg` : `élastique de ${ui.num(it.band, 1)} kg`;
      if (last && !ex.hold && last.sets.every(x => x.r >= top)) return { w: it.fixedW, why: `${top} reps atteintes partout la dernière fois : garde tes ${what} et ralentis la descente (3-4 s)` };
      return { w: it.fixedW, why: `Tes ${what}${last ? ` · dernière fois ${reps}${ex.hold ? ' s' : ' reps'}` : ''} : vise +1 rep` };
    }
    if (it.vestOn) return { w: it.vest, why: `Gilet lesté de ${ui.num(it.vest, 1)} kg` };
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
