/* Athlos — progrès : tendances hebdomadaires, volume par muscle, records */
(function (A) {
  'use strict';
  const ui = A.ui;
  const WEEK = 7 * 864e5;
  const METRICS = {
    sessions: { n: 'Séances', val: hs => hs.length, fmt: v => ui.num(v), unit: '' },
    time: { n: 'Temps', val: hs => hs.reduce((s, h) => s + h.durationSec / 60, 0), fmt: v => ui.num(v), unit: ' min' },
    volume: { n: 'Volume', val: hs => hs.reduce((s, h) => s + (h.volume || 0), 0), fmt: v => v >= 1000 ? ui.num(v / 1000, 1) + ' t' : ui.num(v), unit: ' kg' },
    load: { n: 'Charge', val: hs => hs.reduce((s, h) => s + (h.rpe || 0) * h.durationSec / 60, 0), fmt: v => ui.num(v), unit: ' UA' },
  };

  A.views.stats = function (el) {
    const st = A.state.stats = A.state.stats || { weeks: 12, metric: 'time', mweek: 0, ex: null };
    const hist = A.store.data.history;

    // Exercices suivis (au moins une série chargée ou au poids du corps)
    const exIds = [];
    hist.forEach(h => (h.exercises || []).forEach(e => { if (!exIds.includes(e.exId) && A.exById(e.exId)) exIds.push(e.exId); }));
    if (!st.ex || !exIds.includes(st.ex)) st.ex = exIds[0] || null;

    function render() {
      const cur = ui.startOfWeek(Date.now());
      const weeks = [];
      for (let i = st.weeks - 1; i >= 0; i--) {
        const from = ui.startOfWeek(cur - i * WEEK + 3 * 864e5);
        weeks.push({ from, to: from + WEEK, hs: hist.filter(h => h.date >= from && h.date < from + WEEK) });
      }
      const M = METRICS[st.metric];
      const records = exIds.map(id => ({ id, best: A.prog.bestE1RM(id) })).filter(r => r.best > 0).sort((a, b) => b.best - a.best).slice(0, 8);

      el.innerHTML = `<div class="page-head"><h1>Progrès</h1></div>
        ${!hist.length ? `<div class="card empty">${ui.icon('chart')}<p><b>Tes courbes apparaîtront ici.</b></p><p class="small mt-s">Termine quelques séances pour voir ta progression.</p></div>` : ''}
        <div class="card">
          <div class="row between wrap gap"><h3>Par semaine</h3>
            <div class="seg" data-weeks>${[[4, '4 sem.'], [12, '12 sem.'], [26, '6 mois']].map(([k, n]) => `<button class="${st.weeks === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div></div>
          <div class="chips mt" data-metric>${Object.entries(METRICS).map(([k, m]) => `<button class="chip ${st.metric === k ? 'on' : ''}" data-k="${k}">${m.n}</button>`).join('')}</div>
          <div class="mt" data-chart></div>
          ${st.metric === 'load' ? '<p class="tiny faint mt-s">Charge = effort perçu × minutes (méthode sRPE, Foster et al. 2001). Évite les hausses brutales d\'une semaine à l\'autre.</p>' : ''}
        </div>

        <div class="section-title"><h2>Séries par muscle</h2>
          <div class="seg" data-mweek>${[[0, 'Cette semaine'], [1, 'Semaine dernière']].map(([k, n]) => `<button class="${st.mweek === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div></div>
        <div class="card"><div data-mbody></div><div class="mt" data-mbars></div></div>

        <div class="section-title"><h2>Progression par exercice</h2></div>
        <div class="card">${exIds.length ? `<select data-ex>${exIds.map(id => `<option value="${id}" ${id === st.ex ? 'selected' : ''}>${ui.esc(A.exById(id).n)}</option>`).join('')}</select>
          <div class="mt" data-exchart></div><div class="mt" data-extable></div>` : '<p class="small muted">Aucun exercice enregistré pour l\'instant.</p>'}</div>

        ${records.length ? `<div class="section-title"><h2>Records (1RM estimé)</h2></div><div class="stack">${records.map(r => `<div class="card row between"><span>${ui.esc(A.exById(r.id).n)}</span><b>${ui.kg(r.best)}</b></div>`).join('')}</div>` : ''}

        <div class="section-title"><h2>Régularité</h2></div><div class="card" data-cal></div>`;

      A.cmp.barChart(el.querySelector('[data-chart]'), weeks.map(w => ({
        label: ui.fmtDate(w.from, { day: 'numeric', month: 'numeric' }), value: M.val(w.hs),
        tip: `Semaine du ${ui.fmtDate(w.from, { day: 'numeric', month: 'short' })} : ${M.fmt(M.val(w.hs))}${M.unit}`,
      })), { fmt: M.fmt });

      const mFrom = cur - st.mweek * WEEK;
      const sets = A.prog.muscleSets(ui.startOfWeek(mFrom + 3 * 864e5), ui.startOfWeek(mFrom + 3 * 864e5) + WEEK);
      A.body(el.querySelector('[data-mbody]'), { heat: sets, heatMax: 15 });
      A.cmp.muscleBars(el.querySelector('[data-mbars]'), sets);

      if (st.ex) renderEx();
      A.cmp.calendar(el.querySelector('[data-cal]'), 26);

      el.querySelector('[data-weeks]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { st.weeks = Number(b.dataset.k); render(); } };
      el.querySelector('[data-metric]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { st.metric = b.dataset.k; render(); } };
      el.querySelector('[data-mweek]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { st.mweek = Number(b.dataset.k); render(); } };
      const sel = el.querySelector('[data-ex]');
      if (sel) sel.onchange = () => { st.ex = sel.value; renderEx(); };
    }

    function renderEx() {
      const ex = A.exById(st.ex);
      const entries = A.prog.entriesFor(st.ex).slice().reverse();
      const weighted = entries.some(e => e.sets.some(s => s.w > 0));
      const pts = entries.map(e => {
        const y = weighted ? Math.max(0, ...e.sets.map(s => A.e1rm(s.w, s.r))) : Math.max(0, ...e.sets.map(s => s.r || 0));
        return { x: e.date, y, tip: `${ui.fmtDate(e.date, { day: 'numeric', month: 'short' })} : ${weighted ? ui.kg(y) + ' (1RM est.)' : y + (ex.hold ? ' s' : ' reps')}` };
      }).filter(p => p.y > 0);
      A.cmp.lineChart(el.querySelector('[data-exchart]'), pts, { fmt: v => ui.num(v, weighted ? 0 : 0) });
      el.querySelector('[data-extable]').innerHTML = `<p class="small muted">${weighted ? '1RM estimé par séance (formule d\'Epley)' : (ex.hold ? 'Meilleur maintien par séance' : 'Meilleure série par séance')}</p>
        <div class="stack mt-s">${entries.slice(-6).reverse().map(e => `<div class="row between small"><span class="muted">${ui.fmtDate(e.date)}</span><span class="set-chips" style="margin:0;justify-content:flex-end">${e.sets.map(s => `<span>${s.w ? ui.num(s.w, 1) + '×' : ''}${s.r}${ex.hold ? ' s' : ''}</span>`).join('')}</span></div>`).join('')}</div>`;
    }

    render();
  };
})(window.A);
