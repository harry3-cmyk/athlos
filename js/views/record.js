/* Athlos — « Enregistrer » : choix, questionnaire, séances types, activité libre */
(function (A) {
  'use strict';
  const ui = A.ui, D = A.DATA, G = A.gen;

  A.views.record = function (el) {
    const opts = [
      { href: '#/record/quiz', icon: 'sparkle', t: 'Crée ma séance', d: "Temps disponible, objectif, zones du corps, point faible : Athlos construit la séance optimale.", tag: 'Recommandé' },
      { href: '#/record/know', icon: 'list', t: 'Je sais ce que je veux faire', d: 'Séances types, construction libre ou séance passée à refaire.' },
      { href: '#/improve', icon: 'target', t: "M'améliorer sur un exercice", d: 'Développé couché, tractions, squat, Luc Léger… un plan de 6 semaines ciblé.' },
      { href: '#/record/manual', icon: 'run', t: 'Ajouter une activité', d: "Course, vélo, sport collectif… faite sans l'app, pour garder un suivi complet." },
    ];
    el.innerHTML = `<div class="page-head"><h1>Enregistrer</h1></div>
      <p class="muted mb">Que veux-tu faire aujourd'hui ?</p>
      <div class="stack">${opts.map(o => `<a class="card link" href="${o.href}"><div class="row gap"><div class="fc-icon">${ui.icon(o.icon)}</div>
        <div class="grow"><div class="row gap-s wrap"><span class="fc-title">${o.t}</span>${o.tag ? `<span class="tag accent">${o.tag}</span>` : ''}</div><p class="small muted mt-s">${o.d}</p></div>${ui.icon('right')}</div></a>`).join('')}</div>`;
  };

  // ———————————————— Questionnaire ————————————————
  const TIMES = [[30, '30 min'], [45, '45 min'], [60, '1 h'], [75, '1 h 15'], [90, '1 h 30'], [120, '2 h']];
  const MIXES = ['force_hyper', 'force_endu', 'hyper_endu'];

  A.views.quiz = function (el) {
    const d = A.store.data, P = d.profile;
    const q = Object.assign({ duration: 60, goal: null, muscles: [], weak: null, equipment: P.equipment.slice(), level: P.level, cardio: P.cardio || 'auto' }, ui.clone(d.lastQuiz || {}));
    let step = 0;
    const N = 5;
    const usesCardio = () => ['endurance', 'force_endu', 'hyper_endu', 'tout'].includes(q.goal);

    function render() {
      const canNext = step !== 1 || !!q.goal;
      el.innerHTML = `<div class="page-head"><a class="back" href="#/record" aria-label="Retour">${ui.icon('left')}</a><h1>Crée ma séance</h1></div>
        <div class="steps">${Array.from({ length: N }, (_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>
        <div data-step></div>
        <div class="quiz-nav">
          ${step > 0 ? `<button class="btn" data-prev>${ui.icon('left')} Retour</button>` : ''}
          ${step < N - 1 ? `<button class="btn primary grow" data-next ${canNext ? '' : 'disabled'}>Continuer ${ui.icon('right')}</button>`
            : `<button class="btn primary grow" data-go>${ui.icon('sparkle')} Générer ma séance</button>`}
        </div>`;
      const box = el.querySelector('[data-step]');
      [stepTime, stepGoal, stepZones, stepWeak, stepGear][step](box);
      const prev = el.querySelector('[data-prev]'), next = el.querySelector('[data-next]'), go = el.querySelector('[data-go]');
      if (prev) prev.onclick = () => { step--; render(); window.scrollTo(0, 0); };
      if (next) next.onclick = () => { step++; render(); window.scrollTo(0, 0); };
      if (go) go.onclick = generate;
    }

    function stepTime(box) {
      box.innerHTML = `<div class="quiz-q"><h2>Combien de temps as-tu ?</h2><p class="muted">Échauffement et retour au calme compris.</p></div>
        <div class="time-grid">${TIMES.map(([v, l]) => `<button class="opt big ${q.duration === v ? 'on' : ''}" data-v="${v}"><span class="opt-t">${l}</span></button>`).join('')}</div>`;
      box.onclick = e => { const b = e.target.closest('[data-v]'); if (b) { q.duration = Number(b.dataset.v); step++; render(); } };
    }

    function stepGoal(box) {
      const isMix = MIXES.includes(q.goal) || q.goal === 'mixte';
      const card = (id, t, dsc, on) => `<button class="opt ${on ? 'on' : ''}" data-g="${id}"><span class="opt-t">${t}</span><span class="opt-d">${dsc}</span></button>`;
      box.innerHTML = `<div class="quiz-q"><h2>Quel est ton objectif ?</h2><p class="muted">Il fixe les charges, les répétitions et les temps de repos.</p></div>
        <div class="grid2">
          ${card('force', 'Force', G.GOALS.force.d, q.goal === 'force')}
          ${card('hypertrophie', 'Hypertrophie', G.GOALS.hypertrophie.d, q.goal === 'hypertrophie')}
          ${card('endurance', 'Endurance', 'Cardio, intervalles, endurance musculaire', q.goal === 'endurance')}
          ${card('mixte', 'Mixte', 'Combiner deux objectifs', isMix)}
        </div>
        ${isMix ? `<div class="chips mt">${MIXES.map(m => `<button class="chip ${q.goal === m ? 'on' : ''}" data-g="${m}">${G.GOALS[m].n}</button>`).join('')}</div>` : ''}
        <div class="mt">${card('tout', 'Un peu de tout', 'Force, hypertrophie et cardio dans la même séance', q.goal === 'tout')}</div>`;
      box.onclick = e => {
        const b = e.target.closest('[data-g]'); if (!b) return;
        const g = b.dataset.g;
        if (g === 'mixte') { q.goal = MIXES.includes(q.goal) ? q.goal : 'mixte'; render(); return; }
        q.goal = g;
        if (!MIXES.includes(g)) { step++; }
        render();
      };
      if (q.goal === 'mixte') { const n = el.querySelector('[data-next]'); if (n) n.disabled = true; }
    }

    function stepZones(box) {
      const sel = new Set(q.muscles);
      box.innerHTML = `<div class="quiz-q"><h2>Que veux-tu travailler ?</h2><p class="muted">Touche les muscles sur le corps, ou choisis un raccourci.${q.goal === 'endurance' ? ' Pour une séance 100 % cardio, ne sélectionne rien.' : ''}</p></div>
        <div class="chips" data-presets>${D.PRESETS.map(p => `<button class="chip ${p.m.length === sel.size && p.m.every(m => sel.has(m)) ? 'on' : ''}" data-p="${p.id}">${p.n}</button>`).join('')}
          <button class="chip" data-clear>${ui.icon('x', 'sm')} Effacer</button></div>
        <div class="card mt" data-body></div>
        <div class="chips mt" data-sel></div>`;
      const body = box.querySelector('[data-body]');
      const draw = () => {
        A.body(body, { selected: sel, onToggle: m => { sel.has(m) ? sel.delete(m) : sel.add(m); sync(); } });
        box.querySelector('[data-sel]').innerHTML = sel.size ? [...sel].map(m => `<button class="chip on" data-rm="${m}">${A.mName(m)} ${ui.icon('x', 'sm')}</button>`).join('')
          : `<span class="small muted">${q.goal === 'endurance' ? 'Aucun muscle : séance cardio pure.' : 'Aucun muscle choisi : full body par défaut.'}</span>`;
        box.querySelectorAll('[data-p]').forEach(c => { const p = D.PRESETS.find(x => x.id === c.dataset.p); c.classList.toggle('on', p.m.length === sel.size && p.m.every(m => sel.has(m))); });
      };
      const sync = () => { q.muscles = Object.keys(D.MUSCLES).filter(m => sel.has(m)); if (q.weak && !sel.has(q.weak)) q.weak = null; draw(); };
      box.querySelector('[data-presets]').onclick = e => {
        if (e.target.closest('[data-clear]')) { sel.clear(); sync(); return; }
        const b = e.target.closest('[data-p]'); if (!b) return;
        sel.clear(); D.PRESETS.find(x => x.id === b.dataset.p).m.forEach(m => sel.add(m)); sync();
      };
      box.querySelector('[data-sel]').onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { sel.delete(b.dataset.rm); sync(); } };
      draw();
    }

    function stepWeak(box) {
      const order = [...q.muscles, ...Object.keys(D.MUSCLES).filter(m => !q.muscles.includes(m))];
      const tip = q.weak && D.MUSCLES[q.weak].tip;
      box.innerHTML = `<div class="quiz-q"><h2>Un point faible à prioriser ?</h2><p class="muted">Il passera en premier, avec plus de volume. Facultatif.</p></div>
        <div class="chips"><button class="chip ${!q.weak ? 'on' : ''}" data-w="">Aucun</button>
          ${order.map(m => `<button class="chip warn ${q.weak === m ? 'on' : ''}" data-w="${m}">${A.mName(m)}</button>`).join('')}</div>
        ${tip ? `<div class="note mt">${ui.icon('flask')}<span><b>${A.mName(q.weak)} :</b> ${ui.esc(tip)}</span></div>` : ''}
        <div class="card mt" data-body></div>`;
      A.body(box.querySelector('[data-body]'), { selected: new Set(q.muscles), weak: q.weak, onToggle: m => { q.weak = q.weak === m ? null : m; render(); } });
      box.querySelector('.chips').onclick = e => { const b = e.target.closest('[data-w]'); if (!b) return; q.weak = b.dataset.w || null; render(); };
    }

    function stepGear(box) {
      const eq = new Set(q.equipment);
      box.innerHTML = `<div class="quiz-q"><h2>Matériel et niveau</h2><p class="muted">Les exercices s'adaptent à ce que tu as sous la main.</p></div>
        <h3>Où t'entraînes-tu ?</h3>
        <div class="chips mt-s" data-eqp>${D.EQUIP_PRESETS.map(p => `<button class="chip ${p.eq.length === eq.size && p.eq.every(x => eq.has(x)) ? 'on' : ''}" data-p="${p.id}">${p.n}</button>`).join('')}</div>
        <div class="chips mt-s" data-eq>${Object.entries(D.EQUIP).map(([k, n]) => `<button class="chip ${eq.has(k) ? 'on' : ''}" data-e="${k}">${eq.has(k) ? ui.icon('check', 'sm') : ''}${n}</button>`).join('')}</div>
        <h3 class="mt-l">Ton niveau</h3>
        <div class="seg mt-s" data-lvl>${Object.entries(G.LEVEL_NAMES).map(([k, n]) => `<button class="${q.level === k ? 'on' : ''}" data-l="${k}">${n}</button>`).join('')}</div>
        <p class="tiny faint mt-s">Débutant : moins d'un an de pratique régulière. Avancé : plusieurs années et des charges solides.</p>
        ${usesCardio() ? `<h3 class="mt-l">Cardio</h3><div class="seg mt-s" data-cardio>${[['auto', 'Au choix'], ['course', 'Course'], ['velo', 'Vélo / rameur'], ['circuit', 'Circuit']].map(([k, n]) => `<button class="${q.cardio === k ? 'on' : ''}" data-c="${k}">${n}</button>`).join('')}</div>` : ''}
        <div class="note mt-l">${ui.icon('info')}<span>Récapitulatif : <b>${TIMES.find(t => t[0] === q.duration)[1]}</b> · <b>${G.GOALS[q.goal] ? G.GOALS[q.goal].n : '—'}</b> · ${q.muscles.length ? q.muscles.map(A.mName).join(', ') : (q.goal === 'endurance' ? 'cardio pur' : 'full body')}${q.weak ? ` · priorité <b>${A.mName(q.weak)}</b>` : ''}</span></div>`;
      box.querySelector('[data-eqp]').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; q.equipment = D.EQUIP_PRESETS.find(p => p.id === b.dataset.p).eq.slice(); render(); };
      box.querySelector('[data-eq]').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; const k = b.dataset.e; eq.has(k) ? eq.delete(k) : eq.add(k); q.equipment = [...eq]; render(); };
      box.querySelector('[data-lvl]').onclick = e => { const b = e.target.closest('[data-l]'); if (b) { q.level = b.dataset.l; render(); } };
      const c = box.querySelector('[data-cardio]');
      if (c) c.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { q.cardio = b.dataset.c; render(); } };
    }

    function generate() {
      if (!G.GOALS[q.goal]) { step = 1; render(); return; }
      d.lastQuiz = ui.clone(q);
      A.store.save();
      A.state.draft = G.generate(q);
      A.state.written = false;
      A.app.go('#/session');
    }

    render();
  };

  // ———————————————— « Je sais ce que je veux faire » ————————————————
  A.views.sessionFromHistory = h => {
    const items = (h.exercises || []).map(e => {
      const reps = e.sets.map(s => s.r).filter(Boolean);
      const lo = Math.min(...reps), hi = Math.max(...reps);
      const ex = A.exById(e.exId);
      if (ex && ex.hold) return G.I(e.exId, e.sets.length, hi || 30, 60);
      return G.I(e.exId, e.sets.length, reps.length ? (lo === hi ? String(hi) : `${lo}-${hi}`) : '8-12', 120);
    }).filter(it => A.exById(it.exId));
    const blocks = [];
    if (items.length) blocks.push(G.B('hyper', 'Séance', items));
    (h.cardio || []).forEach(c => blocks.push(G.B('cardio', 'Cardio', [{ type: 'cardio', id: 'rep', name: c.name, protocol: 'steady', duration: c.durationSec, intensity: c.hard ? 'Intense' : 'Facile', hard: !!c.hard, mod: 'course' }])));
    return G.S(h.title, blocks, { source: 'repeat', goal: h.goal });
  };

  A.views.know = function (el) {
    const d = A.store.data;
    const cats = [...new Set(D.TEMPLATES.map(t => t.cat))];
    const recent = d.history.filter(h => h.exercises && h.exercises.length).slice(0, 5);
    el.innerHTML = `<div class="page-head"><a class="back" href="#/record" aria-label="Retour">${ui.icon('left')}</a><h1>Ma séance</h1></div>
      <button class="card link block" data-build style="width:100%;text-align:left"><div class="row gap"><div class="fc-icon">${ui.icon('edit')}</div>
        <div class="grow"><div class="fc-title">Construire ma séance</div><p class="small muted">Choisis tes exercices un par un, règle séries, reps et repos.</p></div>${ui.icon('plus')}</div></button>
      ${d.favorites.length ? `<div class="section-title"><h2>Mes séances</h2></div><div class="stack">${d.favorites.map((f, i) => `<div class="card row gap"><div class="grow"><div class="fc-title">${ui.esc(f.title)}</div>
        <div class="small muted">≈ ${f.estMin} min · ${(f.muscles || []).slice(0, 4).map(A.mName).join(', ')}</div></div>
        <button class="icon-btn" data-delfav="${i}" aria-label="Supprimer">${ui.icon('trash')}</button><button class="btn sm primary" data-fav="${i}">Ouvrir</button></div>`).join('')}</div>` : ''}
      ${recent.length ? `<div class="section-title"><h2>Refaire une séance</h2></div><div class="stack">${recent.map(h => `<div class="card row gap"><div class="grow"><div class="fc-title">${ui.esc(h.title)}</div>
        <div class="small muted">${ui.fmtDate(h.date)} · ${h.exercises.length} exercices</div></div><button class="btn sm" data-repeat="${h.id}">${ui.icon('refresh', 'sm')} Refaire</button></div>`).join('')}</div>` : ''}
      ${cats.map(c => `<div class="section-title"><h2>${c}</h2></div><div class="grid2 md3">${D.TEMPLATES.filter(t => t.cat === c).map(t => `<button class="card link" data-tpl="${t.id}" style="text-align:left">
        <div class="fc-title">${ui.esc(t.n)}</div><p class="small muted mt-s">${ui.esc(t.d)}</p></button>`).join('')}</div>`).join('')}`;

    el.onclick = async e => {
      const t = e.target.closest('[data-tpl],[data-build],[data-fav],[data-repeat],[data-delfav]');
      if (!t) return;
      if (t.dataset.delfav != null) {
        if (await ui.confirm('Supprimer cette séance enregistrée ?', { ok: 'Supprimer', danger: true })) { d.favorites.splice(Number(t.dataset.delfav), 1); A.store.save(); A.views.know(el); }
        return;
      }
      if (t.dataset.tpl) A.state.draft = D.TEMPLATES.find(x => x.id === t.dataset.tpl).build();
      else if (t.dataset.fav != null) { A.state.draft = ui.clone(d.favorites[Number(t.dataset.fav)]); A.state.draft.id = ui.uid(); }
      else if (t.dataset.repeat) A.state.draft = A.views.sessionFromHistory(d.history.find(h => h.id === t.dataset.repeat));
      else { A.state.draft = G.S('Ma séance', [G.B('hyper', 'Exercices', [])], { source: 'custom', goal: 'hypertrophie' }); A.state.openPicker = true; }
      A.state.written = false;
      A.app.go('#/session');
    };
  };

  // ———————————————— Activité libre ————————————————
  const SPORTS = [['course', 'Course à pied', 'run'], ['velo', 'Vélo', 'run'], ['natation', 'Natation', 'run'], ['marche', 'Marche / randonnée', 'run'],
    ['muscu', 'Musculation', 'dumbbell'], ['collectif', 'Sport collectif', 'run'], ['combat', 'Sport de combat', 'flame'], ['mobilite', 'Mobilité / yoga', 'body'], ['autre', 'Autre', 'bolt']];
  A.SPORTS = SPORTS;

  A.views.manual = function (el) {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    let rpe = 6;
    el.innerHTML = `<div class="page-head"><a class="back" href="#/record" aria-label="Retour">${ui.icon('left')}</a><h1>Ajouter une activité</h1></div>
      <div class="card">
        <label class="field"><span>Sport</span><select data-sport>${SPORTS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <label class="field"><span>Titre</span><input data-title placeholder="Ex. Footing du dimanche"></label>
        <div class="grid2"><label class="field"><span>Date et heure</span><input type="datetime-local" data-date value="${local}"></label>
          <label class="field"><span>Durée (minutes)</span><input type="number" min="1" inputmode="numeric" data-dur value="45"></label></div>
        <label class="field"><span>Distance (km, facultatif)</span><input type="number" min="0" step="0.01" inputmode="decimal" data-dist></label>
        <div class="field"><span class="small muted">Effort perçu (1 = très facile, 10 = maximal)</span><div class="rpe-scale mt-s" data-rpe>${Array.from({ length: 10 }, (_, i) => `<button class="${i + 1 === rpe ? 'on' : ''}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div></div>
        <label class="field"><span>Notes</span><textarea data-notes placeholder="Sensations, parcours, météo…"></textarea></label>
        <button class="btn primary xl" data-save>${ui.icon('check')} Enregistrer l'activité</button>
      </div>`;
    el.querySelector('[data-rpe]').onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; rpe = Number(b.dataset.v); el.querySelectorAll('[data-rpe] button').forEach(x => x.classList.toggle('on', x === b)); };
    el.querySelector('[data-save]').onclick = () => {
      const sport = el.querySelector('[data-sport]').value;
      const dur = Number(el.querySelector('[data-dur]').value) || 0;
      if (dur <= 0) { ui.toast('Indique une durée'); return; }
      const date = new Date(el.querySelector('[data-date]').value).getTime() || Date.now();
      const dist = Number(el.querySelector('[data-dist]').value) || null;
      const h = {
        id: ui.uid(), type: 'activite', sport, title: el.querySelector('[data-title]').value.trim() || SPORTS.find(s => s[0] === sport)[1],
        date, durationSec: dur * 60, distance: dist, rpe, notes: el.querySelector('[data-notes]').value.trim(), muscles: [], exercises: [], cardio: [],
        volume: 0, totalSets: 0,
      };
      A.store.data.history.push(h);
      A.store.data.history.sort((a, b) => b.date - a.date);
      A.store.save();
      ui.toast('Activité enregistrée');
      location.hash = '#/history/' + h.id;
    };
  };
})(window.A);
