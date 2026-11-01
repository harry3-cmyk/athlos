/* Athlos — composants partagés : sélecteur d'exercices, cartes, graphiques */
(function (A) {
  'use strict';
  const ui = A.ui, D = A.DATA;
  const cmp = A.cmp = {};

  cmp.badges = ex => {
    if (!ex) return '';
    const b = [];
    if (ex.heavy) b.push('<span class="tag">Lourd</span>');
    if (ex.str) b.push('<span class="tag accent">Étirement</span>');
    if (ex.bw) b.push('<span class="tag">Poids du corps</span>');
    if (ex.uni) b.push('<span class="tag">Unilatéral</span>');
    return b.join(' ');
  };

  // ——— Matériel avec moi ———
  cmp.setupCards = current => `<div class="setup-grid">${D.SETUPS.map(s => `<button class="opt setup ${current === s.id ? 'on' : ''}" data-setup="${s.id}">
      <span class="row gap-s"><span class="accent">${ui.icon(s.icon)}</span><span class="opt-t">${ui.esc(s.n)}</span></span>
      <span class="opt-d">${ui.esc(A.setupDesc(s.id, s.eq))}</span></button>`).join('')}</div>`;

  cmp.setupChips = current => `<div class="chips">${D.SETUPS.map(s => `<button class="chip ${current === s.id ? 'on' : ''}" data-setup="${s.id}">${ui.icon(s.icon, 'sm')}${ui.esc(s.n)}</button>`).join('')}</div>`;

  // Enregistre le matériel du jour dans le profil
  cmp.useSetup = id => {
    const s = A.setupById(id);
    if (!s) return;
    const P = A.store.data.profile;
    P.setup = id;
    P.equipment = s.eq.slice();
    A.store.save();
  };

  cmp.setupSheet = onDone => ui.sheet({
    title: 'Ton matériel',
    html: `<p class="small muted mb">La séance s'adapte : exercices remplacés si besoin, charges et répétitions ajustées.</p>${cmp.setupCards(A.store.data.profile.setup)}`,
    onMount(body, close) {
      body.onclick = e => { const b = e.target.closest('[data-setup]'); if (!b) return; cmp.useSetup(b.dataset.setup); close(); onDone(b.dataset.setup); };
    },
  });

  // « 35, 45 » ou « 12,5 » → [35, 45] / [12.5]
  cmp.parseKg = str => (String(str || '').match(/\d+(?:[.,]\d(?!\d))?/g) || []).map(x => Number(x.replace(',', '.'))).filter(x => x > 0);

  cmp.restLabel = s => (s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s} s`);

  // ss : position dans un superset ({ lab: 'A1', next: 'A2' }), d'après A.gen.ssLabels
  cmp.itemMeta = (it, block, ss) => {
    if (it.type === 'cardio') return cmp.cardioMeta(it);
    const parts = [];
    const sets = block && block.kind === 'circuit' ? `${block.rounds} tours` : `${it.sets} séries`;
    parts.push(`<b>${sets}</b>`);
    parts.push(it.hold ? `<b>${it.hold} s</b>` : `<b>${ui.esc(it.reps)}</b> reps`);
    if (ss && ss.next) parts.push(`puis ${ss.next}`);
    else if (!(block && block.kind === 'circuit') && it.rest) parts.push(`repos ${cmp.restLabel(it.rest)}${ss ? ' après la paire' : ''}`);
    if (it.rir) parts.push(`RIR ${ui.esc(it.rir)}`);
    return parts.map(p => `<span>${p}</span>`).join('');
  };

  cmp.cardioMeta = c => {
    const parts = [];
    if (c.protocol === 'steady') parts.push(`<b>${Math.round(c.duration / 60)} min</b> continu`);
    else {
      const ser = c.series > 1 ? `${c.series} × ` : '';
      parts.push(`<b>${ser}${c.rounds} × ${cmp.restLabel(c.work)}</b>${c.rest ? ` / ${cmp.restLabel(c.rest)}` : ''}`);
      parts.push(`${ui.fmtDur(A.gen.cardioSeconds(c))}`);
    }
    return parts.map(p => `<span>${p}</span>`).join('');
  };

  // Fiche d'un exercice (technique + science)
  cmp.exInfo = exId => {
    const ex = A.exById(exId);
    if (!ex) return;
    const last = A.prog.last(exId);
    const best = A.prog.bestE1RM(exId);
    ui.sheet({
      title: ex.n,
      html: `<div class="chips">${ex.m.map(m => `<span class="tag accent">${A.mName(m)}</span>`).join('')}${ex.s.map(m => `<span class="tag">${A.mName(m)}</span>`).join('')}</div>
        <div class="mt-s">${cmp.badges(ex)}</div>
        ${ex.cue ? `<h3 class="mt">Technique</h3><p class="muted mt-s">${ui.esc(ex.cue)}</p>` : ''}
        ${ex.sci ? `<div class="note mt">${ui.icon('flask')}<span>${ui.esc(ex.sci)}</span></div>` : ''}
        ${A.DATA.MUSCLES[ex.m[0]] && A.DATA.MUSCLES[ex.m[0]].tip ? `<h3 class="mt">Conseil ${ui.esc(A.mName(ex.m[0]).toLowerCase())}</h3><p class="muted mt-s">${ui.esc(A.DATA.MUSCLES[ex.m[0]].tip)}</p>` : ''}
        <p class="small faint mt">Matériel : ${ex.eq.length ? ex.eq.map(e => D.EQUIP[e]).join(', ') : 'aucun'}</p>
        ${last ? `<div class="divider"></div><p class="small"><b>Dernière fois</b> (${ui.fmtDate(last.date)}) : ${last.sets.map(s => (s.w ? ui.num(s.w, 1) + ' kg × ' : '') + s.r + (ex.hold ? ' s' : '')).join(' · ')}</p>` : ''}
        ${best ? `<p class="small mt-s"><b>1RM estimé</b> : ${ui.kg(best)}</p>` : ''}`,
    });
  };

  // Sélecteur d'exercices avec recherche et filtre par muscle
  cmp.exPicker = ({ title = 'Ajouter un exercice', muscle = null, onPick, allowCustom = true }) => {
    const eqSet = new Set(A.store.data.profile.equipment);
    let q = '', m = muscle, mine = true;
    ui.sheet({
      title, wide: true,
      html: `<input type="search" placeholder="Rechercher un exercice…" data-q autocomplete="off">
        <div class="chips mt-s" data-mus>${['', ...Object.keys(D.MUSCLES)].map(id => `<button class="chip ${id === (m || '') ? 'on' : ''}" data-m="${id}">${id ? A.mName(id) : 'Tous'}</button>`).join('')}</div>
        <label class="row gap-s mt-s small muted"><input type="checkbox" data-mine checked style="width:auto;min-height:0"> Seulement mon matériel</label>
        <div class="pick-list" data-list></div>
        ${allowCustom ? `<button class="btn ghost block mt" data-custom>${ui.icon('plus')} Créer un exercice personnalisé</button>` : ''}`,
      onMount(body, close) {
        const list = body.querySelector('[data-list]');
        const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        function render() {
          const nq = norm(q);
          const items = A.exList().filter(ex => (!m || ex.m.includes(m) || ex.s.includes(m)) && (!mine || ex.eq.every(e => eqSet.has(e))) && (!nq || norm(ex.n).includes(nq)))
            .sort((a, b) => (m ? (b.m.includes(m) - a.m.includes(m)) : 0) || b.pr - a.pr).slice(0, 80);
          list.innerHTML = items.length ? items.map(ex => `<button class="pick" data-id="${ex.id}"><div class="grow"><div class="pk-n">${ui.esc(ex.n)}</div>
            <div class="pk-m">${ex.m.map(A.mName).join(', ')}${ex.eq.length ? ' · ' + ex.eq.map(e => D.EQUIP[e]).join(', ') : ' · sans matériel'}</div></div>${ex.str ? '<span class="tag accent">Étirement</span>' : ''}</button>`).join('')
            : '<p class="empty small">Aucun exercice trouvé.</p>';
        }
        body.querySelector('[data-q]').oninput = e => { q = e.target.value; render(); };
        body.querySelector('[data-mine]').onchange = e => { mine = e.target.checked; render(); };
        body.querySelector('[data-mus]').onclick = e => {
          const b = e.target.closest('[data-m]'); if (!b) return;
          m = b.dataset.m || null;
          body.querySelectorAll('[data-mus] .chip').forEach(c => c.classList.toggle('on', c === b));
          render();
        };
        list.onclick = e => { const b = e.target.closest('[data-id]'); if (b) { close(); onPick(b.dataset.id); } };
        const cb = body.querySelector('[data-custom]');
        if (cb) cb.onclick = () => { close(); cmp.customExercise(onPick, m); };
        render();
      },
    });
  };

  cmp.customExercise = (onDone, muscle) => {
    ui.sheet({
      title: 'Exercice personnalisé',
      html: `<label class="field"><span>Nom</span><input data-n placeholder="Ex. Tirage à la machine Hammer"></label>
        <label class="field"><span>Muscle principal</span><select data-m>${Object.keys(D.MUSCLES).map(id => `<option value="${id}" ${id === muscle ? 'selected' : ''}>${A.mName(id)}</option>`).join('')}</select></label>
        <label class="field"><span>Type</span><select data-t><option value="comp">Polyarticulaire</option><option value="iso">Isolation</option><option value="core">Gainage</option></select></label>
        <button class="btn primary block" data-ok>Créer</button>`,
      onMount(body, close) {
        body.querySelector('[data-ok]').onclick = () => {
          const n = body.querySelector('[data-n]').value.trim();
          if (!n) { ui.toast('Donne un nom à ton exercice'); return; }
          const ex = { id: 'c_' + ui.uid(), n, m: [body.querySelector('[data-m]').value], s: [], eq: [], t: body.querySelector('[data-t]').value, pr: 5, lvl: 1, custom: true };
          A.store.data.customEx.push(ex);
          A.store.save();
          close();
          onDone(ex.id);
        };
      },
    });
  };

  // Carte d'activité (fil d'accueil et historique)
  cmp.historyCard = h => {
    const icon = h.type === 'activite' || h.type === 'cardio' ? 'run' : 'dumbbell';
    const stats = [`<div><b>${ui.fmtDur(h.durationSec)}</b>Durée</div>`];
    if (h.volume) stats.push(`<div><b>${ui.num(h.volume)} kg</b>Volume</div>`);
    if (h.totalSets) stats.push(`<div><b>${h.totalSets}</b>Séries</div>`);
    if (h.distance) stats.push(`<div><b>${ui.num(h.distance, 2)} km</b>Distance</div>`);
    if (h.rpe) stats.push(`<div><b>${h.rpe}/10</b>Effort</div>`);
    const muscles = (h.muscles || []).slice(0, 4).map(m => `<span class="tag">${A.mName(m)}</span>`).join(' ');
    return `<a class="card link feed-card" href="#/history/${h.id}">
      <div class="fc-head"><div class="fc-icon">${ui.icon(icon)}</div>
        <div class="grow"><div class="fc-title">${ui.esc(h.title)}</div><div class="small muted">${ui.fmtDate(h.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${ui.fmtTime(h.date)}</div></div>
        ${h.prs && h.prs.length ? `<span class="tag warn">${ui.icon('trophy', 'sm')} ${h.prs.length}</span>` : ''}</div>
      <div class="fc-stats">${stats.join('')}</div>
      ${muscles ? `<div class="chips mt-s">${muscles}</div>` : ''}</a>`;
  };

  // ——— Graphiques (série unique, couleur d'accent, info-bulle au survol) ———
  function attachTips(wrap, sel) {
    const tip = wrap.querySelector('.chart-tip');
    wrap.querySelectorAll(sel).forEach(el => {
      const show = () => {
        const r = wrap.getBoundingClientRect(), b = el.getBoundingClientRect();
        tip.textContent = el.dataset.tip;
        tip.style.left = (b.left + b.width / 2 - r.left) + 'px';
        tip.style.top = (b.top - r.top) + 'px';
        tip.classList.add('show');
      };
      el.addEventListener('mouseenter', show);
      el.addEventListener('focus', show);
      el.addEventListener('touchstart', show, { passive: true });
      el.addEventListener('mouseleave', () => tip.classList.remove('show'));
      el.addEventListener('blur', () => tip.classList.remove('show'));
    });
  }

  const niceMax = v => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

  // data : [{ label, value, tip }]
  cmp.barChart = (el, data, { height = 180, fmt = v => ui.num(v), unit = '' } = {}) => {
    // Largeur réelle du conteneur : le texte des axes garde sa taille à l'écran
    const W = Math.max(280, Math.round(el.clientWidth || 600)), H = height, pl = 34, pb = 22, pt = 10;
    const max = niceMax(Math.max(...data.map(d => d.value), 0));
    const bw = (W - pl) / data.length;
    const every = Math.ceil(36 / bw);
    const barW = Math.max(4, Math.min(28, bw - 6));
    const y = v => pt + (H - pt - pb) * (1 - v / max);
    const ticks = [0, max / 2, max];
    const lastIdx = data.length - 1;
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Graphique en barres"><g class="grid">${ticks.map(t => `<line x1="${pl}" x2="${W}" y1="${y(t)}" y2="${y(t)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(t => `<text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}</g>`;
    data.forEach((d, i) => {
      const x = pl + i * bw + (bw - barW) / 2;
      const h = Math.max(0, (H - pt - pb) * d.value / max);
      const top = H - pb - h;
      const r = Math.min(4, barW / 2, h);
      const path = h > 0 ? `M${x} ${H - pb} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${H - pb} Z` : '';
      svg += `<rect class="hit" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-tip="${ui.esc(d.tip || d.label + ' : ' + fmt(d.value) + unit)}" tabindex="0"/>`;
      if (path) svg += `<path class="bar ${i === lastIdx ? '' : 'dim'}" d="${path}" pointer-events="none"/>`;
      if ((lastIdx - i) % every === 0) svg +=`<g class="axis"><text x="${x + barW / 2}" y="${H - 6}" text-anchor="middle">${ui.esc(d.label)}</text></g>`;
    });
    svg += '</svg>';
    el.innerHTML = `<div class="chart">${svg}<div class="chart-tip"></div></div>`;
    attachTips(el.querySelector('.chart'), '.hit');
  };

  // points : [{ x: timestamp, y, tip }]
  cmp.lineChart = (el, pts, { height = 200, fmt = v => ui.num(v, 1) } = {}) => {
    if (pts.length < 2) { el.innerHTML = '<p class="small muted">Il faut au moins deux séances pour tracer une courbe.</p>'; return; }
    const W = Math.max(280, Math.round(el.clientWidth || 600)), H = height, pl = 40, pr = 10, pb = 22, pt = 12;
    const ys = pts.map(p => p.y);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.15 || hi * 0.1 || 1;
    lo = Math.max(0, lo - pad); hi = hi + pad;
    const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
    const X = x => pl + (W - pl - pr) * (x1 === x0 ? 0.5 : (x - x0) / (x1 - x0));
    const Y = v => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
    const ticks = [lo, (lo + hi) / 2, hi];
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de progression"><g class="grid">${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/>`).join('')}</g>
      <g class="axis">${ticks.map(t => `<text x="${pl - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('')}
      <text x="${pl}" y="${H - 5}">${ui.fmtDate(x0, { day: 'numeric', month: 'short' })}</text><text x="${W - pr}" y="${H - 5}" text-anchor="end">${ui.fmtDate(x1, { day: 'numeric', month: 'short' })}</text></g>
      <path class="lineP" d="${d}"/>
      ${pts.map(p => `<circle class="dot" cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5"/><circle class="hit" cx="${X(p.x)}" cy="${Y(p.y)}" r="14" data-tip="${ui.esc(p.tip || fmt(p.y))}" tabindex="0"/>`).join('')}</svg>`;
    el.innerHTML = `<div class="chart">${svg}<div class="chart-tip"></div></div>`;
    attachTips(el.querySelector('.chart'), '.hit');
  };

  // Calendrier des 16 dernières semaines (minutes d'entraînement par jour)
  cmp.calendar = (el, weeks = 16) => {
    const mins = {};
    A.store.data.history.forEach(h => { const k = ui.dayKey(h.date); mins[k] = (mins[k] || 0) + h.durationSec / 60; });
    const start = ui.startOfWeek(Date.now()) - (weeks - 1) * 7 * 864e5;
    const today = Date.now();
    let cells = '';
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const t = d.getTime();
      if (t > today) { cells += '<span class="future"></span>'; continue; }
      const m = mins[ui.dayKey(t)] || 0;
      const lvl = m === 0 ? '' : m < 30 ? 'l1' : m < 60 ? 'l2' : 'l3';
      cells += `<span class="${lvl}" title="${ui.fmtDate(t, { weekday: 'short', day: 'numeric', month: 'short' })} : ${m ? Math.round(m) + ' min' : 'repos'}"></span>`;
    }
    el.innerHTML = `<div class="cal" role="img" aria-label="Calendrier d'entraînement des ${weeks} dernières semaines">${cells}</div>
      <div class="cal-legend">Repos <span style="background:var(--card-2)"></span><span class="l1" style="background:color-mix(in srgb,var(--accent) 35%,var(--card-2))"></span><span style="background:color-mix(in srgb,var(--accent) 65%,var(--card-2))"></span><span style="background:var(--accent)"></span> 1 h +</div>`;
  };

  // Séries par muscle comparées à la zone 10-20 séries / semaine
  cmp.muscleBars = (el, sets) => {
    const max = 24;
    el.innerHTML = Object.keys(D.MUSCLES).map(m => {
      const v = sets[m] || 0;
      return `<div class="hbar"><span>${A.mName(m)}</span><div class="track"><div class="zone" style="left:${10 / max * 100}%;width:${10 / max * 100}%"></div>
        <div class="fill" style="width:${Math.min(100, v / max * 100)}%"></div></div><span class="val">${ui.num(v, 1)}</span></div>`;
    }).join('') + '<p class="tiny faint mt-s">Zone surlignée : 10 à 20 séries par semaine, le repère de la recherche (Schoenfeld et al. 2017).</p>';
  };
})(window.A);
