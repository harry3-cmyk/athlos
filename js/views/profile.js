/* Athlos — profil, réglages, sauvegarde des données, page science */
(function (A) {
  'use strict';
  const ui = A.ui, D = A.DATA, G = A.gen;
  const KEY_LIFTS = [['bench', 'Développé couché'], ['squat', 'Squat'], ['deadlift', 'Soulevé de terre'], ['ohp', 'Développé militaire']];

  A.applyTheme = () => {
    const t = A.store.data.profile.theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  };

  A.views.profile = function (el) {
    const d = A.store.data, P = d.profile;
    function render() {
      const eq = new Set(P.equipment);
      el.innerHTML = `<div class="page-head"><h1>Profil</h1></div>
        <div class="card">
          <label class="field"><span>Prénom ou pseudo</span><input data-p="name" value="${ui.esc(P.name)}" placeholder="Ton prénom"></label>
          <label class="field"><span>Poids de corps (kg)</span><input data-p="bodyweight" type="number" step="0.1" inputmode="decimal" value="${P.bodyweight ?? ''}"></label>
          <div class="field"><span class="small muted">Niveau</span><div class="seg mt-s" data-lvl>${Object.entries(G.LEVEL_NAMES).map(([k, n]) => `<button class="${P.level === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div></div>
          <div class="field"><span class="small muted">Matériel disponible par défaut</span><div class="chips mt-s" data-eq>${Object.entries(D.EQUIP).map(([k, n]) => `<button class="chip ${eq.has(k) ? 'on' : ''}" data-k="${k}">${eq.has(k) ? ui.icon('check', 'sm') : ''}${n}</button>`).join('')}</div></div>
        </div>

        <div class="section-title"><h2>Mes maximums (1RM)</h2></div>
        <div class="card"><p class="small muted mb">Utilisés pour calculer les charges en kilos. Laisse vide : Athlos estime ton 1RM à partir de tes séances.</p>
          <div class="grid2">${KEY_LIFTS.map(([id, n]) => { const est = A.prog.bestE1RM(id); return `<label class="field"><span>${n}</span><input type="number" step="2.5" inputmode="decimal" data-orm="${id}" value="${P.orm[id] ?? ''}" placeholder="${est ? 'estimé ' + ui.num(est, 1) : 'kg'}"></label>`; }).join('')}</div></div>

        <div class="section-title"><h2>Réglages</h2></div>
        <div class="card">
          <div class="field"><span class="small muted">Thème</span><div class="seg mt-s" data-theme>${[['auto', 'Automatique'], ['dark', 'Sombre'], ['light', 'Clair']].map(([k, n]) => `<button class="${P.theme === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</div></div>
          <label class="row between mt"><span>Bip de fin de repos</span><input type="checkbox" data-toggle="sound" ${P.sound ? 'checked' : ''} style="width:auto;min-height:0"></label>
          <label class="row between mt"><span>Vibration (mobile)</span><input type="checkbox" data-toggle="vibrate" ${P.vibrate ? 'checked' : ''} style="width:auto;min-height:0"></label>
        </div>

        <div class="section-title"><h2>Mes données</h2></div>
        <div class="card"><p class="small muted">Tout est stocké sur cet appareil, dans ton navigateur : rien n'est envoyé sur un serveur. Exporte une sauvegarde pour changer d'appareil ou ne rien perdre.</p>
          <div class="row gap wrap mt"><button class="btn" data-export>${ui.icon('download')} Exporter</button>
            <label class="btn">${ui.icon('upload')} Importer<input type="file" accept="application/json,.json" data-import class="sr"></label>
            <button class="btn danger-ghost" data-reset>${ui.icon('trash')} Tout effacer</button></div>
          <p class="tiny faint mt">${d.history.length} séances · ${d.favorites.length} séances enregistrées · ${d.customEx.length} exercices personnalisés</p></div>

        <a class="card link mt row gap" href="#/science"><div class="fc-icon">${ui.icon('flask')}</div><div class="grow"><div class="fc-title">La science derrière Athlos</div>
          <p class="small muted">Les études et préparateurs physiques dont s'inspire le générateur.</p></div>${ui.icon('right')}</a>
        <p class="tiny faint mt-l center">Athlos donne des repères d'entraînement généraux et ne remplace pas l'avis d'un médecin ou d'un professionnel de santé. En cas de douleur, arrête l'exercice.</p>`;
      bind();
    }

    function bind() {
      el.querySelectorAll('[data-p]').forEach(i => { i.onchange = () => { const k = i.dataset.p; P[k] = k === 'bodyweight' ? (Number(i.value) || null) : i.value.trim(); A.store.save(); ui.toast('Profil mis à jour'); }; });
      el.querySelectorAll('[data-orm]').forEach(i => { i.onchange = () => { const v = Number(i.value); if (v > 0) P.orm[i.dataset.orm] = v; else delete P.orm[i.dataset.orm]; A.store.save(); ui.toast('1RM enregistré'); }; });
      el.querySelectorAll('[data-toggle]').forEach(i => { i.onchange = () => { P[i.dataset.toggle] = i.checked; A.store.save(); }; });
      el.querySelector('[data-lvl]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { P.level = b.dataset.k; A.store.save(); render(); } };
      el.querySelector('[data-theme]').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { P.theme = b.dataset.k; A.store.save(); A.applyTheme(); render(); } };
      el.querySelector('[data-eq]').onclick = e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const s = new Set(P.equipment); s.has(b.dataset.k) ? s.delete(b.dataset.k) : s.add(b.dataset.k);
        P.equipment = [...s]; A.store.save(); render();
      };
      el.querySelector('[data-export]').onclick = () => {
        const data = Object.assign({}, A.store.data, { active: null });
        ui.download(`athlos-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1));
      };
      el.querySelector('[data-import]').onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const obj = JSON.parse(await f.text());
          if (!(await ui.confirm(`Remplacer tes données actuelles par cette sauvegarde (${(obj.history || []).length} séances) ?`, { ok: 'Importer' }))) return;
          A.store.importData(obj); A.applyTheme(); ui.toast('Sauvegarde importée'); A.views.profile(el);
        } catch (err) { ui.toast('Fichier de sauvegarde invalide'); }
      };
      el.querySelector('[data-reset]').onclick = async () => {
        if (!(await ui.confirm('Effacer toutes tes séances, réglages et programmes de cet appareil ? Exporte une sauvegarde avant si tu veux les garder.', { ok: 'Tout effacer', danger: true }))) return;
        A.store.reset(); A.applyTheme(); ui.toast('Données effacées'); location.hash = '#/';
      };
    }
    render();
  };

  A.views.science = function (el) {
    const cats = [...new Set(D.SCIENCE.map(s => s.cat))];
    el.innerHTML = `<div class="page-head"><a class="back" href="#/profile" aria-label="Retour">${ui.icon('left')}</a><h1>La science</h1></div>
      <p class="muted">Chaque règle du générateur s'appuie sur la recherche en sciences du sport et sur les méthodes de préparateurs reconnus, du monde civil comme militaire. Voici lesquelles, et comment Athlos les applique.</p>
      <div class="chips mt">${cats.map(c => `<a class="chip" href="#sci-${cats.indexOf(c)}">${c}</a>`).join('')}</div>
      ${cats.map((c, ci) => `<div class="section-title" id="sci-${ci}"><h2>${c}</h2></div><div class="stack">${D.SCIENCE.filter(s => s.cat === c).map(s => `<div class="card sci-card">
        <h3>${ui.esc(s.t)}</h3><p class="mt-s">${ui.esc(s.d)}</p><p class="app">${ui.esc(s.app)}</p><p class="src">${ui.esc(s.src)}</p></div>`).join('')}</div>`).join('')}
      <div class="section-title"><h2>Préparateurs et chercheurs</h2></div>
      <div class="grid2 md3">${D.COACHES.map(c => `<div class="card coach"><b>${ui.esc(c.n)}</b><span class="tag mt-s">${ui.esc(c.f)}</span><p class="small muted mt-s">${ui.esc(c.i)}</p></div>`).join('')}</div>
      <p class="tiny faint mt-l center">Repères généraux pour adultes en bonne santé. Ils ne remplacent pas un avis médical.</p>`;
    el.onclick = e => {
      const a = e.target.closest('a[href^="#sci-"]');
      if (!a) return;
      e.preventDefault();
      document.getElementById(a.getAttribute('href').slice(1)).scrollIntoView({ behavior: 'smooth' });
    };
  };
})(window.A);
