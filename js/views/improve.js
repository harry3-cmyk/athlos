/* Athlos — « M'améliorer sur un exercice » : plans de 6 semaines */
(function (A) {
  'use strict';
  const ui = A.ui, D = A.DATA;

  // Prochaine séance du programme actif (pour l'accueil)
  A.views.planNext = () => {
    const p = A.store.data.plan;
    if (!p) return null;
    const plan = A.plans.build(p.id, p.inputs);
    if (!plan || !plan.weeks) return null;
    const all = plan.weeks.flatMap(w => w.sessions);
    const next = all.find(s => !p.done[`${s.planRef.w}-${s.planRef.s}`]);
    if (!next) return null;
    return { id: p.id, session: next, done: Object.keys(p.done).length, total: all.length };
  };

  A.views.improve = function (el) {
    const active = A.store.data.plan;
    el.innerHTML = `<div class="page-head"><a class="back" href="#/record" aria-label="Retour">${ui.icon('left')}</a><h1>M'améliorer</h1></div>
      <p class="muted mb">Choisis le mouvement ou le test sur lequel progresser : tu obtiens les exercices et les séances à faire pendant 6 semaines.</p>
      <div class="grid2 md3">${Object.entries(D.IMPROVE).map(([id, t]) => `<a class="card link" href="#/improve/${id}">
        <div class="fc-icon">${ui.icon(t.icon)}</div><div class="fc-title mt">${ui.esc(t.n)}</div>
        ${active && active.id === id ? '<span class="tag accent mt-s">Programme actif</span>' : ''}</a>`).join('')}</div>`;
  };

  A.views.improveTarget = function (el, id) {
    const T = D.IMPROVE[id];
    if (!T) { location.hash = '#/improve'; return; }
    const d = A.store.data;
    const active = d.plan && d.plan.id === id ? d.plan : null;
    const inp = Object.assign({}, active ? active.inputs : {});
    if (T.kind === 'barbell' && !inp.orm) inp.orm = A.prog.orm(T.ex) || '';
    if (T.kind === 'barbell' && !inp.weak) inp.weak = T.weak[T.weak.length - 1].v;
    if (T.kind === 'run' && !inp.dist) inp.dist = '5';
    if ((T.kind === 'pullups' || T.kind === 'pushups') && inp.max == null) inp.max = A.prog.bestReps(T.ex) || '';
    let plan = active ? A.plans.build(id, inp) : null;

    function render() {
      const fields = D.INPUTS[T.kind].map(f => `<label class="field"><span>${f.n}</span>${f.type === 'select'
        ? `<select data-f="${f.id}">${f.opts.map(([v, l]) => `<option value="${v}" ${String(inp[f.id]) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`
        : `<input data-f="${f.id}" type="${f.type}" ${f.step ? `step="${f.step}" inputmode="decimal"` : ''} placeholder="${f.placeholder || ''}" value="${ui.esc(inp[f.id] ?? '')}">`}
        ${f.hint ? `<span class="tiny faint">${f.hint}</span>` : ''}</label>`).join('');
      el.innerHTML = `<div class="page-head"><a class="back" href="#/improve" aria-label="Retour">${ui.icon('left')}</a><h1>${ui.esc(T.n)}</h1></div>
        <p class="muted">${ui.esc(T.intro)}</p>
        ${T.kind === 'barbell' && !d.profile.equipment.includes('barre') ? `<div class="note warn mt">${ui.icon('info')}<span>Ce plan est prévu avec une barre et des disques. Avec ton matériel actuel (<b>${ui.esc(A.setupName(d.profile.setup))}</b>), les séances seront adaptées automatiquement, mais les charges en % du 1RM ne s'appliqueront plus.</span></div>` : ''}
        <div class="card mt">
          ${fields}
          ${T.weak ? `<div class="field"><span class="small muted">Où bloques-tu ?</span><div class="stack mt-s" data-weak>${T.weak.map(w => `<button class="opt ${inp.weak === w.v ? 'on' : ''}" data-w="${w.v}" style="width:100%"><span style="font-weight:650">${ui.esc(w.n)}</span>${inp.weak === w.v ? `<span class="opt-d">${ui.esc(w.tip)}</span>` : ''}</button>`).join('')}</div></div>` : ''}
          <button class="btn primary block" data-build>${ui.icon('sparkle')} ${plan ? 'Recalculer mon plan' : 'Générer mon plan'}</button>
        </div>
        <div data-plan></div>`;
      if (plan) renderPlan(el.querySelector('[data-plan]'));
      el.querySelectorAll('[data-f]').forEach(i => { i.oninput = i.onchange = () => { inp[i.dataset.f] = i.value; }; });
      const wb = el.querySelector('[data-weak]');
      if (wb) wb.onclick = e => { const b = e.target.closest('[data-w]'); if (b) { inp.weak = b.dataset.w; render(); } };
      el.querySelector('[data-build]').onclick = () => {
        plan = A.plans.build(id, inp);
        if (plan.error) { ui.toast(plan.error); plan = null; return; }
        if (active) { active.inputs = ui.clone(inp); A.store.save(); }
        render();
        el.querySelector('[data-plan]').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    }

    function renderPlan(box) {
      const isActive = d.plan && d.plan.id === id;
      const done = isActive ? d.plan.done : {};
      const principles = T.principles || [];
      const accs = T.weak ? (T.weak.find(w => w.v === inp.weak) || T.weak[0]).acc : [];
      box.innerHTML = `<div class="section-title"><h2>Ton plan · 6 semaines</h2></div>
        ${plan.summary ? `<div class="note">${ui.icon('target')}<span>${ui.esc(plan.summary)}</span></div>` : ''}
        ${plan.tip ? `<div class="note mt-s">${ui.icon('info')}<span>${ui.esc(plan.tip)}</span></div>` : ''}
        ${plan.daily && plan.daily.length ? plan.daily.map(x => `<div class="note mt-s">${ui.icon('clock')}<span><b>${ui.esc(x.n)} :</b> ${ui.esc(x.d)}</span></div>`).join('') : ''}
        ${accs.length ? `<h3 class="mt">Exercices pour progresser</h3><div class="stack mt-s">${accs.map(a => { const ex = A.exById(a); return `<button class="pick card" data-info="${a}" style="border:1px solid var(--line)"><div class="grow"><div class="pk-n">${ui.esc(ex.n)}</div><div class="pk-m">${ui.esc(ex.cue || '')}</div></div>${ui.icon('info')}</button>`; }).join('')}</div>` : ''}
        ${principles.length ? `<h3 class="mt">Principes</h3><ul class="small muted" style="padding-left:18px;margin:8px 0 0">${principles.map(p => `<li style="margin-bottom:4px">${ui.esc(p)}</li>`).join('')}</ul>` : ''}
        <div class="row gap mt">${isActive ? `<span class="tag accent">${ui.icon('check', 'sm')} Programme actif</span><span class="grow"></span><button class="btn sm danger-ghost" data-stop>Arrêter</button>`
          : `<button class="btn primary block" data-activate>${ui.icon('target')} Suivre ce programme</button>`}</div>
        ${plan.weeks.map((w, wi) => `<details class="card mt" ${wi === firstOpenWeek(done) ? 'open' : ''}><summary class="row between"><span><b>${w.n}</b> <span class="small muted">· ${w.sessions.length} séances${w.note ? ' · ' + ui.esc(w.note) : ''}</span></span>${ui.icon('down')}</summary>
          <div class="stack mt">${w.sessions.map((s, si) => {
            const k = `${wi}-${si}`, ok = !!done[k];
            return `<div class="row gap"><span class="num" style="width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:${ok ? 'var(--accent)' : 'var(--card-2)'};color:${ok ? 'var(--accent-ink)' : 'var(--muted)'}">${ok ? ui.icon('check', 'sm') : si + 1}</span>
              <div class="grow"><div style="font-weight:650">${ui.esc(s.title)}</div><div class="small muted">${s.blocks.flatMap(b => b.items).map(it => it.type === 'cardio' ? it.name : (A.exById(it.exId) || {}).n).filter(Boolean).slice(0, 3).join(' · ')} · ≈ ${s.estMin} min</div></div>
              <button class="btn sm" data-open="${k}">Voir</button></div>`;
          }).join('')}</div></details>`).join('')}`;
      box.onclick = async e => {
        const t = e.target.closest('[data-open],[data-activate],[data-stop],[data-info]');
        if (!t) return;
        if (t.dataset.info) { A.cmp.exInfo(t.dataset.info); return; }
        if (t.dataset.activate != null) {
          if (d.plan && d.plan.id !== id && !(await ui.confirm(`Remplacer ton programme actuel (${D.IMPROVE[d.plan.id].n}) ?`, { ok: 'Remplacer' }))) return;
          d.plan = { id, inputs: ui.clone(inp), startedAt: Date.now(), done: {} };
          A.store.save(); ui.toast('Programme activé : retrouve-le sur l\'accueil'); render(); return;
        }
        if (t.dataset.stop != null) {
          if (await ui.confirm('Arrêter ce programme ? Tes séances déjà faites restent dans l\'historique.', { ok: 'Arrêter', danger: true })) { d.plan = null; A.store.save(); render(); }
          return;
        }
        const [wi, si] = t.dataset.open.split('-').map(Number);
        A.state.draft = ui.clone(plan.weeks[wi].sessions[si]);
        A.state.written = false;
        A.app.go('#/session');
      };
    }

    const firstOpenWeek = done => {
      if (!plan) return 0;
      for (let wi = 0; wi < plan.weeks.length; wi++) if (plan.weeks[wi].sessions.some((_, si) => !done[`${wi}-${si}`])) return wi;
      return 0;
    };

    render();
  };
})(window.A);
