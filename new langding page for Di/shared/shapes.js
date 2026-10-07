// Procedural botanical drawings in a 100x100 box, built from real plant anatomy
// (pinnate fronds, umbels, whorled petals, fan leaves...). Each plant returns:
//   body  - filled silhouette        stem - stroked lines (stems, awns, rays)
//   vein  - fine detail lines (veins and petal outlines)   evenodd - use even-odd fill
(function () {
  const r = n => Math.round(n * 10) / 10;
  let uid = 0;
  const rad = d => d * Math.PI / 180;
  const sin = Math.sin, cos = Math.cos, PI = Math.PI;

  function rng(seed) { let s = (seed * 2654435761) % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  const move = (pts, ang, ox, oy) => {
    const a = rad(ang), c = cos(a), s = sin(a);
    return pts.map(([x, y]) => [ox + x * c - y * s, oy + x * s + y * c]);
  };
  const poly = (pts, close = true) => 'M' + pts.map(q => r(q[0]) + ' ' + r(q[1])).join('L') + (close ? 'Z' : '');
  const line = (a, b) => `M${r(a[0])} ${r(a[1])}L${r(b[0])} ${r(b[1])}`;
  const dot = (x, y, rr) => `M${r(x - rr)} ${r(y)}a${rr} ${rr} 0 1 0 ${r(2 * rr)} 0a${rr} ${rr} 0 1 0 ${r(-2 * rr)} 0`;

  // A leaf/petal outline in local coords: base (0,0), tip (len,0).
  //   prof(t): half-width fraction 0..1;  mod(t, side): edge modulation;  bend(t): centre-line offset (fraction of len)
  function outline(len, wid, o = {}) {
    const n = o.n || 24, prof = o.prof || (t => sin(PI * Math.pow(t, 0.7)));
    const mod = o.mod || (() => 1), bend = o.bend || (() => 0);
    const up = [], dn = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, c = bend(t) * len, w = wid * prof(t);
      up.push([t * len, c + w * mod(t, 1)]);
      dn.push([t * len, c - w * mod(t, -1)]);
    }
    return up.concat(dn.reverse());
  }
  const midrib = (len, frac = 0.92, bend = () => 0) => {
    const p = []; for (let i = 0; i <= 6; i++) { const t = i / 6 * frac; p.push([t * len, bend(t) * len]); }
    return p;
  };

  /* ---------- individual plants ---------- */

  function fern() {
    const R = rng(3); let body = '', stem = '', vein = '';
    const P0 = [44, 99], P1 = [64, 58], P2 = [38, 4];
    const pt = s => [(1 - s) ** 2 * P0[0] + 2 * (1 - s) * s * P1[0] + s * s * P2[0], (1 - s) ** 2 * P0[1] + 2 * (1 - s) * s * P1[1] + s * s * P2[1]];
    const tg = s => [2 * (1 - s) * (P1[0] - P0[0]) + 2 * s * (P2[0] - P1[0]), 2 * (1 - s) * (P1[1] - P0[1]) + 2 * s * (P2[1] - P1[1])];
    stem = `M${P0}Q${P1} ${P2}`;
    const N = 17;
    for (let i = 0; i < N; i++) {
      const s = 0.1 + 0.84 * i / (N - 1), [x, y] = pt(s), t = tg(s), a = Math.atan2(t[1], t[0]) * 180 / PI;
      const L = 30 * Math.pow(1 - s, 0.7) * (0.55 + 0.45 * Math.min(1, s / 0.22));
      for (const side of [-1, 1]) {
        const ang = a + side * (66 - 26 * s) + (R() - .5) * 6, len = L * (0.94 + R() * 0.1);
        const o = outline(len, len * 0.2, {
          n: 30, prof: u => sin(PI * Math.pow(u, 0.72)),
          mod: (u, sd) => 1 + 0.42 * (Math.abs(sin(PI * (7 * u + (sd > 0 ? 0 : 0.5)))) - 0.5),
          bend: u => side * 0.05 * sin(PI * u)
        });
        body += poly(move(o, ang, x, y));
        vein += poly(move(midrib(len, 0.88), ang, x, y), false);
      }
    }
    const tipA = Math.atan2(tg(1)[1], tg(1)[0]) * 180 / PI;
    body += poly(move(outline(15, 3.2, { n: 18, mod: u => 1 + 0.3 * (Math.abs(sin(PI * 5 * u)) - 0.5) }), tipA, P2[0], P2[1] + 8));
    return { body, stem, vein, sw: 1.5 };
  }

  function queenAnne() {
    const R = rng(7); let stem = 'M50 99Q48 80 50 58', body = '', vein = '';
    const C = [50, 58], rays = 11;
    for (let k = 0; k < rays; k++) {
      const a = rad(-80 + k * 160 / (rays - 1)), L = 38 - 9 * Math.abs(a) / 1.4 + (R() - .5) * 3;
      const E = [C[0] + L * sin(a), C[1] - L * cos(a) * 0.72];
      stem += `M${C}Q${r(C[0] + (E[0] - C[0]) * 0.45)} ${r(C[1] - L * 0.38 * (0.4 + cos(a)))} ${r(E[0])} ${r(E[1])}`;
      const dir = Math.atan2(E[1] - C[1], E[0] - C[0]), m = 6;
      for (let j = 0; j < m; j++) {
        const sa = dir + rad(-62 + j * 124 / (m - 1)), sl = 8.5 + R() * 2.5;
        const F = [E[0] + sl * cos(sa), E[1] + sl * sin(sa)];
        stem += line(E, F);
        body += dot(F[0], F[1], 1.1);
        for (let q = 0; q < 3; q++) body += dot(F[0] + 2.1 * cos(sa + q * 2.1), F[1] + 2.1 * sin(sa + q * 2.1), 0.7);
      }
    }
    // a lacy bract below the umbel
    for (const sd of [-1, 1]) {
      const b = outline(26, 2.2, { n: 20, mod: u => 1 + 0.6 * (Math.abs(sin(PI * 5 * u)) - 0.5) });
      body += poly(move(b, sd < 0 ? -150 : -30, 50, 74));
    }
    return { body, stem, vein, sw: 1.0 };
  }

  function cosmos() {
    const R = rng(11); let body = '', vein = '';
    const n = 8;
    for (let k = 0; k < n; k++) {
      const len = 37 * (0.96 + R() * 0.08), W = 12.5, ang = k * 360 / n + (R() - .5) * 5;
      const pts = [], steps = 14;
      for (let i = 0; i <= steps; i++) { const t = i / steps; pts.push([t * len, W * (0.12 + 0.88 * Math.pow(t, 0.75))]); }
      const top = [[len * 1.0, W * 0.72], [len * 1.03, W * 0.5], [len * 0.97, W * 0.33], [len * 1.04, W * 0.15], [len * 0.98, 0], [len * 1.04, -W * 0.15], [len * 0.97, -W * 0.33], [len * 1.03, -W * 0.5], [len * 1.0, -W * 0.72]];
      const low = pts.slice(0, -1).map(([x, y]) => [x, -y]).reverse();
      const shape = pts.concat(top, low);
      const p = move(shape, ang, 50, 50);
      // start the petal a little way out from the centre
      body += poly(move(shape.map(([x, y]) => [x + 5, y]), ang, 50, 50));
      vein += poly(move(shape.map(([x, y]) => [x + 5, y]), ang, 50, 50));
      for (const f of [-0.45, 0, 0.45]) vein += poly(move([[10, 0], [len * 0.8, f * W * 0.8]].map(([x, y]) => [x, y]), ang, 50, 50), false);
    }
    body += dot(50, 50, 8);
    vein += dot(50, 50, 4.5);
    return { body, stem: '', vein, sw: 1 };
  }

  function frangipani() {
    const R = rng(19); let body = '', vein = '';
    for (let k = 0; k < 5; k++) {
      const len = 43 * (0.97 + R() * 0.06), ang = k * 72 + (R() - .5) * 4;
      const o = outline(len, 15.5, { n: 30, prof: u => sin(PI * Math.pow(u, 1.45)), mod: (u, sd) => sd > 0 ? 1.18 : 0.8, bend: u => 0.1 * sin(PI * u) });
      const P = move(o, ang, 50, 50);
      body += poly(P); vein += poly(P);
      vein += poly(move(midrib(len, 0.85, u => 0.1 * sin(PI * u)), ang, 50, 50), false);
      for (const f of [-0.5, 0.5]) vein += poly(move([[6, 0], [len * 0.55, f * 9], [len * 0.82, f * 7]], ang, 50, 50), false);
    }
    return { body, stem: '', vein, sw: 1 };
  }

  function ginkgo() {
    const A = [50, 90], R = 60, pts = [A]; let vein = '';
    for (let d = -64; d <= 64; d += 2) {
      let rr = R * (1 + 0.035 * sin(rad(d) * 14));
      const ad = Math.abs(d);
      if (ad < 8) rr *= 0.55 + 0.45 * Math.pow(ad / 8, 1.4);
      pts.push([A[0] + rr * sin(rad(d)), A[1] - rr * cos(rad(d))]);
    }
    for (let d = -60; d <= 60; d += 5) {
      if (Math.abs(d) < 4) continue;
      const rr = R * 0.9 * (Math.abs(d) < 9 ? 0.62 : 1);
      vein += line([A[0] + 4 * sin(rad(d)), A[1] - 4 * cos(rad(d))], [A[0] + rr * sin(rad(d)), A[1] - rr * cos(rad(d))]);
    }
    return { body: poly(pts), stem: 'M50 99Q51 95 50 90', vein, sw: 1.8 };
  }

  function eucalyptus() {
    const R = rng(23); let body = '', vein = '';
    const spine = s => [50 + 5 * sin(s * 5.2), 98 - 92 * s];
    let stem = 'M' + [0, 0.2, 0.4, 0.6, 0.8, 1].map(s => spine(s).map(r).join(' ')).join('L');
    const pairs = 7;
    for (let i = 0; i < pairs; i++) {
      const s = 0.12 + 0.78 * i / (pairs - 1), [x, y] = spine(s), len = 21 * (1 - 0.42 * s);
      for (const sd of [-1, 1]) {
        const ang = -90 + sd * (62 + (R() - .5) * 10), l = len * (0.92 + R() * 0.16);
        const o = outline(l, l * 0.46, { n: 26, prof: u => Math.pow(sin(PI * Math.pow(u, 0.85)), 0.7) });
        const ox = x + 3 * cos(rad(ang)), oy = y + 3 * sin(rad(ang));
        stem += line([x, y], [ox, oy]);
        body += poly(move(o, ang, ox, oy));
        vein += poly(move(midrib(l, 0.85), ang, ox, oy), false);
        for (const f of [-0.5, 0.5]) vein += poly(move([[l * 0.3, 0], [l * 0.55, f * l * 0.3]], ang, ox, oy), false);
      }
    }
    const tl = 11, to = outline(tl, tl * 0.45, { n: 20, prof: u => Math.pow(sin(PI * u), 0.7) });
    body += poly(move(to, -90, spine(1)[0], spine(1)[1] + tl - 1));
    return { body, stem, vein, sw: 1.4 };
  }

  function lavender() {
    const R = rng(29); let body = '', stem = 'M50 99Q47 70 50 12', vein = '';
    const sp = y => 50 - 3 * sin((98 - y) / 40);
    for (let i = 0; i < 14; i++) {
      const y = 12 + i * 2.9, x = 50 - 3 * sin((99 - y) / 44) * 0 + (i < 3 ? 0 : 0);
      const cnt = i < 2 ? 2 : 4;
      for (let k = 0; k < cnt; k++) {
        const side = k % 2 ? 1 : -1, tier = k < 2 ? 0 : 1;
        const ang = -90 + side * (34 + tier * 22) + (R() - .5) * 8, l = (8.4 - (i < 2 ? 2 : 0)) * (0.9 + R() * 0.25);
        body += poly(move(outline(l, l * 0.34, { n: 12 }), ang, 50 + (R() - .5), y + tier * 1.2));
      }
    }
    for (const sd of [-1, 1]) {
      const bl = 40, bend = u => sd * 0.09 * u * u;
      body += poly(move(outline(bl, 2.3, { n: 22, prof: u => sin(PI * Math.pow(u, 0.5)) * (1 - 0.5 * u), bend }), -90 + sd * 14, 49.5, 98));
      body += poly(move(outline(28, 2, { n: 18, prof: u => sin(PI * Math.pow(u, 0.5)), bend: u => sd * 0.07 * u * u }), -90 + sd * 24, 49.5, 90));
    }
    return { body, stem, vein, sw: 1.3 };
  }

  function wheat() {
    const R = rng(31); let body = '', stem = 'M52 99Q55 80 50 52', vein = '';
    for (let i = 0; i < 13; i++) {
      const y = 52 - i * 2.7, side = i % 2 ? 1 : -1, x = 50 + (i < 2 ? 0 : 0);
      const gl = 9.5 * (1 - i * 0.025);
      for (const sd of [-1, 1]) {
        const ang = -90 + sd * 26, o = outline(gl, gl * 0.2, { n: 14, prof: u => sin(PI * Math.pow(u, 0.8)) });
        body += poly(move(o, ang, x, y + 1));
        const tipX = x + gl * cos(rad(ang)), tipY = y + 1 + gl * sin(rad(ang)), awnA = rad(-90 + sd * 14);
        stem += line([tipX, tipY], [tipX + 11 * cos(awnA), tipY + 11 * sin(awnA)]);
      }
    }
    body += poly(move(outline(8, 2.2, { n: 12 }), -90, 50, 24));
    body += 'M49 99Q30 86 16 58Q33 80 52 96Z';
    body += 'M53 99Q72 84 86 56Q69 79 51 97Z';
    return { body, stem, vein, sw: 0.7 };
  }

  function monstera() {
    const C = [50, 47], pts = []; let vein = '', holes = '';
    const slits = [38, 62, 86, 110, 134];
    for (let d = 0; d < 360; d += 1) {
      const th = rad(d);
      let rr = 45 * (0.74 + 0.26 * cos(th));
      const dd = Math.abs(d - 180);
      rr *= 1 - 0.7 * Math.exp(-Math.pow(dd / 13, 2));            // sinus where the stalk joins
      for (const s of slits) for (const sg of [-1, 1]) {
        const c = sg > 0 ? s : 360 - s;                           // slit centres, symmetric
        const dist = Math.min(Math.abs(d - c), Math.abs(d - c + 360), Math.abs(d - c - 360));
        rr *= 1 - 0.6 * Math.exp(-Math.pow(dist / 2.1, 2));
      }
      pts.push([C[0] + rr * sin(th), C[1] - rr * cos(th)]);
    }
    // oval holes near the midrib
    [[28, 20, 6], [28, 20, 6], [55, 17, 5.5], [82, 19, 5], [110, 17, 4.5]].forEach(([d, rr, l], i) => {
      for (const sg of [-1, 1]) {
        const a = rad(sg * d), cx = C[0] + rr * sin(a), cy = C[1] - rr * cos(a) * 0.9 + 2;
        const o = outline(l * 1.6, 1.7, { n: 12, prof: u => sin(PI * u) });
        holes += poly(move(o, sg * d - 90, cx, cy));
      }
    });
    const body = poly(pts) + holes;
    vein += line([50, 72], [50, 5]);
    for (let i = 0; i < 6; i++) for (const sg of [-1, 1]) {
      const y = 60 - i * 8.5;
      vein += line([50, y], [50 + sg * (30 - i * 2.5), y - 13 + i * 1.5]);
    }
    return { body, stem: 'M50 68Q49 84 50 99', vein, sw: 2.2, evenodd: true, clipVeins: true };
  }

  function daisy() {
    const R = rng(37); let body = '', vein = '';
    const n = 18;
    for (let k = 0; k < n; k++) {
      const len = 30 * (0.9 + R() * 0.16), ang = k * 360 / n + (R() - .5) * 4;
      const o = outline(len, 4.6, { n: 18, prof: u => Math.pow(sin(PI * Math.pow(u, 0.85)), 0.5), bend: u => 0.03 * sin(PI * u) * (k % 2 ? 1 : -1) });
      const P = move(o.map(([x, y]) => [x + 8, y]), ang, 50, 50);
      body += poly(P);
      vein += poly(move([[12, 0], [len * 0.75, 0]], ang, 50, 50), false);
    }
    body += dot(50, 50, 9.5);
    vein += dot(50, 50, 6);
    return { body, stem: '', vein, sw: 1 };
  }

  const builders = { fern, queenanne: queenAnne, cosmos, frangipani, ginkgo, eucalyptus, lavender, wheat, monstera, daisy };
  const shapes = {};
  Object.keys(builders).forEach(k => { shapes[k] = builders[k](); });

  // Markup for one plant. cols: { b: body fill, s: stroke colour (default b), v: detail colour, vw: detail width }
  function markup(name, cols = {}) {
    const s = shapes[name], clip = s.clipVeins ? 'vc' + (++uid) : '', b = cols.b || '#fff', st = cols.s || b, v = cols.v || '#1b4fa8', vw = cols.vw || 0.9;
    return (clip ? `<clipPath id="${clip}"><path d="${s.body}" clip-rule="evenodd"/></clipPath>` : '') + `<path class="b" d="${s.body}" fill="${b}" ${s.evenodd ? 'fill-rule="evenodd"' : ''}/>` +
      (s.stem ? `<path class="s" d="${s.stem}" fill="none" stroke="${st}" stroke-width="${s.sw}" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
      (s.vein ? `<path class="v" d="${s.vein}" ${clip ? 'clip-path="url(#' + clip + ')"' : ''} fill="none" stroke="${v}" stroke-width="${vw}" stroke-linecap="round" stroke-linejoin="round"/>` : '');
  }

  // A finished-looking placeholder print: deep blue with white botanicals.
  function printSVG(seed, w, h) {
    const rand = rng(seed * 97 + 5), names = Object.keys(shapes);
    const order = names.slice().sort(() => rand() - .5);
    let g = '';
    const n = seed % 3 === 0 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const name = order[(seed + i) % order.length];
      const big = n === 1;
      const x = w * (big ? 0.5 : 0.3 + i * 0.4), y = h * (big ? 0.5 : 0.36 + i * 0.3);
      const sc = (w / 100) * (big ? 1.35 : 0.88 + rand() * 0.2), rot = Math.floor((rand() - .5) * 60);
      g += `<g transform="translate(${r(x)} ${r(y)}) rotate(${rot}) scale(${r(sc)}) translate(-50 -50)">` +
        markup(name, { b: '#f6f2e6', v: '#1b4fa8', vw: 0.8 }) + '</g>';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">` +
      `<defs><radialGradient id="pg${seed}" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#1c56b4"/><stop offset="1" stop-color="#0a2a66"/></radialGradient></defs>` +
      `<rect width="${w}" height="${h}" fill="url(#pg${seed})"/>${g}</svg>`;
  }

  window.Botanicals = { shapes, names: Object.keys(shapes), markup, printSVG, rng };
})();
