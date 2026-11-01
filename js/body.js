/* Athlos — silhouette anatomique cliquable (face et dos) */
(function (A) {
  'use strict';
  const ui = A.ui;

  // Demi-silhouette gauche (x < 100), dupliquée en miroir
  const SIL = 'M100 46 L92 46 L91 60 Q78 64 70 66 Q54 66 50 80 Q46 94 48 108 Q46 130 50 148 Q42 170 40 204 Q36 218 42 230 Q50 236 54 224 L56 206 Q62 180 66 156 Q70 130 69 104 Q72 120 72 140 Q72 165 74 178 Q68 196 68 230 Q68 266 76 296 Q70 320 72 344 Q76 368 76 384 Q72 398 78 402 L96 402 Q98 392 95 382 Q96 350 95 330 Q98 312 94 300 Q99 260 99 210 L100 206 Z';

  const ARM_UPPER = 'M54 103 Q60 94 67 92 Q69 107 67 124 Q64 140 59 146 Q52 142 50 128 Q49 113 54 103 Z';
  const FOREARM = 'M57 151 Q64 152 65 158 Q63 180 56 203 Q49 206 43 202 Q42 186 46 168 Q50 156 57 151 Z';

  // Formes de la moitié gauche : [muscle, type, données]
  const FRONT = [
    ['trapezes', 'p', 'M91 50 Q86 60 72 66 L91 64 Z'],
    ['epaules', 'p', 'M73 67 Q60 63 52 72 Q47 82 49 98 Q52 101 55 99 Q61 90 67 86 Q74 79 75 70 Z'],
    ['pectoraux', 'p', 'M98 71 L98 104 Q90 111 80 108 Q72 104 70 92 Q69 80 75 71 Q86 68 98 71 Z'],
    ['biceps', 'p', ARM_UPPER],
    ['avant_bras', 'p', FOREARM],
    ['obliques', 'p', 'M75 109 Q82 111 85 114 L85 170 Q81 176 76 173 Q72 152 72 130 Q72 116 75 109 Z'],
    ['abdos', 'r', [87, 110, 12, 17, 4]],
    ['abdos', 'r', [87, 130, 12, 17, 4]],
    ['abdos', 'r', [87, 150, 12, 17, 4]],
    ['abdos', 'p', 'M87 170 L99 170 L99 192 Q91 188 88 178 Z'],
    ['quadriceps', 'p', 'M75 192 Q85 197 91 206 Q94 230 94 258 Q93 280 89 292 Q81 295 76 290 Q68 266 68 236 Q68 210 75 192 Z'],
    ['adducteurs', 'p', 'M93 205 Q98 206 99 211 L98 252 Q94 240 92 222 Q92 212 93 205 Z'],
    ['mollets', 'p', 'M76 308 Q72 326 74 346 Q77 366 81 378 L89 378 Q94 360 94 340 Q94 320 90 308 Q83 304 76 308 Z'],
  ];
  const BACK = [
    ['haut_dos', 'p', 'M73 71 Q84 76 91 88 L95 104 Q86 108 77 103 Q70 92 73 71 Z'],
    ['dorsaux', 'p', 'M73 104 Q84 110 94 108 L97 122 Q95 142 89 158 Q81 152 77 140 Q72 122 73 104 Z'],
    ['trapezes', 'p', 'M100 50 L92 50 Q88 60 72 67 Q86 76 92 88 L100 118 Z'],
    ['arriere_epaules', 'p', 'M72 68 Q60 63 52 72 Q47 82 49 98 Q52 101 55 99 Q61 90 67 85 Q72 78 72 68 Z'],
    ['triceps', 'p', ARM_UPPER],
    ['avant_bras', 'p', FOREARM],
    ['lombaires', 'p', 'M99 122 Q96 123 95 127 Q91 145 89 160 L90 176 L99 178 Z'],
    ['fessiers', 'p', 'M99 179 L90 177 Q76 180 72 194 Q70 210 77 218 Q89 224 99 219 Z'],
    ['ischios', 'p', 'M75 222 Q86 227 97 223 Q98 250 94 272 Q91 287 87 293 Q79 291 75 283 Q68 258 70 238 Q70 228 75 222 Z'],
    ['mollets', 'p', 'M76 306 Q69 322 71 342 Q75 358 82 364 L90 364 Q96 348 96 330 Q96 315 92 306 Q84 301 76 306 Z'],
  ];
  const MIRROR = 'transform="translate(200 0) scale(-1 1)"';

  function shape(type, d, mirror) {
    const tr = mirror ? MIRROR : '';
    if (type === 'r') return `<rect x="${d[0]}" y="${d[1]}" width="${d[2]}" height="${d[3]}" rx="${d[4]}" ${tr}/>`;
    return `<path d="${d}" ${tr}/>`;
  }

  function figure(parts, label, opts) {
    const groups = {};
    parts.forEach(([m, type, d]) => { (groups[m] = groups[m] || []).push(shape(type, d, false), shape(type, d, true)); });
    const g = Object.keys(groups).map(m => {
      const cls = ['mus'];
      if (opts.selected && opts.selected.has(m)) cls.push('on');
      if (opts.weak === m) cls.push('weak');
      let style = '';
      if (opts.heat) {
        const v = ui.clamp((opts.heat[m] || 0) / (opts.heatMax || 15), 0, 1);
        style = v > 0 ? `style="--f: color-mix(in srgb, var(--accent) ${Math.round(18 + v * 82)}%, var(--muscle))"` : '';
      }
      const tip = opts.heat ? `${A.mName(m)} : ${ui.num(opts.heat[m] || 0, 1)} séries` : A.mName(m);
      return `<g class="${cls.join(' ')}" data-m="${m}" ${style} ${opts.onToggle ? 'tabindex="0" role="button"' : ''} aria-label="${ui.esc(tip)}"><title>${ui.esc(tip)}</title>${groups[m].join('')}</g>`;
    }).join('');
    return `<figure><svg viewBox="34 4 132 402" xmlns="http://www.w3.org/2000/svg">
      <path class="bm-sil" d="${SIL}"/><path class="bm-sil" d="${SIL}" ${MIRROR}/>
      <ellipse class="bm-sil" cx="100" cy="27" rx="15" ry="19"/>${g}</svg><figcaption>${label}</figcaption></figure>`;
  }

  // opts : { selected:Set, weak, heat:{muscle:valeur}, heatMax, onToggle(m) }
  A.body = function (el, opts = {}) {
    el.classList.add('bodymap');
    el.classList.toggle('selectable', !!opts.onToggle);
    el.classList.toggle('heat', !!opts.heat);
    el.innerHTML = figure(FRONT, 'Face', opts) + figure(BACK, 'Dos', opts);
    if (opts.onToggle) {
      const fire = g => { if (g) opts.onToggle(g.dataset.m); };
      el.onclick = e => fire(e.target.closest('.mus'));
      el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(e.target.closest('.mus')); } };
    }
  };
})(window.A);
