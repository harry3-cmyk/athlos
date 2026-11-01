/* Athlos — noyau : espace de noms, stockage local, utilitaires d'interface */
window.A = window.A || {};
(function (A) {
  'use strict';

  const KEY = 'athlos.v1';
  const ALL_EQ = ['barre', 'halteres', 'banc', 'machine', 'poulie', 'kb', 'traction', 'dips', 'elastique', 'gilet'];
  A.ALL_EQ = ALL_EQ;

  function defaults() {
    return {
      version: 2,
      profile: {
        name: '', level: 'inter', bodyweight: null, cardio: 'auto',
        setup: 'salle', equipment: ALL_EQ.filter(e => e !== 'gilet'),
        // Matériel personnel aux charges fixes (kg), utilisé hors salle
        gear: { halteres: [15], elastique: [35, 45], gilet: [10] },
        sound: true, vibrate: true, theme: 'auto', orm: {},
      },
      history: [], favorites: [], customEx: [], plan: null, active: null, lastQuiz: null,
    };
  }

  // ---------- Stockage (localStorage, tout reste sur l'appareil) ----------
  A.store = {
    data: defaults(),
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          this.data = Object.assign(defaults(), d);
          this.data.profile = Object.assign(defaults().profile, d.profile || {});
          // v1 → v2 : les barres à dips deviennent un matériel à part entière
          if ((d.version || 1) < 2) {
            const eq = this.data.profile.equipment;
            if (eq.includes('traction') && !eq.includes('dips')) eq.push('dips');
            this.data.version = 2;
          }
        }
      } catch (e) { console.warn('Athlos : lecture du stockage impossible', e); }
    },
    save() {
      try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; }
      catch (e) { console.warn('Athlos : sauvegarde impossible', e); return false; }
    },
    reset() { this.data = defaults(); this.save(); },
    importData(obj) {
      if (!obj || !Array.isArray(obj.history)) throw new Error('Fichier invalide');
      this.data = Object.assign(defaults(), obj);
      this.data.profile = Object.assign(defaults().profile, obj.profile || {});
      this.save();
    },
  };

  // ---------- Utilitaires ----------
  const ui = A.ui = {};
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  ui.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
  ui.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  ui.$ = (sel, root = document) => root.querySelector(sel);
  ui.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  ui.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  ui.clone = o => JSON.parse(JSON.stringify(o));

  ui.fmtDur = sec => {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (h) return `${h} h ${String(m).padStart(2, '0')}`;
    return `${Math.max(1, m)} min`;
  };
  ui.fmtClock = sec => {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = h ? String(m).padStart(2, '0') : m;
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  };
  ui.fmtDate = (ts, opts) => new Date(ts).toLocaleDateString('fr-FR', opts || { weekday: 'short', day: 'numeric', month: 'short' });
  ui.fmtTime = ts => new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  ui.num = (n, d = 0) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: d });
  ui.kg = n => ui.num(n, 1) + ' kg';
  ui.pace = kmh => { if (!kmh) return '–'; const s = 3600 / kmh; return `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"/km`; };

  ui.startOfWeek = ts => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  ui.dayKey = ts => { const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  // 1RM estimé (Epley) — fiable jusqu'à ~12 répétitions
  A.e1rm = (w, r) => (!w || !r || r > 12) ? 0 : (r === 1 ? w : w * (1 + r / 30));
  A.round25 = x => Math.round(x / 2.5) * 2.5;

  // ---------- Icônes (SVG 24×24, trait) ----------
  const I = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    chart: '<path d="M3 21h18"/><path d="M6 17v-6M11 17V5M16 17v-9M21 17v-3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor" stroke="none"/>',
    check: '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    dumbbell: '<path d="M6.5 6.5v11M3.5 9v6M17.5 6.5v11M20.5 9v6M6.5 12h11"/>',
    flame: '<path d="M12 3c.8 3.6 5 5.2 5 10a5 5 0 0 1-10 0c0-2.4 1.3-3.8 2.2-5.4.5 1.4 1.3 2.3 2.3 2.9C11.3 8 11 5.5 12 3z"/>',
    right: '<path d="m9 5 7 7-7 7"/>',
    left: '<path d="m15 5-7 7 7 7"/>',
    down: '<path d="m5 9 7 7 7-7"/>',
    up: '<path d="m5 15 7-7 7 7"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    timer: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 10v3.5M9.5 2.5h5M18.5 6l1.5-1.5"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 21h7M10 17h4v4h-4z"/>',
    bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
    heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z"/>',
    run: '<circle cx="14" cy="4.5" r="1.8"/><path d="M8.5 21l3-6.5 3 3V21M6 12.5l3.5-4 4 .5 2.5 3.5 3 1"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    flask: '<path d="M9 3h6M10 3v6.5L4.6 18.8A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.2L14 9.5V3"/><path d="M7.5 15h9"/>',
    skip: '<path d="M5 5.5 14 12l-9 6.5zM18 5v14"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.5"/><path d="M20 3.5v5h-5"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    body: '<circle cx="12" cy="4.5" r="2"/><path d="M6 8.5h12M12 8.5V15M9 21l3-6 3 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  };
  ui.icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[name] || ''}</svg>`;

  // ---------- Toasts ----------
  ui.toast = (msg, ms = 2600) => {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, ms);
  };

  // ---------- Feuilles modales (bas d'écran sur mobile, centrées sur ordinateur) ----------
  ui.sheet = function ({ title, html, onMount, onClose, wide }) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop" data-close></div>
      <div class="sheet ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${ui.esc(title || '')}">
        <div class="sheet-head"><h3>${ui.esc(title || '')}</h3>
        <button class="icon-btn" data-close aria-label="Fermer">${ui.icon('x')}</button></div>
        <div class="sheet-body">${html}</div>
      </div>`;
    root.appendChild(wrap);
    document.body.classList.add('no-scroll');
    requestAnimationFrame(() => wrap.classList.add('in'));
    let closed = false;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      wrap.classList.remove('in');
      setTimeout(() => {
        wrap.remove();
        if (!root.children.length) document.body.classList.remove('no-scroll');
      }, 200);
      if (onClose) onClose();
    }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    if (onMount) onMount(wrap.querySelector('.sheet-body'), close);
    return close;
  };

  ui.confirm = (msg, { ok = 'Confirmer', danger = false, title = 'Confirmation' } = {}) => new Promise(resolve => {
    let answered = false;
    ui.sheet({
      title,
      html: `<p class="muted">${ui.esc(msg)}</p>
        <div class="row end gap mt"><button class="btn ghost" data-no>Annuler</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${ui.esc(ok)}</button></div>`,
      onMount(body, close) {
        body.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); close(); };
        body.querySelector('[data-no]').onclick = () => close();
      },
      onClose() { if (!answered) resolve(false); },
    });
  });

  // Téléchargement d'un fichier généré localement (export de sauvegarde)
  ui.download = (name, text, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  A.views = {};
  A.state = { draft: null };
})(window.A);
