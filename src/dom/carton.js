// @ts-nocheck
/* eslint-disable */
// Copied VERBATIM from the v0.5 prototype (artifact "carton.js"): the coop's egg carton in 3d, a tray
// with one egg per member and a lid on a hinge that swings shut to show the join code as a qr code.
// Changes: imports below, `prof`/`g.me`/`g.people` instead of the prototype's demo profiles, and the
// qr library imported instead of read from window. Everything else is the prototype's code.
import qrcode from 'qrcode-generator';

import { Art, FLAT, OL } from './art/art';

const esc = Art.esc;
const $ = (s, r = document) => r.querySelector(s);
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const inviteText = g => `join my coop "${g.name}" on sunny side up with the code ${g.code}`;

/* carton.js — the coop's egg carton in 3d: a tray with one egg per member and a lid on a hinge.
   everything is a real box seen by a camera, so the lid can swing shut over the eggs, and then the
   carton tips toward you until the qr code printed on the lid reads flat enough to scan */
const CT = (() => {
  const L = 264, DP = 132, H = 50, LH = 44, CUP = 31, XS = [-84, 0, 84], FRONT = -36, BACK = -97;
  const EGG_W = 60, EGG_H = 76;
  const OPEN = { th: 106, ph: 34, ps: -11 }, SHUT = { th: 0, ph: 80, ps: 0 };
  const C = { tray: '#F4EEE1', cup: '#E3D7C0', front: '#ECE3D0', side: '#DFD3BC', lidIn: '#E9DFCA', panel: '#F9F5EC', lidTop: '#F5EFE2', lidWall: '#EAE1CD', lidSide: '#DFD4BE' };
  const RAD = Math.PI / 180, f1 = Art.f1;
  const NS = 'http://www.w3.org/2000/svg';
  let host = null, svg = null, coop = null, v = null, fitO = null, fitS = null, faces = [], lidG = null, slotB = null, slotF = null, eggsG = null;
  let closed = false, busy = false, qr = null;
  /* ours: who's in the coop (the prototype read these from its demo profiles) */
  const prof = id => coop.people[id] || { username: 'friend', egg: { swatch: 'shell', pattern: 'plain' } };

  /* ── the camera: yaw ps, pitch ph (degrees), zoom k, centre cx/cy ── */
  function P(x, y, z) {
    const a = v.ps * RAD, b = v.ph * RAD;
    const x1 = x * Math.cos(a) + z * Math.sin(a), z1 = -x * Math.sin(a) + z * Math.cos(a);
    return [v.cx + v.k * x1, v.cy - v.k * (y * Math.cos(b) - z1 * Math.sin(b))];
  }
  const toCam = () => { const a = v.ps * RAD, b = v.ph * RAD; return [-Math.sin(a) * Math.cos(b), Math.sin(b), Math.cos(a) * Math.cos(b)]; };
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
  const len = p => Math.hypot(p[0], p[1], p[2]);
  /* the lid turns about the hinge along the tray's top back edge */
  function rotLid(p) {
    const t = v.th * RAD, dz = p[2] + DP, dy = p[1] - H;
    return [p[0], H + dz * Math.sin(t) + dy * Math.cos(t), -DP + dz * Math.cos(t) - dy * Math.sin(t)];
  }
  function rotN(n) { const t = v.th * RAD; return [n[0], n[2] * Math.sin(t) + n[1] * Math.cos(t), n[2] * Math.cos(t) - n[1] * Math.sin(t)]; }

  /* a face is a flat drawing (in its own units) laid onto a parallelogram O, O+U, O+V of the box */
  function mkFace(parent, f) {
    const g = document.createElementNS(NS, 'g');
    const lu = len(f.U), lv = len(f.V);
    g.innerHTML = (f.shape ? `<path d="${f.shape}" fill="${f.fill}" ${OL()}/>` : `<rect width="${lu}" height="${lv}" fill="${f.fill}" ${OL()}/>`) + (f.art || '');
    parent.append(g);
    faces.push({ ...f, el: g, lu, lv });
  }
  function place(f) {
    const T = f.lid ? rotLid : (p => p), n = f.lid ? rotN(f.N) : f.N;
    const show = dot(n, toCam()) > 0.004;
    f.el.style.display = show ? '' : 'none';
    if (!show) return;
    const p0 = P(...T(f.O)), pu = P(...T(add(f.O, f.U))), pv = P(...T(add(f.O, f.V)));
    f.el.setAttribute('transform', `matrix(${[(pu[0] - p0[0]) / f.lu, (pu[1] - p0[1]) / f.lu, (pv[0] - p0[0]) / f.lv, (pv[1] - p0[1]) / f.lv, p0[0], p0[1]].map(x => x.toFixed(3)).join(' ')})`);
  }
  function update() {
    faces.forEach(place);
    /* while you can see into the lid it sits behind the eggs; once it swings past your line of sight it covers them */
    const behind = v.th > v.ph + .5;
    if (behind && lidG.parentNode !== slotB) slotB.append(lidG);
    if (!behind && lidG.parentNode !== slotF) slotF.append(lidG);
    eggsG.style.display = v.th < 3 ? 'none' : '';
  }

  /* ── what's drawn on each face ── */
  const scallops = (w, n, depth) => {
    const step = w / n;
    let d = `M0,0H${w}V${H - depth}`;
    for (let i = n - 1; i >= 0; i--) d += `A${f1(step / 2)},${f1(depth * 1.45)} 0 0 1 ${f1(i * step)},${H - depth}`;
    return d + 'Z';
  };
  function nameLines(name) {
    const fit1 = Math.min(30, 236 / (.58 * name.length));
    if (fit1 >= 21 || !name.includes(' ')) return { lines: [name], fs: Math.max(15, fit1) };
    const mid = name.length / 2, cut = [...name].reduce((b, ch, i) => ch === ' ' && Math.abs(i - mid) < Math.abs(b - mid) ? i : b, -99);
    const lines = [name.slice(0, cut), name.slice(cut + 1)];
    return { lines, fs: Math.min(27, 236 / (.58 * Math.max(...lines.map(l => l.length)))) };
  }
  function innerArt(g) {
    const { lines, fs } = nameLines(g.name), lh = fs * 1.08, y0 = DP / 2 - 8 - (lines.length - 1) * lh / 2 + fs * .34;
    return `<rect x="12" y="12" width="${L - 24}" height="${DP - 24}" rx="14" fill="${C.panel}" ${OL()}/>
      ${lines.map((t, i) => `<text class="ct-name" x="${L / 2}" y="${f1(y0 + i * lh)}" font-size="${f1(fs)}" text-anchor="middle">${esc(t)}</text>`).join('')}
      <text class="ct-hint" x="${L / 2 + 8}" y="${DP - 26}" text-anchor="middle">tap the lid to invite people</text>
      <svg x="${L / 2 - 82}" y="${DP - 36.5}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="${'#8E8676'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2a4.6 4.6 0 0 1 5 4.8"/></svg>`;
  }
  function topArt(g) {
    const q = qr, box = 94, x0 = 18, y0 = (DP - box) / 2;
    const mod = q ? (box - 8) / q.n : 0;
    return `<rect x="10" y="10" width="${L - 20}" height="${DP - 20}" rx="14" fill="${C.panel}" ${OL()}/>
      <rect x="${x0}" y="${y0}" width="${box}" height="${box}" rx="6" fill="#fff" ${OL('#D9D2C2', 1)}/>
      ${q ? `<g transform="translate(${x0 + 4} ${y0 + 4}) scale(${mod.toFixed(4)})"><path d="${q.d}" fill="${FLAT.ink}" shape-rendering="crispEdges"/></g>` : ''}
      <text class="ct-lbl" x="${x0 + box + 16}" y="46">coop code</text>
      <text class="ct-code" x="${x0 + box + 16}" y="75">${esc(g.code)}</text>
      <text class="ct-lbl small" x="${x0 + box + 16}" y="95">scan it or type it in</text>`;
  }

  /* the eggs never move while the carton is open, so they're drawn once for the open view */
  function cupClip(x, z, id) {
    const pts = [];
    for (let i = 0; i < 36; i++) { const t = i / 36 * 2 * Math.PI; pts.push(P(x + CUP * Math.cos(t), H, z + CUP * Math.sin(t))); }
    let li = 0, ri = 0;
    pts.forEach((p, i) => { if (p[0] < pts[li][0]) li = i; if (p[0] > pts[ri][0]) ri = i; });
    const walk = dir => { const a = []; for (let i = li; ; i = (i + dir + 36) % 36) { a.push(pts[i]); if (i === ri) break; } return a; };
    const A = walk(1), B = walk(-1), arc = A[A.length >> 1][1] > B[B.length >> 1][1] ? A : B, l = pts[li], r = pts[ri];
    const poly = [...arc, [r[0] + 30, r[1]], [r[0] + 30, -3000], [l[0] - 30, -3000], [l[0] - 30, l[1]]];
    return `<clipPath id="${id}"><path d="M${poly.map(p => `${f1(p[0])},${f1(p[1])}`).join('L')}Z"/></clipPath>`;
  }
  const mctx = document.createElement('canvas').getContext('2d');
  function eggsHTML(g) {
    const people = [g.me, ...g.members.filter(m => m !== g.me)], seats = [[0, FRONT], [-84, FRONT], [84, FRONT], [-84, BACK], [0, BACK], [84, BACK]];
    const shown = people.slice(0, 6), free = shown.length < 6 ? seats[shown.length] : null;
    const items = shown.map((id, i) => ({ id, s: seats[i] }));
    if (free) items.push({ id: null, s: free });
    items.sort((a, b) => a.s[1] - b.s[1]);
    mctx.font = '600 10.5px Lexend, sans-serif';
    return items.map(({ id, s: [x, z] }) => {
      const cid = Art.uid('cc'), c = P(x, H + 11, z), w = EGG_W * v.k, h = EGG_H * v.k, ex = c[0] - w / 2, ey = c[1] - h / 2;
      if (!id) {
        return `<defs>${cupClip(x, z, cid)}</defs><g class="ct-plus" data-invite role="button" tabindex="0" aria-label="invite someone" clip-path="url(#${cid})">
          <svg x="${f1(ex)}" y="${f1(ey + h * .1)}" width="${f1(w)}" height="${f1(h)}" viewBox="0 0 100 130" preserveAspectRatio="none" overflow="visible">
            <path d="${Art.EGG}" fill="rgba(255,255,255,.55)" ${OL()} stroke-dasharray="5 5"/></svg>
          <path d="M${f1(c[0] - 8)},${f1(c[1] - 2)}h16M${f1(c[0])},${f1(c[1] - 10)}v16" ${OL(FLAT.line, 2)}/></g>`;
      }
      const name = id === g.me ? 'you' : prof(id).username, tw = mctx.measureText(name).width + 14, ny = ey + h * .3;
      return `<defs>${cupClip(x, z, cid)}</defs><g class="ct-egg" data-member="${id}" role="button" tabindex="0" aria-label="crack ${id === g.me ? 'your' : esc(name) + "'s"} egg" clip-path="url(#${cid})">
        <g class="ct-sprite">${Art.eggSVG(prof(id).egg).replace('<svg class="egg-svg', `<svg x="${f1(ex)}" y="${f1(ey)}" width="${f1(w)}" height="${f1(h)}" preserveAspectRatio="none" class="egg-svg`)}
          <rect x="${f1(c[0] - tw / 2)}" y="${f1(ny - 8.5)}" width="${f1(tw)}" height="17" rx="8.5" fill="rgba(255,255,255,.95)" ${OL('#DCD6C8', 1)}/>
          <text class="ct-egg-name" x="${f1(c[0])}" y="${f1(ny + 3.6)}" text-anchor="middle">${esc(name)}</text></g></g>`;
    }).join('');
  }

  /* ── fitting the carton to its box, open and shut ── */
  function bbox(state) {
    const keep = v; v = { ...state, k: 1, cx: 0, cy: 0 };
    const pts = [];
    for (const x of [-L / 2, L / 2]) for (const z of [0, -DP]) {
      pts.push(P(x, -6, z), P(x, H, z));
      for (const y of [H, H + LH]) pts.push(P(...rotLid([x, y, z])));
    }
    v = keep;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  }
  function fit() {
    const W = host.clientWidth || 330, Hh = host.clientHeight || 320, bo = bbox(OPEN), bs = bbox(SHUT);
    const ko = Math.min(1.12, (W - 10) / (bo.x1 - bo.x0), (Hh - 8) / (bo.y1 - bo.y0));
    const ks = Math.min(ko * 1.14, (W - 10) / (bs.x1 - bs.x0), (Hh - 8) / (bs.y1 - bs.y0));
    fitO = { k: ko, cx: W / 2 - ko * (bo.x0 + bo.x1) / 2, cy: Hh / 2 - ko * (bo.y0 + bo.y1) / 2 };
    fitS = { k: ks, cx: W / 2 - ks * (bs.x0 + bs.x1) / 2, cy: Hh / 2 - ks * (bs.y0 + bs.y1) / 2 };
    return { W, Hh };
  }

  function mount(el, g) {
    host = el; coop = g; closed = false; busy = false; faces = [];
    try { const q = qrcode(0, 'M'); q.addData(inviteText(g)); q.make(); const n = q.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`; qr = { n, d }; } catch (e) { qr = null; }
    const { W, Hh } = fit();
    v = { ...OPEN, ...fitO };
    const people = g.members.length, more = Math.max(0, people - 6);
    host.innerHTML = `<svg class="ct" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" role="group" aria-label="${esc(g.name)} carton">
      <g id="ctLidB"></g><g id="ctTray"></g><g id="ctEggs">${eggsHTML(g)}</g><g id="ctFront"></g><g id="ctLidF"></g></svg>`;
    svg = $('svg', host); slotB = $('#ctLidB', svg); slotF = $('#ctLidF', svg); eggsG = $('#ctEggs', svg);
    const tray = $('#ctTray', svg), front = $('#ctFront', svg);
    lidG = document.createElementNS(NS, 'g'); lidG.setAttribute('class', 'ct-lid'); lidG.setAttribute('data-lid', '');
    lidG.setAttribute('role', 'button'); lidG.setAttribute('tabindex', '0'); lidG.setAttribute('aria-label', 'close the carton to show the join code');
    /* tray: top with the cups, then the walls you can see (scalloped along the bottom like a real carton) */
    mkFace(tray, { O: [-L / 2, H, 0], U: [L, 0, 0], V: [0, 0, -DP], N: [0, 1, 0], fill: C.tray,
      art: [FRONT, BACK].map(z => XS.map(x => `<circle cx="${x + L / 2}" cy="${-z}" r="${CUP}" fill="${C.cup}" ${OL()}/>`).join('')).join('') });
    mkFace(front, { O: [-L / 2, H, 0], U: [L, 0, 0], V: [0, -H, 0], N: [0, 0, 1], fill: C.front, shape: scallops(L, 3, 9),
      art: more ? `<text class="ct-more" x="${L / 2}" y="${H / 2}" text-anchor="middle">+${more} more</text>` : '' });
    mkFace(front, { O: [L / 2, H, 0], U: [0, 0, -DP], V: [0, -H, 0], N: [1, 0, 0], fill: C.side, shape: scallops(DP, 2, 9) });
    mkFace(front, { O: [-L / 2, H, -DP], U: [0, 0, DP], V: [0, -H, 0], N: [-1, 0, 0], fill: C.side, shape: scallops(DP, 2, 9) });
    /* lid: a box hinged at the back. its open side shows the coop name, its top carries the qr code */
    const top = H + LH;
    mkFace(lidG, { lid: 1, O: [-L / 2, H, 0], U: [L, 0, 0], V: [0, 0, -DP], N: [0, -1, 0], fill: C.lidIn, art: innerArt(g) });
    mkFace(lidG, { lid: 1, O: [-L / 2, top, -DP], U: [L, 0, 0], V: [0, 0, DP], N: [0, 1, 0], fill: C.lidTop, art: topArt(g) });
    mkFace(lidG, { lid: 1, O: [-L / 2, top, 0], U: [L, 0, 0], V: [0, -LH, 0], N: [0, 0, 1], fill: C.lidWall });
    mkFace(lidG, { lid: 1, O: [L / 2, top, -DP], U: [-L, 0, 0], V: [0, -LH, 0], N: [0, 0, -1], fill: C.lidWall });
    mkFace(lidG, { lid: 1, O: [L / 2, top, 0], U: [0, 0, -DP], V: [0, -LH, 0], N: [1, 0, 0], fill: C.lidSide });
    mkFace(lidG, { lid: 1, O: [-L / 2, top, -DP], U: [0, 0, DP], V: [0, -LH, 0], N: [-1, 0, 0], fill: C.lidSide });
    slotB.append(lidG);
    update();
  }

  /* ── motion ── */
  const lerp = (a, b, t) => a + (b - a) * t;
  const io = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function tween(dur, step) {
    return new Promise(res => {
      if (REDUCED) { step(1); return res(); }
      const t0 = performance.now();
      const fr = now => { const t = Math.min(1, (now - t0) / dur); step(t); if (t < 1) requestAnimationFrame(fr); else res(); };
      requestAnimationFrame(fr);
    });
  }
  const camAt = t => ({ ph: lerp(OPEN.ph, SHUT.ph, t), ps: lerp(OPEN.ps, SHUT.ps, t), k: lerp(fitO.k, fitS.k, t), cx: lerp(fitO.cx, fitS.cx, t), cy: lerp(fitO.cy, fitS.cy, t) });
  async function close() {
    /* the lid falls shut with a small bounce, then the carton tips toward you */
    await tween(620, t => { const e = t < .72 ? 1 - Math.pow(t / .72, 2.1) : .055 * Math.sin(Math.PI * (t - .72) / .28); v.th = OPEN.th * e; update(); });
    v.th = 0;
    await tween(640, t => { Object.assign(v, camAt(io(t))); update(); });
  }
  async function open() {
    await tween(560, t => { Object.assign(v, camAt(1 - io(t))); update(); });
    const back = t => { const c = 1.9, x = t - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
    await tween(640, t => { v.th = OPEN.th * back(t); update(); });
    v.th = OPEN.th; update();
  }
  async function toggle() {
    if (busy || !svg) return closed;
    busy = true;
    if (!closed) { await close(); closed = true; lidG.setAttribute('aria-label', 'open the carton'); }
    else { await open(); closed = false; lidG.setAttribute('aria-label', 'close the carton to show the join code'); }
    busy = false;
    return closed;
  }
  function redraw() { if (host && coop && document.body.contains(host)) { const was = closed; mount(host, coop); if (was) { closed = true; v = { ...SHUT, ...fitS }; update(); } } }
  return { mount, toggle, redraw, isClosed: () => closed, isBusy: () => busy };
})();

export { CT };
