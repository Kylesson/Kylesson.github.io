// Photo lab: the "Your photo" step of the print playground. Loads a photo, holds the tone controls,
// and renders the photo as a cyanotype for any sheet shape, sun and rinse. Runs entirely in the browser.
// API for print-playground.js: PhotoLab.has(), PhotoLab.sample(), PhotoLab.render({ aspect, sun, rinse, fabric }) -> canvas, PhotoLab.onChange(fn)
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const B = window.Botanicals;
  const drop = $('#drop'), fileIn = $('#photoFile'), clearBtn = $('#labClear');
  const P = { mode: 'tones', exp: 0, con: 1.2, soft: 6, brush: true, inv: false };
  const hooks = [];
  let src = null;
  const changed = what => hooks.forEach(fn => fn(what));

  // visual cheat sheet: each tip shows a mini print that works next to one that doesn't
  (function tips() {
    const box = $('#labTips'); if (!box || !B) return;
    const P = '#f6f2e6', D = '#0b2a66';
    const plant = (n, b, extra = '', tf = 'translate(14 12) scale(.72)') => `<g transform="${tf}" ${extra}>${B.markup(n, { b, v: D, vw: .8 })}</g>`;
    const busy = [[12, 14], [70, 10], [8, 66], [74, 70], [40, 4], [44, 78], [84, 40], [2, 38]].map(([x, y]) => `<g transform="translate(${x} ${y}) scale(.18)">${B.markup('daisy', { b: P, v: D })}</g>`).join('');
    const mini = (bg, inner) => `<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="${bg}"/>${inner}</svg>`;
    const T = [
      ['tp1', mini(D, plant('frangipani', P)), mini('#5577b4', plant('frangipani', '#93acd8'))],
      ['tp2', mini(D, plant('monstera', P)), mini(D, busy + plant('monstera', P, 'opacity=".9"'))],
      ['tp3', mini(D, plant('fern', P)), mini(D, plant('fern', P, 'filter="url(#tipBlur)"'))],
      ['tp4', mini(D, plant('ginkgo', P)), mini(D, `<g transform="translate(14 12) scale(.72)">${B.markup('ginkgo', { b: 'none', s: P, v: P, vw: .35 })}</g>`)]
    ];
    box.innerHTML = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="tipBlur"><feGaussianBlur stdDeviation="2.6"/></filter></svg>` +
      T.map(([k, ok, no]) => `<figure class="tip"><div class="tip-pair"><span class="ok">${ok}<i aria-hidden="true">✓</i></span><span class="no">${no}<i aria-hidden="true">✕</i></span></div><figcaption data-i18n="${k}"></figcaption></figure>`).join('');
    const label = () => box.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = window.t(el.dataset.i18n); });
    label(); if (window.onLang) window.onLang(label);
  })();

  // cyanotype tone ramp: photo shadows -> deep Prussian blue, highlights -> bare paper
  const STOPS = [[0, [6, 26, 66]], [.22, [11, 42, 102]], [.5, [31, 88, 176]], [.75, [127, 169, 224]], [.92, [213, 227, 244]], [1, [246, 242, 230]]];
  const LUT = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255; let k = 0; while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
    const [a, ca] = STOPS[k], [b, cb] = STOPS[k + 1], f = (v - a) / (b - a);
    for (let c = 0; c < 3; c++) LUT[i * 3 + c] = ca[c] + (cb[c] - ca[c]) * f;
  }
  const PAPER = [244, 239, 224], BLUE = [12, 46, 108], STAIN = [228, 232, 189];
  // weaker sun lifts the shadows (paler blue), like the sheet overlay in the playground
  const LIFT = { bright: 0, hazy: .1, cloud: .22 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function load(img) {
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    src = document.createElement('canvas');
    src.width = Math.round(img.width * k); src.height = Math.round(img.height * k);
    src.getContext('2d').drawImage(img, 0, 0, src.width, src.height);
    clearBtn.disabled = false;
    changed('photo');
  }
  function loadFile(f) {
    if (!f || !/^image\//.test(f.type)) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); load(img); };
    img.onerror = () => { URL.revokeObjectURL(url); changed('bad'); };
    img.src = url;
  }
  fileIn.addEventListener('change', () => { loadFile(fileIn.files[0]); fileIn.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  clearBtn.addEventListener('click', () => { src = null; clearBtn.disabled = true; changed('photo'); });
  $('#sampleBtn').addEventListener('click', () => load(sample()));

  // a seaside scene so people can try the tool without a photo
  function sample() {
    const W = 800, H = 1000, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), rnd = B.rng(5);
    let g = x.createLinearGradient(0, 0, 0, H * .62); g.addColorStop(0, '#5f7fa8'); g.addColorStop(1, '#f1d9b0'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(560, 330, 10, 560, 330, 260); g.addColorStop(0, 'rgba(255,250,225,1)'); g.addColorStop(.25, 'rgba(255,240,200,.8)'); g.addColorStop(1, 'rgba(255,230,190,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#fff8e6'; x.beginPath(); x.arc(560, 330, 62, 0, 7); x.fill();
    const ridge = (y, amp, col, seed) => { const r = B.rng(seed); x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 20) x.lineTo(i, y - amp * (Math.sin(i / 130 + seed) * .6 + Math.sin(i / 47) * .25 + r() * .15)); x.lineTo(W, H); x.fill(); };
    ridge(560, 130, '#6f7f93', 2); ridge(620, 80, '#3f566f', 4);
    g = x.createLinearGradient(0, 620, 0, H); g.addColorStop(0, '#9fbbc9'); g.addColorStop(1, '#274a64'); x.fillStyle = g; x.fillRect(0, 640, W, H);
    x.strokeStyle = 'rgba(255,245,220,.55)'; x.lineWidth = 3; for (let i = 0; i < 34; i++) { const yy = 650 + i * 11, xx = 540 + (rnd() - .5) * 100 - i * 2, ww = 30 + i * 3; x.beginPath(); x.moveTo(xx - ww, yy); x.lineTo(xx + ww, yy); x.stroke(); }
    x.fillStyle = '#e7cf9f'; x.beginPath(); x.moveTo(0, 840); x.quadraticCurveTo(300, 790, W, 860); x.lineTo(W, H); x.lineTo(0, H); x.fill();
    x.strokeStyle = '#1a1208'; x.lineCap = 'round'; x.lineWidth = 16; x.beginPath(); x.moveTo(190, 900); x.quadraticCurveTo(230, 640, 170, 410); x.stroke();
    x.lineWidth = 7; for (let i = 0; i < 9; i++) { const a = -Math.PI * (.05 + i * .115); x.beginPath(); x.moveTo(170, 410); x.quadraticCurveTo(170 + Math.cos(a) * 110, 410 + Math.sin(a) * 70 - 40, 170 + Math.cos(a) * 210, 410 + Math.sin(a) * 40 + 70 + Math.abs(Math.cos(a)) * 40); x.stroke(); }
    return c;
  }

  // the photo as a cyanotype, cropped to fill a sheet of the given aspect (height / width)
  function render({ aspect = 1.414, sun = 'bright', rinse = 'full', fabric = false } = {}) {
    if (!src) return null;
    const sa = src.height / src.width;
    let sx = 0, sy = 0, sw = src.width, sh = src.height;
    if (sa > aspect) { sh = sw * aspect; sy = (src.height - sh) / 2; } else { sw = sh / aspect; sx = (src.width - sw) / 2; }
    const w = Math.round(Math.min(900, sw)), h = Math.round(w * aspect);
    const work = document.createElement('canvas'); work.width = w; work.height = h;
    const wx = work.getContext('2d', { willReadFrequently: true });
    const blur = (P.soft / 10) * (w / 700) + (fabric ? 0.9 : 0);
    if ('filter' in wx) wx.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : 'none';
    wx.drawImage(src, sx, sy, sw, sh, 0, 0, w, h); wx.filter = 'none';
    const img = wx.getImageData(0, 0, w, h), d = img.data, rnd = B.rng(9), lift = LIFT[sun] || 0, quick = rinse === 'quick';
    for (let i = 0; i < d.length; i += 4) {
      let L = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      if (P.inv) L = 1 - L;
      L = (L - 0.5) * P.con + 0.5 - P.exp * 0.28;
      L = L < 0 ? 0 : L > 1 ? 1 : L;
      let r, g, b;
      if (P.mode === 'tones') { L = lift + L * (1 - lift); const k = (L * 255 + 0.5 | 0) * 3; r = LUT[k]; g = LUT[k + 1]; b = LUT[k + 2]; }
      else { const s = smooth(0.4, 0.6, L) * (1 - lift); r = PAPER[0] + (BLUE[0] - PAPER[0]) * s; g = PAPER[1] + (BLUE[1] - PAPER[1]) * s; b = PAPER[2] + (BLUE[2] - PAPER[2]) * s; L = 1 - s; }
      // a quick rinse leaves the unexposed (light) areas a little yellow
      if (quick) { const k = L * L * .6; r += (STAIN[0] - r) * k; g += (STAIN[1] - g) * k; b += (STAIN[2] - b) * k; }
      const n = (rnd() - .5) * 9;
      d[i] = r + n; d[i + 1] = g + n; d[i + 2] = b + n; d[i + 3] = 255;
    }
    wx.putImageData(img, 0, 0);

    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ax = out.getContext('2d');
    ax.fillStyle = '#f1ecdb'; ax.fillRect(0, 0, w, h);
    ax.save();
    if (P.brush) {
      const m = Math.min(w, h) * 0.03, rr = B.rng(21), pts = [], step = 12;
      // smooth, hand-brushed wobble: slow waves plus a little grain
      const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
      const jig = (u, side) => m * (1 + 0.55 * Math.sin(u * 0.021 + ph[side]) + 0.3 * Math.sin(u * 0.067 + ph[side] * 2) + (rr() - .5) * 0.22);
      for (let x = 0; x <= w; x += step) pts.push([x, jig(x, 0)]);
      for (let y = 0; y <= h; y += step) pts.push([w - jig(y, 1), y]);
      for (let x = w; x >= 0; x -= step) pts.push([x, h - jig(x, 2)]);
      for (let y = h; y >= 0; y -= step) pts.push([jig(y, 3), y]);
      ax.beginPath(); pts.forEach(([px, py], i) => i ? ax.lineTo(px, py) : ax.moveTo(px, py)); ax.closePath(); ax.clip();
    }
    ax.drawImage(work, 0, 0);
    ax.restore();
    return out;
  }

  // controls
  const bind = (id, key, fn) => $(id).addEventListener('input', e => { P[key] = fn(e.target); changed('tone'); });
  bind('#lExp', 'exp', t => t.value / 100);
  bind('#lCon', 'con', t => t.value / 100);
  bind('#lSoft', 'soft', t => +t.value);
  bind('#lBrush', 'brush', t => t.checked);
  bind('#lInv', 'inv', t => t.checked);
  const modeSeg = document.querySelector('[data-lab="mode"]');
  modeSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    P.mode = b.dataset.v;
    modeSeg.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b));
    changed('tone');
  });

  window.PhotoLab = { has: () => !!src, render, onChange: fn => hooks.push(fn), sample: () => load(sample()) };
})();
