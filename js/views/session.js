/* Athlos — aperçu et édition d'une séance, version écrite imprimable */
(function (A) {
  'use strict';
  const ui = A.ui, G = A.gen, cmp = () => A.cmp;
  const KIND = { force: 'Force', hyper: 'Hypertrophie', circuit: 'Circuit', cardio: 'Cardio' };
  const RESTS = [0, 15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 210, 240, 300];

  A.views.session = function (el) {
    const s = A.state.draft;
    if (!s) { location.hash = '#/record'; return; }
    let editing = s.source === 'custom';
    const checks = A.state.checks = A.state.checks && A.state.checks.id === s.id ? A.state.checks : { id: s.id, sets: {}, kg: {} };

    function render() {
      G.refresh(s);
      el.innerHTML = A.state.written ? writtenHTML() : editHTML();
      bind();
      if (A.state.openPicker) { A.state.openPicker = false; addExercise(); }
    }

    // ——— Mode aperçu / édition ———
    function editHTML() {
      const goal = s.goal && G.GOALS[s.goal] ? G.GOALS[s.goal].n : null;
      let n = 0;
      return `<div class="page-head no-print"><a class="back" href="#/record" aria-label="Retour">${ui.icon('left')}</a>
          <h1 data-title>${ui.esc(s.title)}</h1><button class="icon-btn" data-rename aria-label="Renommer">${ui.icon('edit')}</button></div>
        <div class="sess-head">
          <div class="chips"><span class="tag accent">${ui.icon('clock', 'sm')} ≈ ${s.estMin} min</span>${goal ? `<span class="tag">${goal}</span>` : ''}
            ${(s.muscles || []).slice(0, 6).map(m => `<span class="tag">${A.mName(m)}</span>`).join('')}${s.weak ? `<span class="tag warn">Priorité ${A.mName(s.weak)}</span>` : ''}</div>
          ${s.missing && s.missing.length ? `<div class="note warn mt">${ui.icon('info')}<span>Aucun exercice disponible avec ton matériel pour : <b>${s.missing.map(A.mName).join(', ')}</b>. Ajoute du matériel dans le questionnaire ou ton profil.</span></div>` : ''}
          ${s.skipped && s.skipped.length ? `<div class="note mt">${ui.icon('clock')}<span>En ${s.params ? s.params.duration : s.estMin} min, priorité aux exercices les plus rentables : pas le temps de travailler aussi <b>${s.skipped.map(A.mName).join(', ')}</b>. Choisis plus de temps ou moins de zones pour les inclure.</span></div>` : ''}
          ${s.notes && s.notes.length ? `<details class="card mt"><summary class="row between"><span class="row gap-s"><span class="accent">${ui.icon('flask')}</span><b>Pourquoi cette séance ?</b></span>${ui.icon('down')}</summary>
            <ul class="small muted" style="margin:10px 0 0;padding-left:18px">${s.notes.map(x => `<li style="margin-bottom:6px">${ui.esc(x)}</li>`).join('')}</ul></details>` : ''}
        </div>

        <div class="sticky-cta no-print">
          <button class="btn primary xl grow" data-start ${s.blocks.some(b => b.items.length) ? '' : 'disabled'}>${ui.icon('play')} Commencer · mode guidé</button>
          <button class="btn xl" style="width:auto" data-written aria-label="Version écrite">${ui.icon('list')}<span class="hide-s">Version écrite</span></button>
        </div>

        ${s.warmup && s.warmup.length ? `<div class="block"><div class="block-h"><h3>Échauffement</h3><span class="line"></span><span class="small faint">≈ ${Math.round((s.warmupSec || 360) / 60)} min</span></div>
          <div class="card"><ul class="warm-list">${s.warmup.map(w => `<li><span class="accent">${ui.icon('flame', 'sm')}</span><div><b>${ui.esc(w.n)}</b><span class="muted">${ui.esc(w.d)}</span></div></li>`).join('')}</ul></div></div>` : ''}

        ${s.blocks.map((b, bi) => `<div class="block">
          <div class="block-h"><h3>${ui.esc(b.title)}</h3><span class="line"></span><span class="tag">${KIND[b.kind] || ''}</span>${b.optional ? '<span class="tag">facultatif</span>' : ''}</div>
          ${b.kind === 'circuit' ? `<p class="small muted mb">${b.rounds} tours · repos ${b.restEx} s entre exercices, ${cmp().restLabel(b.restRound)} entre les tours</p>` : ''}
          ${b.note ? `<p class="small muted mb">${ui.esc(b.note)}</p>` : ''}
          ${b.items.map((it, ii) => itemHTML(it, b, bi, ii, ++n)).join('') || '<p class="small muted">Aucun exercice pour l\'instant.</p>'}
        </div>`).join('')}

        <div class="row gap wrap mt no-print">
          <button class="btn" data-add>${ui.icon('plus')} Exercice</button>
          <button class="btn" data-addcardio>${ui.icon('run')} Cardio</button>
          <button class="btn ghost" data-edit>${ui.icon('sliders')} ${editing ? 'Terminer l\'édition' : 'Modifier'}</button>
        </div>

        ${s.cooldown && s.cooldown.length ? `<div class="block"><div class="block-h"><h3>Retour au calme</h3><span class="line"></span></div>
          <div class="card"><ul class="warm-list">${s.cooldown.map(w => `<li><span class="accent">${ui.icon('heart', 'sm')}</span><div><b>${ui.esc(w.n)}</b><span class="muted">${ui.esc(w.d)}</span></div></li>`).join('')}</ul></div></div>` : ''}

        <div class="row gap wrap mt-l no-print">
          ${s.source === 'quiz' ? `<button class="btn" data-regen>${ui.icon('refresh')} Autre proposition</button>` : ''}
          <button class="btn ghost" data-fav>${ui.icon('star')} Enregistrer dans « Mes séances »</button>
        </div>`;
    }

    function itemHTML(it, b, bi, ii, n) {
      const key = `${bi}-${ii}`;
      if (it.type === 'cardio') {
        return `<div class="item"><span class="num">${ui.icon('run', 'sm')}</span><div class="grow"><div class="item-name">${ui.esc(it.name)}</div>
          <div class="item-meta">${cmp().cardioMeta(it)}</div>${it.intensity ? `<div class="item-sugg">${ui.esc(it.intensity)}</div>` : ''}
          ${it.note ? `<p class="small faint mt-s">${ui.esc(it.note)}</p>` : ''}</div>
          ${editing ? `<div class="item-tools"><button class="icon-btn sm" data-del="${key}" aria-label="Retirer">${ui.icon('trash', 'sm')}</button></div>` : ''}</div>`;
      }
      const ex = A.exById(it.exId);
      if (!ex) return '';
      const sug = A.prog.suggest(it, 0);
      return `<div class="item ${it.weak ? 'weak' : ''}"><span class="num">${n}</span><div class="grow">
          <div class="item-name" data-info="${ex.id}">${ui.esc(ex.n)}${ex.uni ? ' <span class="small faint">(par côté)</span>' : ''}</div>
          <div class="item-meta">${cmp().itemMeta(it, b)}</div>
          ${it.load ? `<div class="small muted mt-s">${ui.esc(it.load)}</div>` : ''}
          ${sug && (sug.w || sug.r) ? `<div class="item-sugg">${ui.icon('bolt', 'sm')} ${sug.w ? ui.num(sug.w, 1) + ' kg' : '+1 rep'} · ${ui.esc(sug.why)}</div>` : ''}
          ${it.note ? `<p class="small faint mt-s">${ui.esc(it.note)}</p>` : ''}
          ${editing ? `<div class="edit-row">
            ${b.kind !== 'circuit' ? `<span class="stepper"><button data-sets="${key}" data-d="-1" aria-label="Moins de séries">−</button><span>${it.sets}</span><button data-sets="${key}" data-d="1" aria-label="Plus de séries">+</button></span><span class="small muted">séries</span>` : ''}
            ${it.hold ? `<input data-hold="${key}" type="number" min="5" step="5" value="${it.hold}" aria-label="Durée en secondes"><span class="small muted">s</span>`
              : `<input data-reps="${key}" value="${ui.esc(it.reps)}" aria-label="Répétitions"><span class="small muted">reps</span>`}
            ${b.kind !== 'circuit' ? `<select data-rest="${key}" aria-label="Repos">${RESTS.map(r => `<option value="${r}" ${r === it.rest ? 'selected' : ''}>${r ? 'repos ' + cmp().restLabel(r) : 'sans repos'}</option>`).join('')}</select>` : ''}
          </div>` : ''}
        </div>
        <div class="item-tools no-print">
          <button class="icon-btn sm" data-swap="${key}" aria-label="Remplacer" title="Remplacer">${ui.icon('swap', 'sm')}</button>
          ${editing ? `<button class="icon-btn sm" data-up="${key}" aria-label="Monter">${ui.icon('up', 'sm')}</button>
          <button class="icon-btn sm" data-del="${key}" aria-label="Retirer">${ui.icon('trash', 'sm')}</button>` : ''}
        </div></div>`;
    }

    // ——— Version écrite ———
    function writtenHTML() {
      let n = 0;
      const box = (key, i) => `<button class="w-check ${checks.sets[key] && checks.sets[key][i] ? 'on' : ''}" data-ck="${key}" data-i="${i}" aria-label="Série ${i + 1}">${checks.sets[key] && checks.sets[key][i] ? '✓' : i + 1}</button>`;
      return `<div class="row gap no-print mb"><button class="btn" data-back>${ui.icon('left')} Aperçu</button><span class="grow"></span>
          <button class="btn" data-print>${ui.icon('print')} Imprimer</button></div>
        <div class="written">
          <div class="small muted">${ui.fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })} · ≈ ${s.estMin} min</div>
          <h1 class="mt-s">${ui.esc(s.title)}</h1>
          ${s.warmup && s.warmup.length ? `<h3 class="mt">Échauffement</h3><ul class="small" style="padding-left:18px;margin:6px 0 0">${s.warmup.map(w => `<li><b>${ui.esc(w.n)}</b> — ${ui.esc(w.d)}</li>`).join('')}</ul>` : ''}
          ${s.blocks.map((b, bi) => `<h3 class="mt-l">${ui.esc(b.title)}${b.kind === 'circuit' ? ` · ${b.rounds} tours` : ''}</h3>
            ${b.kind === 'circuit' ? `<p class="small muted">Repos ${b.restEx} s entre exercices, ${cmp().restLabel(b.restRound)} entre les tours.</p>` : ''}
            <table class="w-table"><thead><tr><th>Exercice</th><th>Prescription</th><th>Charge</th><th>Séries faites</th></tr></thead><tbody>
            ${b.items.map((it, ii) => {
              const key = `${bi}-${ii}`;
              if (it.type === 'cardio') return `<tr><td class="ex"><b>${ui.esc(it.name)}</b><span class="small muted">${ui.esc(it.intensity || '')}</span></td><td class="small">${cmp().cardioMeta(it).replace(/<\/?span>/g, ' ')}</td><td></td><td>${box(key, 0)}</td></tr>`;
              const ex = A.exById(it.exId); if (!ex) return '';
              const sets = b.kind === 'circuit' ? b.rounds : it.sets;
              const sug = A.prog.suggest(it, 0);
              return `<tr><td class="ex"><b>${++n}. ${ui.esc(ex.n)}</b>${it.note ? `<span class="tiny muted">${ui.esc(it.note)}</span>` : ''}</td>
                <td class="small">${sets} × ${it.hold ? it.hold + ' s' : ui.esc(it.reps)}${b.kind !== 'circuit' && it.rest ? `<br><span class="muted">repos ${cmp().restLabel(it.rest)}</span>` : ''}${it.rir ? `<br><span class="muted">RIR ${ui.esc(it.rir)}</span>` : ''}</td>
                <td>${ex.hold || (ex.bw && !sug) ? '' : `<input class="w-kg" type="number" step="0.5" inputmode="decimal" data-kg="${key}" value="${checks.kg[key] ?? (sug && sug.w ? sug.w : '')}" placeholder="kg">`}</td>
                <td><div class="w-checks">${Array.from({ length: sets }, (_, i) => box(key, i)).join('')}</div></td></tr>`;
            }).join('')}</tbody></table>`).join('')}
          ${s.cooldown && s.cooldown.length ? `<h3 class="mt-l">Retour au calme</h3><ul class="small" style="padding-left:18px;margin:6px 0 0">${s.cooldown.map(w => `<li><b>${ui.esc(w.n)}</b> — ${ui.esc(w.d)}</li>`).join('')}</ul>` : ''}
        </div>
        <div class="sticky-cta no-print"><button class="btn primary xl" data-logw>${ui.icon('check')} J'ai terminé : enregistrer la séance</button></div>`;
    }

    // ——— Actions ———
    const at = key => { const [bi, ii] = key.split('-').map(Number); return { b: s.blocks[bi], it: s.blocks[bi].items[ii], bi, ii }; };

    function addExercise() {
      cmp().exPicker({
        onPick: id => {
          const ex = A.exById(id);
          let b = s.blocks.find(x => x.kind !== 'cardio' && x.kind !== 'circuit');
          if (!b) { b = G.B('hyper', 'Exercices', []); const ci = s.blocks.findIndex(x => x.kind === 'cardio'); ci < 0 ? s.blocks.push(b) : s.blocks.splice(ci, 0, b); }
          b.items.push(ex.hold ? G.I(id, 3, 30, 60) : G.I(id, 3, ex.t === 'comp' ? '8-10' : '10-15', ex.t === 'comp' ? 150 : 90, { rir: '1-2' }));
          render();
        },
      });
    }

    function addCardio() {
      const C = G.C;
      const opts = [['z2', 'Zone 2 (continu facile)', () => C.z2(mod(), dur())], ['seuil', 'Seuil', () => C.seuil(mod(), dur())], ['3030', '30/30 (VMA)', () => C.billat(mod(), dur())],
        ['1x1', '1 min / 1 min', () => C.hiit11(mod(), dur())], ['4x4', '4 × 4 norvégien', () => C.n4x4(mod())], ['tabata', 'Tabata', () => C.tabata(mod())], ['4020', 'Circuit 40/20', () => C.c4020(dur())]];
      let mod = () => 'course', dur = () => 20;
      ui.sheet({
        title: 'Ajouter du cardio',
        html: `<div class="grid2"><label class="field"><span>Mode</span><select data-mod><option value="course">Course</option><option value="velo">Vélo / rameur</option><option value="circuit">Circuit poids du corps</option></select></label>
          <label class="field"><span>Durée (min)</span><input type="number" data-dur value="20" min="4"></label></div>
          <div class="stack">${opts.map(([k, n]) => `<button class="btn block" data-k="${k}">${n}</button>`).join('')}</div>`,
        onMount(body, close) {
          mod = () => body.querySelector('[data-mod]').value;
          dur = () => Number(body.querySelector('[data-dur]').value) || 20;
          body.onclick = e => {
            const b = e.target.closest('[data-k]'); if (!b) return;
            const item = opts.find(o => o[0] === b.dataset.k)[2]();
            let blk = s.blocks.find(x => x.kind === 'cardio');
            if (!blk) { blk = G.B('cardio', 'Cardio', []); s.blocks.push(blk); }
            blk.items.push(item);
            close(); render();
          };
        },
      });
    }

    function swap(key) {
      const { it } = at(key);
      const alts = G.alternatives(it, s).slice(0, 12);
      ui.sheet({
        title: 'Remplacer l\'exercice',
        html: `<p class="small muted">Mêmes muscles, avec ton matériel. Séries, reps et repos sont conservés.</p>
          <div class="pick-list">${alts.map(ex => `<button class="pick" data-id="${ex.id}"><div class="grow"><div class="pk-n">${ui.esc(ex.n)}</div><div class="pk-m">${ex.m.map(A.mName).join(', ')}</div></div>${ex.str ? '<span class="tag accent">Étirement</span>' : ''}</button>`).join('') || '<p class="empty small">Aucune alternative avec ton matériel.</p>'}</div>
          <button class="btn ghost block mt" data-all>${ui.icon('list')} Voir tous les exercices</button>`,
        onMount(body, close) {
          body.querySelector('.pick-list').onclick = e => { const b = e.target.closest('[data-id]'); if (b) { G.applySwap(it, b.dataset.id); close(); render(); } };
          body.querySelector('[data-all]').onclick = () => { close(); cmp().exPicker({ title: 'Remplacer par…', muscle: A.exById(it.exId).m[0], onPick: id => { G.applySwap(it, id); render(); } }); };
        },
      });
    }

    async function logWritten() {
      const exercises = [];
      const cardio = [];
      s.blocks.forEach((b, bi) => b.items.forEach((it, ii) => {
        const key = `${bi}-${ii}`;
        const done = checks.sets[key] || [];
        if (it.type === 'cardio') { if (done[0]) cardio.push({ name: it.name, durationSec: G.cardioSeconds(it), hard: !!it.hard }); return; }
        const n = b.kind === 'circuit' ? b.rounds : it.sets;
        const count = done.filter(Boolean).length;
        if (!count) return;
        const w = Number(checks.kg[key]) || 0;
        const r = it.hold || G.repsLow(it.reps);
        exercises.push({ exId: it.exId, name: A.exById(it.exId).n, sets: Array.from({ length: Math.min(count, n) }, () => ({ w, r })) });
      }));
      if (!exercises.length && !cardio.length) { ui.toast('Coche les séries que tu as faites'); return; }
      A.player.finishForm({ session: s, exercises, cardio, durationSec: s.estMin * 60, startedAt: Date.now() - s.estMin * 60000, mode: 'written' });
    }

    function bind() {
      el.onclick = async e => {
        const t = e.target.closest('button, [data-info]');
        if (!t) return;
        const ds = t.dataset;
        if (ds.start != null) { A.player.start(s); return; }
        if (ds.written != null) { A.state.written = true; render(); window.scrollTo(0, 0); return; }
        if (ds.back != null) { A.state.written = false; render(); return; }
        if (ds.print != null) { window.print(); return; }
        if (ds.logw != null) { logWritten(); return; }
        if (ds.info) { cmp().exInfo(ds.info); return; }
        if (ds.add != null) { addExercise(); return; }
        if (ds.addcardio != null) { addCardio(); return; }
        if (ds.edit != null) { editing = !editing; render(); return; }
        if (ds.swap) { swap(ds.swap); return; }
        if (ds.del) { const { b, ii } = at(ds.del); b.items.splice(ii, 1); s.blocks = s.blocks.filter(x => x.items.length || x.kind === 'hyper'); render(); return; }
        if (ds.up) { const { b, ii } = at(ds.up); if (ii > 0) { [b.items[ii - 1], b.items[ii]] = [b.items[ii], b.items[ii - 1]]; render(); } return; }
        if (ds.sets) { const { it } = at(ds.sets); it.sets = ui.clamp(it.sets + Number(ds.d), 1, 10); render(); return; }
        if (ds.ck) {
          const arr = checks.sets[ds.ck] = checks.sets[ds.ck] || [];
          arr[Number(ds.i)] = !arr[Number(ds.i)];
          t.classList.toggle('on', !!arr[Number(ds.i)]);
          t.textContent = arr[Number(ds.i)] ? '✓' : Number(ds.i) + 1;
          return;
        }
        if (ds.regen != null) { A.state.draft = G.generate(Object.assign({}, s.params, { seed: 0 })); A.views.session(el); ui.toast('Nouvelle proposition générée'); return; }
        if (ds.fav != null) { const f = ui.clone(s); f.source = f.source === 'quiz' ? 'favori' : f.source; A.store.data.favorites.unshift(f); A.store.save(); ui.toast('Ajoutée à « Mes séances »'); return; }
        if (ds.rename != null) {
          ui.sheet({ title: 'Nom de la séance', html: `<input data-n value="${ui.esc(s.title)}"><button class="btn primary block mt" data-ok>Valider</button>`,
            onMount(body, close) { const i = body.querySelector('[data-n]'); i.focus(); i.select(); body.querySelector('[data-ok]').onclick = () => { s.title = i.value.trim() || s.title; close(); render(); }; } });
        }
      };
      el.onchange = e => {
        const t = e.target, ds = t.dataset;
        if (ds.reps) at(ds.reps).it.reps = t.value.trim() || '8-12';
        else if (ds.hold) at(ds.hold).it.hold = Math.max(5, Number(t.value) || 30);
        else if (ds.rest) at(ds.rest).it.rest = Number(t.value);
        else if (ds.kg) { checks.kg[ds.kg] = t.value; return; }
        else return;
        G.refresh(s);
        const chip = el.querySelector('.sess-head .tag.accent');
        if (chip) chip.innerHTML = `${ui.icon('clock', 'sm')} ≈ ${s.estMin} min`;
      };
    }

    render();
  };
})(window.A);
