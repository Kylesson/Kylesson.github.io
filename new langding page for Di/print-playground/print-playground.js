// Print playground: the uploaded photo on a sheet of the chosen size, exposed, rinsed and saved.
// Needs shared/portable-core.js and photo-lab/photo-lab.js (window.PhotoLab renders the photo).
(function () {
  const L = window.PhotoLab;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  let statusKey = 'st_compose0';

  (function () {
    const svg = $('#sheet'), photo = $('#photoImg'), overlay = $('#overlay'), weaveRect = $('#weaveRect'), sheetHint = $('#sheetHint');
    const sunBtn = $('#sunBtn'), meter = $('#meter'), rinseBtn = $('#rinseBtn'), saveBtn = $('#saveBtn');
    const SUN = { bright: { dur: 3200, mid: '#1b4fa8', deep: '#0b2a66', max: 1 }, hazy: { dur: 5400, mid: '#2b60b6', deep: '#133b82', max: .94 }, cloud: { dur: 8500, mid: '#4d7fc6', deep: '#2c5ca6', max: .84 } };
    const SURF = { paper: { weave: 0 }, fabric: { weave: .3 } };
    let cond = { sun: 'bright', surface: 'paper', rinse: 'full', size: 'a4' };
    // real print areas in mm
    const FORMATS = { a4: { w: 210, h: 297, price: '200k' }, a4l: { w: 297, h: 210, price: '200k' }, tote: { w: 380, h: 420, price: '250k' } };
    let VH = 400 * 297 / 210;
    let state = 'compose', p = 0, holding = false, last = 0, raf = 0;
    window.__sun = 'bright';

    function setStatus(k) { statusKey = k; $('#status').textContent = t(k); }
    const locked = () => state !== 'compose' || p > 0;

    // the photo, rendered for the current sheet and conditions
    function renderPhoto() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const cv = L.render({ aspect: VH / 400, sun: cond.sun, rinse: cond.rinse, fabric: cond.surface === 'fabric' });
        if (cv) photo.setAttribute('href', cv.toDataURL('image/jpeg', .92));
        else photo.removeAttribute('href');
        paint();
      });
    }

    // sheet formats
    function setSurface(v) { cond.surface = v; $$('[data-cond="surface"] button').forEach(x => x.setAttribute('aria-checked', x.dataset.v === v)); }
    function renderSizeInfo() { const f = FORMATS[cond.size], n = v => (v / 10).toLocaleString(window.getLang()), cm = t('u_cm') === 'u_cm' ? 'cm' : t('u_cm'); $('#sizeInfo').textContent = `${t('sz_area')}: ${n(f.w)} × ${n(f.h)} ${cm} · ${f.price}`; }
    window.onLang(renderSizeInfo);
    function applyFormat(key) {
      const f = FORMATS[key];
      cond.size = key; VH = 400 * f.h / f.w;
      svg.closest('.stage').style.setProperty('--ar', f.w / f.h);   // the phone settings sheet sizes the print with it
      svg.setAttribute('viewBox', `0 0 400 ${VH.toFixed(1)}`);
      ['paperRect', 'overlay', 'weaveRect', 'photoImg'].forEach(id => $('#' + id).setAttribute('height', VH.toFixed(1)));
      setSurface(key === 'tote' ? 'fabric' : 'paper');
      $$('[data-cond="size"] button').forEach(x => x.setAttribute('aria-checked', x.dataset.v === key));
      renderSizeInfo(); renderPhoto();
    }

    function paint() {
      const has = L.has(), rinsed = state === 'rinsed', sun = SUN[cond.sun], surf = SURF[cond.surface];
      sheetHint.hidden = has;
      // before the rinse the blue builds up and the photo shows faintly; the rinse reveals the print
      overlay.style.opacity = rinsed ? 0 : p * sun.max;
      overlay.style.fill = sun.mid;
      photo.style.display = has ? '' : 'none';
      photo.style.opacity = rinsed ? 1 : .2 + .4 * p;
      weaveRect.style.opacity = surf.weave * (0.35 + 0.65 * Math.max(p, 0.15));
    }

    // conditions
    $$('.seg[data-cond]').forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const key = seg.dataset.cond;
      if (key === 'rinse' ? state === 'rinsed' : locked()) return;
      cond[key] = b.dataset.v; window.__sun = cond.sun;
      if (key === 'size') { applyFormat(b.dataset.v); return; }
      $$('button', seg).forEach(x => x.setAttribute('aria-checked', x === b));
      $('#sunHint').textContent = t('hint_' + cond.sun);
      renderPhoto();
    }));
    $('#sunHint').textContent = t('hint_bright');

    // a new or removed photo starts the print again; tone changes only re-render it
    function reset() {
      holding = false; p = 0; state = 'compose'; meter.style.width = '0'; sunBtn.classList.remove('on');
      setStatus(L.has() ? 'st_compose1' : 'st_compose0'); updateUI();
    }
    L.onChange(what => {
      if (what === 'bad') { setStatus('st_img_bad'); return; }
      if (what === 'photo') reset();
      renderPhoto();
    });

    // exposure
    function tick(now) {
      if (!holding) return;
      p = Math.min(1, p + (now - last) / SUN[cond.sun].dur); last = now;
      meter.style.width = (p * 100) + '%'; paint();
      if (p >= 1) { holding = false; state = 'exposed'; sunBtn.classList.remove('on'); setStatus('st_done'); updateUI(); return; }
      requestAnimationFrame(tick);
    }
    function begin(e) {
      if (e) e.preventDefault();
      if (!L.has() || (state !== 'compose' && state !== 'exposing') || holding) return;
      state = 'exposing'; holding = true; last = performance.now();
      sunBtn.classList.add('on'); setStatus('st_expose'); updateUI();
      requestAnimationFrame(tick);
    }
    function end() {
      if (!holding) return;
      holding = false; sunBtn.classList.remove('on');
      if (state === 'exposing' && p < 1) setStatus('st_pause');
    }
    sunBtn.addEventListener('pointerdown', e => { try { sunBtn.setPointerCapture(e.pointerId); } catch (err) {} begin(e); });
    sunBtn.addEventListener('pointerup', end); sunBtn.addEventListener('pointercancel', end);
    sunBtn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) begin(e); });
    sunBtn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') end(); });

    rinseBtn.addEventListener('click', () => {
      if (state !== 'exposed') return;
      state = 'rinsed'; paint(); setStatus(cond.rinse === 'full' ? 'st_rinsed_full' : 'st_rinsed_quick'); updateUI();
    });
    $('#resetBtn').addEventListener('click', () => { reset(); paint(); });

    saveBtn.addEventListener('click', () => {
      if (state !== 'rinsed') return;
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', NS); clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
      clone.setAttribute('width', 1600); clone.setAttribute('height', Math.round(1600 * VH / 400));
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = 1600; cv.height = Math.round(1600 * VH / 400);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-cyanotype.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }, 'image/png');
      };
      img.src = url;
    });

    function updateUI() {
      $$('.seg[data-cond]').forEach(seg => {
        const off = seg.dataset.cond === 'rinse' ? state === 'rinsed' : locked();
        seg.classList.toggle('off', off);
      });
      sunBtn.disabled = !(L.has() && (state === 'compose' || state === 'exposing'));
      rinseBtn.disabled = state !== 'exposed';
      saveBtn.disabled = state !== 'rinsed';
    }
    applyFormat('a4'); setStatus('st_compose0'); updateUI();
  })();

  // keep the dynamic labels in the right language
  window.onLang(() => {
    $('#status').textContent = t(statusKey);
    $('#sunHint').textContent = t('hint_' + (window.__sun || 'bright'));
  });
  window.Cyano.applyLang();
})();
