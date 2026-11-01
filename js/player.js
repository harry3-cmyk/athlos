/* Athlos — mode séance guidée : séries, repos chronométrés, minuteurs, bilan */
(function (A) {
  'use strict';
  const ui = A.ui, G = A.gen;
  const D = () => A.store.data;
  const RING = 2 * Math.PI * 42;
  let root = null, tickId = null, audio = null, wake = null;
  const beeped = {};

  // ——— Son, vibration, écran allumé ———
  function beep(freq = 880, ms = 160, vol = 0.25) {
    if (!D().profile.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + ms / 1000);
      o.connect(g); g.connect(audio.destination);
      o.start(); o.stop(audio.currentTime + ms / 1000 + 0.02);
    } catch (e) { /* audio indisponible */ }
  }
  const buzz = p => { if (D().profile.vibrate && navigator.vibrate) navigator.vibrate(p); };
  async function lockScreen() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
  function unlockScreen() { try { if (wake) wake.release(); } catch (e) { /* déjà libéré */ } wake = null; }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && root && root.classList.contains('open')) { lockScreen(); updateTick(); } });

  // ——— Construction de la séance active ———
  function build(session) {
    const s = ui.clone(session);
    const entries = [];
    if (s.warmup && s.warmup.length) entries.push({ key: 'warm', kind: 'list', name: 'Échauffement', list: s.warmup, checked: [], done: false });
    s.blocks.forEach((b, bi) => b.items.forEach((it, ii) => {
      const key = `${bi}-${ii}`;
      if (it.type === 'cardio') { entries.push(Object.assign({}, it, { key, kind: 'cardio', block: b.title, done: false, result: {} })); return; }
      const ex = A.exById(it.exId);
      if (!ex) return;
      const circuit = b.kind === 'circuit';
      const n = circuit ? b.rounds : it.sets;
      entries.push({
        key, kind: 'ex', block: b.title, blockKind: b.kind, exId: it.exId, name: ex.n, item: it,
        reps: it.reps, hold: it.hold || null, rir: it.rir, load: it.load, note: [it.gearNote, it.note].filter(Boolean).join(' '), uni: !!ex.uni, bw: !!ex.bw,
        rest: circuit ? b.restEx : (it.rest || 0), group: circuit ? 'c' + bi : null, restRound: circuit ? b.restRound : 0,
        sets: Array.from({ length: n }, (_, i) => ({ w: null, r: null, done: false, tr: it.setReps ? it.setReps[i] : null })),
      });
    }));
    if (s.cooldown && s.cooldown.length) entries.push({ key: 'cool', kind: 'list', name: 'Retour au calme', list: s.cooldown, checked: [], done: false });
    return { id: ui.uid(), session: s, entries, startedAt: Date.now(), pausedAt: null, pausedTotal: 0, cur: { e: 0, s: 0 }, rest: null, timer: null };
  }

  // Applique le matériel de la séance (haltères fixes, élastiques, gilet) à un exercice ajouté ou remplacé
  function gearItem(act, it, blockKind) {
    const s = act.session;
    G.applyGear({ blocks: [{ kind: blockKind || 'hyper', items: [it] }] }, s.setup, s.eq || D().profile.equipment, s.gear || null);
    return it;
  }

  // Ordre des étapes (les circuits alternent les exercices tour par tour)
  function steps(act) {
    const out = [], E = act.entries;
    for (let i = 0; i < E.length; i++) {
      const e = E[i];
      if (e.kind !== 'ex') { out.push({ e: i, s: 0, rest: 0 }); continue; }
      if (e.group) {
        let j = i;
        while (j < E.length && E[j].group === e.group) j++;
        const rounds = Math.max(...E.slice(i, j).map(x => x.sets.length));
        for (let r = 0; r < rounds; r++) {
          for (let k = i; k < j; k++) {
            if (r < E[k].sets.length) out.push({ e: k, s: r, rest: k === j - 1 ? (r < rounds - 1 ? E[k].restRound : 0) : E[k].rest });
          }
        }
        i = j - 1;
      } else e.sets.forEach((_, s) => out.push({ e: i, s, rest: e.rest }));
    }
    return out;
  }
  const isDone = (act, st) => { const e = act.entries[st.e]; return e.kind === 'ex' ? !!(e.sets[st.s] && e.sets[st.s].done) : e.done; };
  const curIndex = (act, st) => Math.max(0, st.findIndex(x => x.e === act.cur.e && x.s === act.cur.s));
  const now = act => act.pausedAt || Date.now();
  const save = () => A.store.save();

  function advance(act) {
    const st = steps(act);
    const i = curIndex(act, st);
    for (let k = 1; k <= st.length; k++) {
      const c = st[(i + k) % st.length];
      if (!isDone(act, c)) { act.cur = { e: c.e, s: c.s }; return true; }
    }
    return false;
  }

  // ——— Repos et minuteurs ———
  function startRest(act, sec) { act.rest = { start: now(act), dur: sec }; beeped.rest = null; }

  function phasesFor(e) {
    if (e.kind === 'ex') {
      const ph = [{ k: 'prep', d: 5, l: 'Mets-toi en place' }];
      const sides = e.uni ? 2 : 1;
      for (let i = 0; i < sides; i++) {
        ph.push({ k: 'work', d: e.hold, l: sides > 1 ? (i ? 'Deuxième côté' : 'Premier côté') : 'Tiens !' });
        if (i < sides - 1) ph.push({ k: 'rest', d: 10, l: 'Change de côté' });
      }
      return ph;
    }
    if (e.protocol === 'steady') return [{ k: 'work', d: e.duration, l: e.name }];
    const ph = [{ k: 'prep', d: 10, l: 'Prêt ?' }];
    const series = e.series || 1;
    let n = 0;
    for (let s = 0; s < series; s++) {
      for (let r = 0; r < e.rounds; r++) {
        ph.push({ k: 'work', d: e.work, l: e.labels ? e.labels[n % e.labels.length] : 'Effort', r: r + 1, s: s + 1 });
        n++;
        if (r < e.rounds - 1 && e.rest) ph.push({ k: 'rest', d: e.rest, l: 'Récupération', r: r + 1, s: s + 1 });
      }
      if (s < series - 1) ph.push({ k: 'rest', d: e.seriesRest || 180, l: 'Récupération entre les séries', s: s + 1 });
    }
    return ph;
  }
  function startTimer(act) {
    const e = act.entries[act.cur.e];
    act.rest = null;
    act.timer = { e: act.cur.e, s: act.cur.s, phases: phasesFor(e), idx: 0, start: now(act), began: now(act) };
    beep(660, 120);
    save(); render();
  }
  function finishTimer(act, early) {
    const t = act.timer;
    if (!t) return;
    const e = act.entries[t.e];
    const elapsed = Math.round((now(act) - t.began) / 1000);
    act.timer = null;
    beep(1046, 400, 0.3); buzz([200, 100, 200]);
    if (e.kind === 'ex') {
      const set = e.sets[t.s];
      const w = readNum(`[data-w="${t.s}"]`);
      set.done = true; set.r = early ? Math.max(1, elapsed - 5) : e.hold; set.w = w || set.w || 0;
      const st = steps(act).find(x => x.e === t.e && x.s === t.s);
      const more = advance(act);
      if (more && st && st.rest) startRest(act, st.rest);
      save(); render();
      if (!more) finishPrompt();
    } else {
      e.done = true;
      e.result.durationSec = early ? elapsed : G.cardioSeconds(e);
      save(); render();
    }
  }

  // ——— Boucle d'affichage ———
  function updateTick() {
    const act = D().active;
    if (!act || !root) return;
    const clock = root.querySelector('[data-clock]');
    if (clock) clock.textContent = ui.fmtClock((now(act) - act.startedAt - act.pausedTotal) / 1000);
    if (act.rest) {
      const left = act.rest.dur - (now(act) - act.rest.start) / 1000;
      const t = root.querySelector('[data-rest-t]'), fg = root.querySelector('[data-ring]');
      if (left <= 0) {
        act.rest = null; beep(1046, 350, 0.3); buzz([250, 120, 250]); save(); render();
        return;
      }
      const sec = Math.ceil(left);
      if (sec <= 3 && beeped.rest !== sec) { beeped.rest = sec; beep(740, 90, 0.18); }
      if (t) t.textContent = ui.fmtClock(left);
      if (fg) fg.style.strokeDashoffset = RING * (1 - left / act.rest.dur);
    }
    if (act.timer) {
      const tm = act.timer;
      let el = (now(act) - tm.start) / 1000;
      let changed = false;
      while (tm.idx < tm.phases.length && el >= tm.phases[tm.idx].d) {
        el -= tm.phases[tm.idx].d; tm.start += tm.phases[tm.idx].d * 1000; tm.idx++; changed = true;
      }
      if (tm.idx >= tm.phases.length) { finishTimer(act, false); return; }
      if (changed) {
        const k = tm.phases[tm.idx].k;
        beep(k === 'work' ? 988 : 587, 260, 0.3); buzz(k === 'work' ? [300] : [120, 80, 120]);
        save(); render();
        return;
      }
      const ph = tm.phases[tm.idx];
      const left = ph.d - el, sec = Math.ceil(left);
      if (sec <= 3 && beeped.timer !== `${tm.idx}-${sec}`) { beeped.timer = `${tm.idx}-${sec}`; beep(740, 90, 0.18); }
      const tt = root.querySelector('[data-timer-t]');
      if (tt) tt.textContent = ui.fmtClock(left);
    }
  }

  // ——— Rendu ———
  function ensureRoot() {
    if (root) return;
    root = document.getElementById('player-root');
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
  }

  function render() {
    const act = D().active;
    if (!act) { hide(); return; }
    const st = steps(act);
    const done = st.filter(x => isDone(act, x)).length;
    const e = act.entries[act.cur.e] || act.entries[0];
    root.innerHTML = `<div class="pl-top">
        <button class="icon-btn" data-close aria-label="Quitter">${ui.icon('x')}</button>
        <div class="pl-title"><div class="t">${ui.esc(act.session.title)}</div><div class="clock ${act.pausedAt ? 'paused' : ''}" data-clock>0:00</div></div>
        <button class="icon-btn" data-pause aria-label="${act.pausedAt ? 'Reprendre' : 'Pause'}">${ui.icon(act.pausedAt ? 'play' : 'pause')}</button>
        <button class="icon-btn" data-list aria-label="Liste des exercices">${ui.icon('menu')}</button>
      </div>
      <div class="pl-prog"><span style="width:${st.length ? (done / st.length) * 100 : 0}%"></span></div>
      <div class="pl-body">${act.pausedAt ? `<div class="note warn mb">${ui.icon('pause')}<span>Séance en pause. Touche ▶ pour reprendre.</span></div>` : ''}${e ? body(act, e) : ''}</div>
      <div class="pl-bottom">${e ? bottom(act, e) : ''}</div>`;
    updateTick();
  }

  const exCount = act => act.entries.filter(x => x.kind !== 'list');
  function header(act, e) {
    const list = exCount(act);
    const i = list.indexOf(e);
    return `<div class="pl-block">${ui.esc(e.block || '')}${i >= 0 ? ` · ${i + 1} / ${list.length}` : ''}</div>`;
  }

  function body(act, e) {
    if (e.kind === 'list') {
      return `<div class="pl-block">${act.cur.e === 0 ? 'On commence' : 'Fin de séance'}</div><h2 class="pl-ex">${ui.esc(e.name)}</h2>
        <p class="muted mt-s">Coche au fur et à mesure.</p>
        <ul class="check-list">${e.list.map((w, i) => `<li class="${e.checked[i] ? 'on' : ''}" data-ck="${i}"><span class="ok">${e.checked[i] ? ui.icon('check', 'sm') : ''}</span><div><b>${ui.esc(w.n)}</b><div class="small muted">${ui.esc(w.d)}</div></div></li>`).join('')}</ul>`;
    }
    if (e.kind === 'cardio') return cardioBody(act, e);
    const t = act.timer && act.timer.e === act.cur.e ? act.timer : null;
    const s = act.cur.s;
    const n = e.sets.length;
    const last = A.prog.last(e.exId);
    const sug = A.prog.suggest(e.item, s);
    const tr = e.sets[s] && e.sets[s].tr;
    const target = e.hold ? `${e.hold} s${e.uni ? ' par côté' : ''}` : `${tr ? tr + ' reps' : ui.esc(e.reps) + ' reps'}${e.uni ? ' par côté' : ''}`;
    const prevW = i => { for (let k = i - 1; k >= 0; k--) if (e.sets[k].done && e.sets[k].w) return e.sets[k].w; return null; };
    const phW = i => { const p = prevW(i); if (p) return p; const sg = A.prog.suggest(e.item, i); return sg && sg.w ? sg.w : ''; };
    const phR = i => { const sx = e.sets[i]; if (sx.tr) return sx.tr; if (e.hold) return e.hold; const l = last && last.sets[i]; return l ? l.r : G.repsTop(e.reps); };
    return `${header(act, e)}<h2 class="pl-ex">${ui.esc(e.name)}</h2>
      <div class="pl-target"><span class="tag accent">${e.group ? 'Tour' : 'Série'} ${s + 1} / ${n}</span><span class="tag">${target}</span>
        ${e.rir ? `<span class="tag">RIR ${ui.esc(e.rir)}</span>` : ''}${e.rest ? `<span class="tag">${ui.icon('timer', 'sm')} ${A.cmp.restLabel(e.rest)}</span>` : ''}</div>
      ${e.load ? `<p class="small muted mt-s">${ui.esc(e.load)}</p>` : ''}
      ${sug && (sug.w || sug.r || sug.why) ? `<div class="pl-sugg">${ui.icon('bolt')}<span>${sug.w ? `<b>${ui.num(sug.w, 1)} kg</b> · ` : ''}${ui.esc(sug.why)}</span></div>` : ''}
      ${t ? timerHTML(t, e) : `
      <table class="sets-t"><thead><tr><th>${e.group ? 'Tour' : 'Série'}</th><th>Précédent</th><th>${e.bw ? 'Lest kg' : 'kg'}</th><th>${e.hold ? 'Sec.' : 'Reps'}</th><th></th></tr></thead><tbody>
        ${e.sets.map((x, i) => { const l = last && last.sets[i]; return `<tr class="${i === s ? 'cur' : ''} ${x.done ? 'done' : ''}">
          <td class="sn">${i + 1}</td><td class="prev">${l ? (l.w ? ui.num(l.w, 1) + '×' : '') + l.r : '—'}</td>
          <td><input data-w="${i}" type="number" step="0.5" min="0" inputmode="decimal" value="${x.w ?? ''}" placeholder="${phW(i)}" aria-label="Charge série ${i + 1}"></td>
          <td><input data-r="${i}" type="number" step="1" min="0" inputmode="numeric" value="${x.r ?? ''}" placeholder="${phR(i)}" aria-label="Répétitions série ${i + 1}"></td>
          <td><button class="ok" data-ok="${i}" aria-label="Valider la série ${i + 1}">${ui.icon('check')}</button></td></tr>`; }).join('')}
      </tbody></table>
      <div class="row gap wrap mt-s"><button class="btn sm ghost" data-addset>${ui.icon('plus', 'sm')} Série</button>
        <button class="btn sm ghost" data-info="${e.exId}">${ui.icon('info', 'sm')} Technique</button>
        <button class="btn sm ghost" data-swap>${ui.icon('swap', 'sm')} Remplacer</button></div>
      ${e.note ? `<p class="small faint mt">${ui.esc(e.note)}</p>` : ''}`}`;
  }

  function timerHTML(t, e) {
    const ph = t.phases[t.idx];
    const work = t.phases.filter(p => p.k === 'work');
    const wi = t.phases.slice(0, t.idx + 1).filter(p => p.k === 'work').length;
    const label = { work: 'Effort', rest: 'Récup', prep: 'Prépare-toi' }[ph.k];
    const bars = t.phases.length <= 60 ? `<div class="phase-bar">${t.phases.map((p, i) => p.k === 'prep' ? '' : `<span class="${i < t.idx ? 'done' : i === t.idx ? 'cur' : p.k === 'work' ? 'w' : ''}" style="flex:${p.d}"></span>`).join('')}</div>` : '';
    return `<div class="big-timer"><div class="phase ${ph.k}">${label}</div><div class="time" data-timer-t>${ui.fmtClock(ph.d)}</div>
      ${ph.k === 'work' && work.length > 1 ? `<div class="sub">Intervalle ${wi} / ${work.length}${ph.s && (e.series || 1) > 1 ? ` · série ${ph.s}` : ''}</div>` : ''}
      ${ph.l && ph.k !== 'prep' ? `<div class="lbl">${ui.esc(ph.l)}</div>` : ''}
      ${e.intensity && ph.k === 'work' ? `<div class="sub mt-s">${ui.esc(e.intensity)}</div>` : ''}${bars}</div>`;
  }

  function cardioBody(act, e) {
    const t = act.timer && act.timer.e === act.cur.e ? act.timer : null;
    if (t) return `${header(act, e)}<h2 class="pl-ex">${ui.esc(e.name)}</h2>${timerHTML(t, e)}`;
    if (e.done) {
      return `${header(act, e)}<h2 class="pl-ex">${ui.esc(e.name)}</h2>
        <div class="summary-hero">${ui.icon('check')}<h2 class="mt-s">Bloc terminé</h2><p class="muted">${ui.fmtDur(e.result.durationSec || G.cardioSeconds(e))}</p></div>
        <label class="field"><span>Distance parcourue (km, facultatif)</span><input data-dist type="number" step="0.01" inputmode="decimal" value="${e.result.distance ?? ''}"></label>`;
    }
    return `${header(act, e)}<h2 class="pl-ex">${ui.esc(e.name)}</h2>
      <div class="pl-target">${A.cmp.cardioMeta(e).replace(/<span>/g, '<span class="tag">')}</div>
      ${e.intensity ? `<div class="pl-sugg">${ui.icon('heart')}<span>${ui.esc(e.intensity)}</span></div>` : ''}
      ${e.note ? `<p class="small muted mt">${ui.esc(e.note)}</p>` : ''}
      ${e.labels ? `<p class="small mt"><b>Exercices :</b> ${e.labels.map(ui.esc).join(' · ')}</p>` : ''}
      <p class="small faint mt">Le minuteur gère seul les phases d'effort et de récupération, avec un bip à chaque changement.</p>`;
  }

  function nextLabel(act) {
    const e = act.entries[act.cur.e];
    if (!e) return '';
    if (e.kind !== 'ex') return e.name;
    const s = act.cur.s;
    const set = e.sets[s];
    let w = set.w;
    if (w == null) { for (let k = s - 1; k >= 0; k--) if (e.sets[k].done && e.sets[k].w) { w = e.sets[k].w; break; } }
    if (w == null) { const sg = A.prog.suggest(e.item, s); w = sg && sg.w; }
    return `${e.name} · ${e.group ? 'tour' : 'série'} ${s + 1}/${e.sets.length}${w ? ' · ' + ui.num(w, 1) + ' kg' : ''}`;
  }

  function bottom(act, e) {
    if (act.rest) {
      const left = act.rest.dur - (now(act) - act.rest.start) / 1000;
      return `<div class="rest-panel"><div class="ring"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="42"/>
          <circle class="fg" data-ring cx="50" cy="50" r="42" stroke-dasharray="${RING}" stroke-dashoffset="${RING * (1 - left / act.rest.dur)}"/></svg><div class="rt" data-rest-t>${ui.fmtClock(left)}</div></div>
        <div class="rest-info"><div class="lbl">Repos</div><div class="nx">Ensuite : ${ui.esc(nextLabel(act))}</div>
          <div class="rest-btns"><button class="btn sm" data-restadj="-15">−15 s</button><button class="btn sm" data-restadj="15">+15 s</button><button class="btn sm primary" data-skiprest>Passer ${ui.icon('skip', 'sm')}</button></div></div></div>`;
    }
    if (act.timer) {
      return `<div class="row gap"><button class="btn xl" data-tskip>${ui.icon('skip')} Phase suivante</button><button class="btn xl primary" data-tstop>${ui.icon('check')} Terminer</button></div>`;
    }
    if (e.kind === 'list') return `<div class="row gap"><button class="btn xl" style="width:auto" data-listskip>Passer</button><button class="btn primary xl" data-listdone>${ui.icon('check')} ${act.cur.e === 0 ? 'Échauffement terminé' : 'Terminé'}</button></div>`;
    if (e.kind === 'cardio') {
      if (e.done) return `<button class="btn primary xl" data-cnext>Continuer ${ui.icon('right')}</button>`;
      return `<div class="row gap"><button class="btn xl" style="width:auto" data-cmanual>Fait sans chrono</button><button class="btn primary xl" data-tstart>${ui.icon('play')} Démarrer</button></div>`;
    }
    if (e.hold) return `<div class="row gap"><button class="btn xl" style="width:auto" data-ok="${act.cur.s}">${ui.icon('check')}</button><button class="btn primary xl" data-tstart>${ui.icon('timer')} Chrono ${e.hold} s${e.uni ? ' × 2' : ''}</button></div>`;
    return `<button class="btn primary xl" data-ok="${act.cur.s}">${ui.icon('check')} Valider ${e.group ? 'le tour' : 'la série'} ${act.cur.s + 1}</button>`;
  }

  // ——— Interactions ———
  const num = v => { const n = Number(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
  function readNum(sel) { const i = root && root.querySelector(sel); if (!i) return 0; return num(i.value !== '' ? i.value : i.placeholder); }

  function completeSet(act, i) {
    const e = act.entries[act.cur.e];
    const set = e.sets[i];
    if (set.done) { set.done = false; save(); render(); return; }
    set.w = readNum(`[data-w="${i}"]`);
    set.r = readNum(`[data-r="${i}"]`);
    set.done = true; set.ts = Date.now();
    if (i !== act.cur.s) { save(); render(); return; }
    const st = steps(act).find(x => x.e === act.cur.e && x.s === i);
    const more = advance(act);
    if (more && st && st.rest) startRest(act, st.rest);
    beep(880, 70, 0.12);
    save(); render();
    if (!more) finishPrompt();
  }

  async function onClick(ev) {
    const act = D().active;
    if (!act) return;
    const t = ev.target.closest('button, [data-ck]');
    if (!t) return;
    const ds = t.dataset;
    const e = act.entries[act.cur.e];
    if (audio === null && D().profile.sound) beep(1, 1, 0.0001); // débloque l'audio sur mobile

    if (ds.close != null) return closeMenu(act);
    if (ds.pause != null) {
      if (act.pausedAt) {
        const delta = Date.now() - act.pausedAt;
        act.pausedTotal += delta;
        if (act.rest) act.rest.start += delta;
        if (act.timer) { act.timer.start += delta; act.timer.began += delta; }
        act.pausedAt = null;
      } else act.pausedAt = Date.now();
      save(); render(); return;
    }
    if (ds.list != null) return listSheet(act);
    if (ds.ok != null) return completeSet(act, Number(ds.ok));
    if (ds.addset != null) { const last = e.sets[e.sets.length - 1]; e.sets.push({ w: last ? last.w : null, r: null, done: false }); save(); render(); return; }
    if (ds.info) return A.cmp.exInfo(ds.info);
    if (ds.swap != null) return swapSheet(act, e);
    if (ds.restadj) { if (!act.rest) return; act.rest.dur =Math.max(5, act.rest.dur + Number(ds.restadj)); save(); updateTick(); return; }
    if (ds.skiprest != null) { act.rest = null; save(); render(); return; }
    if (ds.tstart != null) return startTimer(act);
    if (ds.tstop != null) return finishTimer(act, true);
    if (ds.tskip != null) {
      const tm = act.timer;
      const ph = tm.phases[tm.idx];
      tm.start = now(act) - ph.d * 1000;
      updateTick(); return;
    }
    if (ds.ck != null) { e.checked[Number(ds.ck)] = !e.checked[Number(ds.ck)]; save(); render(); return; }
    if (ds.listdone != null || ds.listskip != null) {
      e.done = true;
      const more = advance(act);
      save(); render();
      if (!more) finishPrompt();
      return;
    }
    if (ds.cmanual != null) {
      e.done = true; e.result.durationSec = G.cardioSeconds(e); save(); render(); return;
    }
    if (ds.cnext != null) {
      const more = advance(act);
      save(); render();
      if (!more) finishPrompt();
    }
  }

  function onChange(ev) {
    const act = D().active;
    if (!act) return;
    const t = ev.target, e = act.entries[act.cur.e];
    if (t.dataset.w != null) { e.sets[Number(t.dataset.w)].w = t.value === '' ? null : num(t.value); save(); }
    else if (t.dataset.r != null) { e.sets[Number(t.dataset.r)].r = t.value === '' ? null : num(t.value); save(); }
    else if (t.dataset.dist != null) { e.result.distance = num(t.value) || null; save(); }
  }

  function listSheet(act) {
    const close = ui.sheet({
      title: 'Exercices de la séance',
      html: `<div class="pick-list" style="margin-top:0">${act.entries.map((x, i) => {
        const prog = x.kind === 'ex' ? `${x.sets.filter(s => s.done).length}/${x.sets.length}` : x.done ? '✓' : '';
        const full = x.kind === 'ex' ? x.sets.every(s => s.done) : x.done;
        return `<button class="pick" data-go="${i}" ${i === act.cur.e ? 'style="background:var(--card)"' : ''}><div class="grow"><div class="pk-n">${ui.esc(x.name)}</div><div class="pk-m">${ui.esc(x.block || '')}</div></div>
          <span class="tag ${full ? 'accent' : ''}">${prog}</span></button>`;
      }).join('')}</div>
      <div class="row gap wrap mt"><button class="btn" data-addex>${ui.icon('plus')} Ajouter un exercice</button><span class="grow"></span><button class="btn primary" data-finish>${ui.icon('check')} Terminer la séance</button></div>`,
      onMount(b, c) {
        b.onclick = ev => {
          const go = ev.target.closest('[data-go]');
          if (go) {
            const i = Number(go.dataset.go), x = act.entries[i];
            const s = x.kind === 'ex' ? Math.max(0, x.sets.findIndex(z => !z.done)) : 0;
            act.cur = { e: i, s }; act.rest = null; if (act.timer && act.timer.e !== i) act.timer = null;
            save(); c(); render(); return;
          }
          if (ev.target.closest('[data-addex]')) {
            c();
            A.cmp.exPicker({
              onPick: id => {
                const ex = A.exById(id);
                const it = gearItem(act, ex.hold ? G.I(id, 3, 30, 60) : G.I(id, 3, '8-12', 90, { rir: '1-2' }));
                const entry = { key: 'x' + ui.uid(), kind: 'ex', block: 'Ajouté', blockKind: 'hyper', exId: id, name: ex.n, item: it, reps: it.reps, hold: it.hold || null, rir: it.rir, load: it.load, note: it.gearNote, uni: !!ex.uni, bw: !!ex.bw, rest: it.rest, group: null, restRound: 0, sets: Array.from({ length: 3 }, () => ({ w: null, r: null, done: false })) };
                const at = act.entries[act.cur.e] && act.entries[act.cur.e].group ? act.entries.findIndex((z, k) => k > act.cur.e && z.group !== act.entries[act.cur.e].group) : act.cur.e + 1;
                const pos = at < 0 ? act.entries.length : at;
                act.entries.splice(pos, 0, entry);
                if (act.timer && act.timer.e >= pos) act.timer.e++;
                if (act.cur.e >= pos) act.cur.e++;
                save(); render(); ui.toast(`${ex.n} ajouté`);
              },
            });
            return;
          }
          if (ev.target.closest('[data-finish]')) { c(); finishPrompt(true); }
        };
      },
    });
    return close;
  }

  function swapSheet(act, e) {
    const alts = G.alternatives(e.item, act.session).slice(0, 10);
    ui.sheet({
      title: 'Remplacer',
      html: `<p class="small muted">Machine prise ou exercice gênant ? Choisis un équivalent.</p><div class="pick-list">${alts.map(x => `<button class="pick" data-id="${x.id}"><div class="grow"><div class="pk-n">${ui.esc(x.n)}</div><div class="pk-m">${x.m.map(A.mName).join(', ')}</div></div></button>`).join('') || '<p class="empty small">Aucune alternative avec ton matériel.</p>'}</div>`,
      onMount(b, c) {
        b.onclick = ev => {
          const p = ev.target.closest('[data-id]'); if (!p) return;
          const ex = A.exById(p.dataset.id);
          G.applySwap(e.item, ex.id);
          gearItem(act, e.item, e.blockKind);
          e.exId = ex.id; e.name = ex.n; e.uni = !!ex.uni; e.bw = !!ex.bw; e.hold = e.item.hold || null; e.reps = e.item.reps;
          e.load = e.item.load; e.note = [e.item.gearNote, e.item.note].filter(Boolean).join(' ');
          e.sets.forEach(s => { if (!s.done) { s.w = null; s.r = null; } });
          save(); c(); render();
        };
      },
    });
  }

  function closeMenu(act) {
    ui.sheet({
      title: 'Quitter la séance ?',
      html: `<div class="stack"><button class="btn block" data-later>${ui.icon('pause')} Continuer plus tard</button>
        <button class="btn primary block" data-end>${ui.icon('check')} Terminer et enregistrer</button>
        <button class="btn danger-ghost block" data-abort>${ui.icon('trash')} Abandonner sans enregistrer</button></div>`,
      onMount(b, c) {
        b.querySelector('[data-later]').onclick = () => { c(); hide(); ui.toast('Séance gardée : reprends-la quand tu veux'); };
        b.querySelector('[data-end]').onclick = () => { c(); finishPrompt(true); };
        b.querySelector('[data-abort]').onclick = async () => {
          c();
          if (await ui.confirm('Abandonner cette séance ? Les séries faites ne seront pas enregistrées.', { ok: 'Abandonner', danger: true })) {
            D().active = null; save(); hide();
          }
        };
      },
    });
  }

  // ——— Bilan et enregistrement ———
  function collect(act) {
    const exercises = act.entries.filter(e => e.kind === 'ex').map(e => ({ exId: e.exId, name: e.name, sets: e.sets.filter(s => s.done).map(s => ({ w: s.w || 0, r: s.r || 0 })) })).filter(e => e.sets.length);
    const cardio = act.entries.filter(e => e.kind === 'cardio' && e.done).map(e => ({ name: e.name, durationSec: e.result.durationSec || G.cardioSeconds(e), distance: e.result.distance || null, hard: !!e.hard }));
    return { exercises, cardio };
  }

  function finishPrompt(manual) {
    const act = D().active;
    if (!act) return;
    if (act.timer) act.timer = null;
    act.rest = null;
    const { exercises, cardio } = collect(act);
    if (!exercises.length && !cardio.length) {
      ui.toast(manual ? 'Aucune série validée pour l\'instant' : 'Séance vide');
      return;
    }
    const durationSec = Math.round((now(act) - act.startedAt - act.pausedTotal) / 1000);
    A.player.finishForm({ session: act.session, exercises, cardio, durationSec, startedAt: act.startedAt, mode: 'live' });
  }

  A.player = {
    start(session) {
      const go = () => { D().active = build(session); save(); this.resume(); };
      if (D().active) {
        ui.confirm('Une séance est déjà en cours. La remplacer par celle-ci ?', { ok: 'Remplacer' }).then(ok => { if (ok) go(); });
      } else go();
    },
    resume() {
      if (!D().active) return;
      ensureRoot();
      root.classList.add('open');
      document.body.classList.add('no-scroll');
      lockScreen();
      clearInterval(tickId);
      tickId = setInterval(updateTick, 250);
      render();
      if (A.app) A.app.refreshPill();
    },

    // Bilan commun au mode guidé et à la version écrite
    finishForm({ session, exercises, cardio, durationSec, startedAt, mode }) {
      const before = startedAt;
      let volume = 0, totalSets = 0, totalReps = 0;
      const prs = [];
      exercises.forEach(e => {
        const ex = A.exById(e.exId) || {};
        e.sets.forEach(s => { totalSets++; if (!ex.hold) { totalReps += s.r; if (s.w > 0) volume += s.w * s.r; } });
        const e1 = Math.max(0, ...e.sets.map(s => A.e1rm(s.w, s.r)));
        const prev = A.prog.bestE1RM(e.exId, before);
        if (e1 > 0 && prev > 0 && e1 > prev + 0.05) prs.push({ exId: e.exId, name: e.name, label: `1RM estimé ${ui.num(e1, 1)} kg (avant ${ui.num(prev, 1)} kg)` });
        else if (!e.sets.some(s => s.w > 0)) {
          const best = Math.max(0, ...e.sets.map(s => s.r || 0));
          const pr = A.prog.bestReps(e.exId, before);
          if (pr > 0 && best > pr) prs.push({ exId: e.exId, name: e.name, label: ex.hold ? `${best} s (avant ${pr} s)` : `${best} reps (avant ${pr})` });
        }
      });
      let rpe = 7;
      const RPE = ['Très facile', 'Facile', 'Modéré', 'Assez dur', 'Dur', 'Dur', 'Très dur', 'Très dur', 'Presque maximal', 'Maximal'];
      ui.sheet({
        title: 'Bilan de la séance',
        html: `<div class="summary-hero">${ui.icon('trophy')}<h2 class="mt-s">Bien joué !</h2><p class="muted">${ui.esc(session.title)}</p></div>
          <div class="grid3"><div class="stat"><div class="v">${ui.fmtDur(durationSec)}</div><div class="l">Durée</div></div>
            <div class="stat"><div class="v">${totalSets}</div><div class="l">Séries</div></div>
            <div class="stat"><div class="v">${volume >= 1000 ? ui.num(volume / 1000, 1) + '<small>t</small>' : ui.num(volume) + '<small>kg</small>'}</div><div class="l">Volume</div></div></div>
          ${prs.map(p => `<div class="pr-line">${ui.icon('trophy')}<span><b>Record · ${ui.esc(p.name)}</b><br>${ui.esc(p.label)}</span></div>`).join('')}
          <label class="field mt"><span>Durée (minutes)</span><input type="number" min="1" data-dur value="${Math.max(1, Math.round(durationSec / 60))}"></label>
          <div class="field"><span class="small muted">Effort de la séance : <b data-rpel>${rpe} · ${RPE[rpe - 1]}</b></span><div class="rpe-scale mt-s" data-rpe>${Array.from({ length: 10 }, (_, i) => `<button class="${i + 1 === rpe ? 'on' : ''}" data-v="${i + 1}">${i + 1}</button>`).join('')}</div>
            <span class="tiny faint">Sert à calculer ta charge d'entraînement (sRPE).</span></div>
          <label class="field"><span>Notes</span><textarea data-notes placeholder="Sensations, douleurs, ce qui a bien marché…"></textarea></label>
          <button class="btn primary xl" data-save>${ui.icon('check')} Enregistrer la séance</button>
          ${mode === 'live' ? '<button class="btn ghost block mt-s" data-close>Revenir à la séance</button>' : ''}`,
        onMount(b, close) {
          b.querySelector('[data-rpe]').onclick = ev => {
            const x = ev.target.closest('[data-v]'); if (!x) return;
            rpe = Number(x.dataset.v);
            b.querySelectorAll('[data-rpe] button').forEach(y => y.classList.toggle('on', y === x));
            b.querySelector('[data-rpel]').textContent = `${rpe} · ${RPE[rpe - 1]}`;
          };
          b.querySelector('[data-save]').onclick = () => {
            const d = D();
            const muscles = [...new Set(exercises.flatMap(e => (A.exById(e.exId) || { m: [] }).m))];
            const dist = cardio.reduce((s, c) => s + (c.distance || 0), 0);
            const h = {
              id: ui.uid(), type: exercises.length && cardio.length ? 'mixte' : cardio.length ? 'cardio' : 'muscu', title: session.title,
              date: startedAt, durationSec: (Number(b.querySelector('[data-dur]').value) || Math.round(durationSec / 60)) * 60,
              goal: session.goal || null, source: session.source || null, planRef: session.planRef || null, muscles, exercises, cardio,
              setup: session.setup ? A.setupName(session.setup) : null,
              distance: dist || null, volume: Math.round(volume), totalSets, totalReps, rpe, notes: b.querySelector('[data-notes]').value.trim(), prs, mode,
            };
            d.history.push(h);
            d.history.sort((x, y) => y.date - x.date);
            if (session.planRef && d.plan && d.plan.id === session.planRef.id) d.plan.done[`${session.planRef.w}-${session.planRef.s}`] = h.id;
            if (mode === 'live') d.active = null;
            A.store.save();
            close();
            if (mode === 'live') hide();
            ui.toast(prs.length ? `Séance enregistrée · ${prs.length} record${prs.length > 1 ? 's' : ''} !` : 'Séance enregistrée');
            location.hash = '#/history/' + h.id;
          };
        },
      });
    },
  };

  function hide() {
    if (root) { root.classList.remove('open'); root.innerHTML = ''; }
    clearInterval(tickId); tickId = null;
    unlockScreen();
    document.body.classList.remove('no-scroll');
    if (A.app) { A.app.refreshPill(); A.app.route(); }
  }
})(window.A);
