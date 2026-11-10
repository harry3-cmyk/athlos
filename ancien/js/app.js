/* Athlos — routeur, navigation et démarrage */
(function (A) {
  'use strict';
  const ui = A.ui;

  const ROUTES = [
    [/^#\/?$/, 'home', 'home'],
    [/^#\/record$/, 'record', 'record'],
    [/^#\/record\/quiz$/, 'quiz', 'record'],
    [/^#\/record\/know$/, 'know', 'record'],
    [/^#\/record\/manual$/, 'manual', 'record'],
    [/^#\/session$/, 'session', 'record'],
    [/^#\/improve$/, 'improve', 'record'],
    [/^#\/improve\/(\w+)$/, 'improveTarget', 'record'],
    [/^#\/history$/, 'history', 'history'],
    [/^#\/history\/(\w+)$/, 'historyDetail', 'history'],
    [/^#\/stats$/, 'stats', 'stats'],
    [/^#\/profile$/, 'profile', 'profile'],
    [/^#\/science$/, 'science', 'profile'],
  ];

  function route() {
    const hash = location.hash || '#/';
    for (const [re, view, tab] of ROUTES) {
      const m = hash.match(re);
      if (!m) continue;
      // Nouveau conteneur à chaque page : aucun écouteur ne survit d'une vue à l'autre
      const old = document.getElementById('view');
      const fresh = old.cloneNode(false);
      old.replaceWith(fresh);
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      try { A.views[view](fresh, ...m.slice(1)); }
      catch (err) {
        console.error(err);
        fresh.innerHTML = `<div class="card empty">${ui.icon('info')}<p><b>Oups, cette page a rencontré une erreur.</b></p><p class="small mt-s">${ui.esc(err.message)}</p><a class="btn mt" href="#/">Retour à l'accueil</a></div>`;
      }
      if (!hash.startsWith('#sci-')) window.scrollTo(0, 0);
      refreshPill();
      return;
    }
    location.hash = '#/';
  }

  function refreshPill() {
    const pill = document.getElementById('resume-pill');
    const open = document.getElementById('player-root').classList.contains('open');
    const act = A.store.data.active;
    pill.classList.toggle('show', !!act && !open);
    if (act) pill.querySelector('span:last-child').textContent = `Reprendre · ${act.session.title}`;
  }

  // Navigue vers une page, en la redessinant même si on y est déjà
  const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

  A.app = { route, refreshPill, go };

  document.addEventListener('DOMContentLoaded', () => {
    A.store.load();
    A.applyTheme();
    document.getElementById('resume-pill').onclick = () => A.player.resume();
    window.addEventListener('hashchange', route);
    route();
    // Les graphiques sont dessinés à la largeur réelle : on les redessine si elle change
    let lastW = window.innerWidth, timer = null;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (Math.abs(window.innerWidth - lastW) > 60 && location.hash === '#/stats') route();
        lastW = window.innerWidth;
      }, 200);
    });
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service worker non enregistré', err));
    }
  });
})(window.A);
