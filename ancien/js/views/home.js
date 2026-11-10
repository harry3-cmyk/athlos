/* Athlos — accueil : fil d'activité, semaine en cours, muscles travaillés */
(function (A) {
  'use strict';
  const ui = A.ui, D = A.DATA;

  A.views.home = function (el) {
    const d = A.store.data;
    const now = Date.now();
    const weekStart = ui.startOfWeek(now);
    const week = d.history.filter(h => h.date >= weekStart);
    const wTime = week.reduce((s, h) => s + (h.durationSec || 0), 0);
    const wVol = week.reduce((s, h) => s + (h.volume || 0), 0);
    const streak = A.prog.weekStreak();
    const hour = new Date().getHours();
    const hello = hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour';
    const next = A.views.planNext ? A.views.planNext() : null;
    const tip = D.TIPS[Math.floor(now / 864e5) % D.TIPS.length];
    const act = d.active;

    el.innerHTML = `
      <section class="hero">
        <div class="small muted">${ui.fmtDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 class="mt-s">${hello}${d.profile.name ? ' ' + ui.esc(d.profile.name) : ''}</h1>
        ${act ? `<p class="hero-sub">Tu as une séance en cours : <b>${ui.esc(act.session.title)}</b>.</p>
            <div class="row gap wrap"><button class="btn primary" data-resume>${ui.icon('play')} Reprendre la séance</button></div>`
          : `<p class="hero-sub">Choisis ta séance ou laisse Athlos la construire pour toi, à partir de la recherche en sciences du sport.</p>
            <div class="row gap wrap"><a class="btn primary" href="#/record">${ui.icon('plus')} Enregistrer une séance</a>
            <a class="btn" href="#/record/quiz">${ui.icon('sparkle')} Crée ma séance</a></div>`}
      </section>

      ${next ? `<a class="card link plan-card mt" href="#/improve/${next.id}">
          <div class="row gap"><div class="fc-icon">${ui.icon('target')}</div>
          <div class="grow"><div class="small muted">Ton programme · ${ui.esc(D.IMPROVE[next.id].n)}</div>
          <div class="fc-title">${ui.esc(next.session.title)}</div>
          <div class="small muted">${next.done} / ${next.total} séances faites</div></div>${ui.icon('right')}</div></a>` : ''}

      <div class="section-title"><h2>Cette semaine</h2><a href="#/stats">Progrès ›</a></div>
      <div class="grid4">
        <div class="stat"><div class="v">${week.length}</div><div class="l">Séances</div></div>
        <div class="stat"><div class="v">${Math.round(wTime / 60)}<small>min</small></div><div class="l">Temps d'entraînement</div></div>
        <div class="stat"><div class="v">${wVol >= 1000 ? ui.num(wVol / 1000, 1) + '<small>t</small>' : ui.num(wVol) + '<small>kg</small>'}</div><div class="l">Volume soulevé</div></div>
        <div class="stat"><div class="v">${streak}<small>sem.</small></div><div class="l">Semaines d'affilée</div></div>
      </div>

      <div class="section-title"><h2>Muscles travaillés</h2><span class="small muted">séries cette semaine</span></div>
      <div class="card"><div data-body></div>
        <div class="bm-legend">0 <span class="ramp"></span> 15+ séries</div></div>

      <div class="section-title"><h2>Activité récente</h2>${d.history.length ? '<a href="#/history">Tout voir ›</a>' : ''}</div>
      <div class="stack" data-feed></div>

      <div class="card mt tip"><div class="fc-icon">${ui.icon('flask')}</div><div><div class="small muted">Le conseil science</div><p class="mt-s">${ui.esc(tip)}</p>
        <a class="small accent" href="#/science">Les principes derrière Athlos ›</a></div></div>

      <div class="section-title"><h2>16 dernières semaines</h2></div>
      <div class="card" data-cal></div>`;

    const sets = A.prog.muscleSets(weekStart);
    A.body(el.querySelector('[data-body]'), { heat: sets, heatMax: 15 });
    const feed = el.querySelector('[data-feed]');
    feed.innerHTML = d.history.length ? d.history.slice(0, 5).map(A.cmp.historyCard).join('')
      : `<div class="card empty">${ui.icon('flame')}<p><b>Aucune séance pour l'instant.</b></p><p class="small mt-s">Ta première séance apparaîtra ici, comme un fil d'activité.</p>
        <a class="btn primary mt" href="#/record/quiz">Créer ma première séance</a></div>`;
    A.cmp.calendar(el.querySelector('[data-cal]'));
    const r = el.querySelector('[data-resume]');
    if (r) r.onclick = () => A.player.resume();
  };
})(window.A);
