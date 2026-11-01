/* Athlos — historique des séances et détail d'une séance */
(function (A) {
  'use strict';
  const ui = A.ui;

  A.views.history = function (el) {
    let filter = A.state.histFilter || 'all';
    function render() {
      const all = A.store.data.history;
      const list = all.filter(h => filter === 'all' || (filter === 'muscu' ? h.exercises && h.exercises.length : (h.type === 'cardio' || h.type === 'activite' || (h.cardio && h.cardio.length))));
      const months = {};
      list.forEach(h => { const k = ui.fmtDate(h.date, { month: 'long', year: 'numeric' }); (months[k] = months[k] || []).push(h); });
      const totalTime = all.reduce((s, h) => s + (h.durationSec || 0), 0);
      el.innerHTML = `<div class="page-head"><h1>Historique</h1></div>
        <div class="grid3"><div class="stat"><div class="v">${all.length}</div><div class="l">Séances</div></div>
          <div class="stat"><div class="v">${Math.round(totalTime / 3600)}<small>h</small></div><div class="l">Au total</div></div>
          <div class="stat"><div class="v">${all.reduce((s, h) => s + (h.prs ? h.prs.length : 0), 0)}</div><div class="l">Records</div></div></div>
        <div class="seg mt" data-filter>${[['all', 'Tout'], ['muscu', 'Musculation'], ['cardio', 'Cardio & sports']].map(([k, n]) => `<button class="${filter === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div>
        ${list.length ? Object.entries(months).map(([m, hs]) => `<div class="month-h">${m} · ${hs.length} séance${hs.length > 1 ? 's' : ''}</div><div class="stack">${hs.map(A.cmp.historyCard).join('')}</div>`).join('')
          : `<div class="card empty mt">${ui.icon('list')}<p><b>Rien ici pour l'instant.</b></p><p class="small mt-s">Chaque séance terminée est enregistrée avec toutes ses séries.</p><a class="btn primary mt" href="#/record">Enregistrer une séance</a></div>`}`;
      el.querySelector('[data-filter]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { filter = A.state.histFilter = b.dataset.k; render(); } };
    }
    render();
  };

  A.views.historyDetail = function (el, id) {
    const d = A.store.data;
    const h = d.history.find(x => x.id === id);
    if (!h) { location.hash = '#/history'; return; }
    const sport = h.sport && A.SPORTS ? (A.SPORTS.find(s => s[0] === h.sport) || [])[1] : null;
    const load = h.rpe ? Math.round(h.rpe * h.durationSec / 60) : null;
    el.innerHTML = `<div class="page-head"><a class="back" href="#/history" aria-label="Retour">${ui.icon('left')}</a><h1>${ui.esc(h.title)}</h1></div>
      <p class="muted">${ui.fmtDate(h.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${ui.fmtTime(h.date)}${sport ? ' · ' + sport : ''}${h.mode === 'written' ? ' · version écrite' : ''}</p>
      <div class="grid4 mt">
        <div class="stat"><div class="v">${ui.fmtDur(h.durationSec)}</div><div class="l">Durée</div></div>
        ${h.volume ? `<div class="stat"><div class="v">${ui.num(h.volume)}<small>kg</small></div><div class="l">Volume</div></div>` : ''}
        ${h.totalSets ? `<div class="stat"><div class="v">${h.totalSets}</div><div class="l">Séries</div></div>` : ''}
        ${h.distance ? `<div class="stat"><div class="v">${ui.num(h.distance, 2)}<small>km</small></div><div class="l">Distance</div></div>` : ''}
        ${h.rpe ? `<div class="stat"><div class="v">${h.rpe}<small>/10</small></div><div class="l">Effort · charge ${load}</div></div>` : ''}
      </div>
      ${h.prs && h.prs.length ? `<div class="section-title"><h2>Records</h2></div>${h.prs.map(p => `<div class="pr-line">${ui.icon('trophy')}<span><b>${ui.esc(p.name)}</b> · ${ui.esc(p.label)}</span></div>`).join('')}` : ''}
      ${h.muscles && h.muscles.length ? `<div class="section-title"><h2>Muscles</h2></div><div class="card" data-body></div>` : ''}
      ${h.exercises && h.exercises.length ? `<div class="section-title"><h2>Exercices</h2></div><div class="stack">${h.exercises.map(e => {
        const ex = A.exById(e.exId);
        const best = Math.max(0, ...e.sets.map(s => A.e1rm(s.w, s.r)));
        return `<div class="card"><div class="row between gap"><b class="item-name" data-info="${e.exId}">${ui.esc(e.name)}</b>${best ? `<span class="tag">1RM est. ${ui.num(best, 1)} kg</span>` : ''}</div>
          <div class="set-chips">${e.sets.map(s => `<span>${s.w ? ui.num(s.w, 1) + ' kg × ' : ''}${s.r}${ex && ex.hold ? ' s' : ''}</span>`).join('')}</div></div>`;
      }).join('')}</div>` : ''}
      ${h.cardio && h.cardio.length ? `<div class="section-title"><h2>Cardio</h2></div><div class="stack">${h.cardio.map(c => `<div class="card row between"><b>${ui.esc(c.name)}</b><span class="muted small">${ui.fmtDur(c.durationSec)}${c.distance ? ' · ' + ui.num(c.distance, 2) + ' km' : ''}${c.hard ? ' · intense' : ''}</span></div>`).join('')}</div>` : ''}
      ${h.notes ? `<div class="section-title"><h2>Notes</h2></div><div class="card"><p>${ui.esc(h.notes)}</p></div>` : ''}
      <div class="row gap wrap mt-l">
        ${(h.exercises && h.exercises.length) || (h.cardio && h.cardio.length) ? `<button class="btn primary" data-repeat>${ui.icon('refresh')} Refaire cette séance</button>` : ''}
        <button class="btn danger-ghost" data-del>${ui.icon('trash')} Supprimer</button>
      </div>`;
    const body = el.querySelector('[data-body]');
    if (body) {
      const sets = {};
      (h.exercises || []).forEach(e => { const ex = A.exById(e.exId); if (!ex) return; ex.m.forEach(m => { sets[m] = (sets[m] || 0) + e.sets.length; }); ex.s.forEach(m => { sets[m] = (sets[m] || 0) + e.sets.length / 2; }); });
      A.body(body, { heat: sets, heatMax: 8 });
    }
    el.onclick = async e => {
      const t = e.target.closest('[data-repeat],[data-del],[data-info]');
      if (!t) return;
      if (t.dataset.info) { A.cmp.exInfo(t.dataset.info); return; }
      if (t.dataset.repeat != null) { A.state.draft = A.views.sessionFromHistory(h); A.state.written = false; A.app.go('#/session'); return; }
      if (await ui.confirm('Supprimer définitivement cette séance de ton historique ?', { ok: 'Supprimer', danger: true })) {
        d.history = d.history.filter(x => x.id !== id);
        if (d.plan) Object.keys(d.plan.done).forEach(k => { if (d.plan.done[k] === id) delete d.plan.done[k]; });
        A.store.save(); ui.toast('Séance supprimée'); location.hash = '#/history';
      }
    };
  };
})(window.A);
