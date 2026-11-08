// @ts-nocheck
// Copied VERBATIM from the v0.5 prototype (artifact "art.js"). Do not hand-edit the drawing code:
// if the design changes, re-copy it. Everything here is pure: options in, SVG text out.
// The only additions are the export line at the bottom.

/* art.js — everything drawn in sunny side up. flat and minimal: one fill per shape and one thin outline, no shading, no shadows */

const PEOPLE = {
  val:   { name: 'val',   c: '#F2BF4F', eyes: 'arc',  mouth: 'grin' },
  maya:  { name: 'maya',  c: '#EBA593', eyes: 'dot',  mouth: 'smile' },
  jun:   { name: 'jun',   c: '#9EBCE0', eyes: 'arc',  mouth: 'smile', extra: 'glasses' },
  priya: { name: 'priya', c: '#BEAAE6', eyes: 'wink', mouth: 'cat' },
  theo:  { name: 'theo',  c: '#9DCFAE', eyes: 'dot',  mouth: 'grin' },
  ana:   { name: 'ana',   c: '#EDA9C1', eyes: 'arc',  mouth: 'o' },
  sam:   { name: 'sam',   c: '#F1C08C', eyes: 'line', mouth: 'smile' },
  lu:    { name: 'lu',    c: '#8DCAC3', eyes: 'dot',  mouth: 'cat' },
  kai:   { name: 'kai',   c: '#E8AE7C', eyes: 'dot',  mouth: 'smile' },
  noor:  { name: 'noor',  c: '#B6D48C', eyes: 'arc',  mouth: 'smile' },
  eli:   { name: 'eli',   c: '#A8B4E8', eyes: 'line', mouth: 'o',     extra: 'glasses' },
  rosa:  { name: 'rosa',  c: '#E99A98', eyes: 'arc',  mouth: 'grin' },
  ben:   { name: 'ben',   c: '#CDB894', eyes: 'dot',  mouth: 'smile', extra: 'glasses' },
  mia:   { name: 'mia',   c: '#E3A6D3', eyes: 'wink', mouth: 'smile' },
  /* contacts who aren't in any of val's groups yet */
  jess:  { name: 'jess',  c: '#F3B7A0', eyes: 'dot',  mouth: 'grin' },
  omar:  { name: 'omar',  c: '#A9C7B5', eyes: 'line', mouth: 'smile' },
  lin:   { name: 'lin',   c: '#C9B7E8', eyes: 'arc',  mouth: 'o' },
  dev:   { name: 'dev',   c: '#E8C77A', eyes: 'dot',  mouth: 'smile', extra: 'glasses' },
  zoe:   { name: 'zoe',   c: '#9FD3D0', eyes: 'wink', mouth: 'grin' },
};

const SWATCHES = [
  { id: 'butter', base: '#FFE6A0', acc: '#F0AE33', ink: '#1F2945' },
  { id: 'blush',  base: '#FFD3DB', acc: '#EA7690', ink: '#1F2945' },
  { id: 'sky',    base: '#D0E6FA', acc: '#5797D8', ink: '#1F2945' },
  { id: 'mint',   base: '#CDEEDB', acc: '#47A877', ink: '#1F2945' },
  { id: 'lilac',  base: '#E5DBFB', acc: '#8F72DD', ink: '#1F2945' },
  { id: 'peach',  base: '#FFDCC4', acc: '#EE8546', ink: '#1F2945' },
  { id: 'shell',  base: '#FBF6EC', acc: '#C49E73', ink: '#1F2945' },
  { id: 'cocoa',  base: '#C98A5E', acc: '#F6DDBD', ink: '#FFF6E8' },
];
const PATTERNS = ['plain', 'dots', 'stripes', 'zigzag', 'checks', 'hearts', 'sparkles'];

/* the whole palette for eggs: a white, a yolk, and a pale glint */
const FLAT = { white: '#FFFFFF', yolk: '#F2AE3D', yolkHi: '#FFE7A8', ink: '#1F2945', line: '#4D5263' };
/* every outline in the app is the same 1.5px on screen, however big or small the drawing is shown */
const LW = 1.5;
const OL = (c = FLAT.line, w = LW) => `stroke="${c}" stroke-width="${w}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"`;

const Art = (() => {
  let n = 0;
  const uid = p => `${p}${(++n).toString(36)}`;
  const f1 = v => Math.round(v * 10) / 10;

  function rng(seed) {
    let s = (Math.imul(seed | 0, 2654435761) >>> 0) || 7;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map(sh => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  /* closed catmull-rom spline through points → cubic bezier path */
  function smoothPath(pts) {
    const L = pts.length;
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 0; i < L; i++) {
      const p0 = pts[(i - 1 + L) % L], p1 = pts[i], p2 = pts[(i + 1) % L], p3 = pts[(i + 2) % L];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ` +
           `${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d + 'Z';
  }

  /* an egg-white outline: a circle pushed around by a few soft harmonics. it never moves once drawn */
  function harmonics(seed, amp) {
    const R = rng(seed), h = [];
    for (let k = 0; k < 4; k++) h.push({ f: 2 + k, a: amp * (0.45 + R()) / (1 + k * 0.7), p: R() * 6.283 });
    return h;
  }
  const radiusAt = (th, h) => h.reduce((rr, x) => rr + x.a * Math.sin(x.f * th + x.p), 1);
  function blobPts(cx, cy, r, o = {}) {
    const { seed = 1, amp = 0.14, n: N = 14, sx = 1, sy = 1 } = o;
    const h = harmonics(seed, amp), pts = [];
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2, rr = radiusAt(th, h);
      pts.push([cx + Math.cos(th) * r * rr * sx, cy + Math.sin(th) * r * rr * sy]);
    }
    return pts;
  }
  function blob(cx, cy, r, o = {}) { return smoothPath(blobPts(cx, cy, r, o)); }
  /* the smallest radius whose blob still holds every point, with room to spare */
  function fitR(cx, cy, pts, o = {}, margin = 14) {
    const { seed = 1, amp = 0.14, sx = 1, sy = 1 } = o, h = harmonics(seed, amp);
    let need = 0;
    for (const [x, y] of pts) {
      const dx = (x - cx) / sx, dy = (y - cy) / sy;
      need = Math.max(need, (Math.hypot(dx, dy) + margin / Math.min(sx, sy)) / radiusAt(Math.atan2(dy, dx), h));
    }
    return need;
  }
  /* o.line: false for no outline, 'only' for just the outline, a number for a wider one (merged whites draw lines first, fills second) */
  function albumen(cx, cy, r, o = {}, cls = '') {
    const d = blob(cx, cy, r, o), w = typeof o.line === 'number' ? o.line : 1.5;
    if (o.line === 'only') return `<path class="albumen-line ${cls}" d="${d}" fill="none" ${OL(FLAT.line, o.lw || 3)}/>`;
    return `<path class="albumen ${cls}" d="${d}" fill="${o.fill || FLAT.white}"${o.line === false || o.line === 'none' ? '' : ` ${OL(FLAT.line, w)}${typeof o.line === 'number' ? ' paint-order="stroke"' : ''}`}/>`;
  }
  /* an open catmull-rom curve through points (for the side-view egg's wavy edge) */
  function openPath(pts) {
    const P = [pts[0], ...pts, pts[pts.length - 1]];
    let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
    for (let i = 1; i < P.length - 2; i++) {
      const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
      d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
    }
    return d;
  }

  function defs() { return `<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"></svg>`; }

  /* ───────── yolks & faces ───────── */
  /* one flat circle; a yolk big enough to notice gets a thin glint along its left edge */
  function glint(x, y, r) {
    const R = r * .7, a1 = -112 * Math.PI / 180, a2 = 128 * Math.PI / 180;
    return `<path d="M${f1(x + R * Math.cos(a1))} ${f1(y + R * Math.sin(a1))}A${f1(R)} ${f1(R)} 0 0 0 ${f1(x + R * Math.cos(a2))} ${f1(y + R * Math.sin(a2))}"
      fill="none" stroke="${FLAT.yolkHi}" stroke-width="${f1(Math.max(1.6, r * .1))}" stroke-linecap="round"/>`;
  }
  function yolk(x, y, r, hi = r >= 14) {
    return `<g class="yolk"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" fill="${FLAT.yolk}"/>${hi ? glint(x, y, r) : ''}</g>`;
  }

  const INK = FLAT.ink;
  function faceInner(id) {
    const p = PEOPLE[id] || PEOPLE.val;
    const eyes = {
      arc:  `<path d="M30 47q7-8 14 0M56 47q7-8 14 0" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`,
      dot:  `<circle cx="37" cy="45" r="4.6" fill="${INK}"/><circle cx="63" cy="45" r="4.6" fill="${INK}"/>`,
      wink: `<path d="M30 47q7-8 14 0" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><circle cx="63" cy="45" r="4.6" fill="${INK}"/>`,
      line: `<path d="M31 46h12M57 46h12" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`,
    }[p.eyes];
    const mouth = {
      smile: `<path d="M40 60q10 9 20 0" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/>`,
      grin:  `<path d="M37 58h26q-1 13-13 13t-13-13z" fill="${INK}"/>`,
      o:     `<circle cx="50" cy="63" r="5.4" fill="${INK}"/>`,
      cat:   `<path d="M40 60q5 5.5 10 0q5 5.5 10 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    }[p.mouth];
    const extra = p.extra === 'glasses'
      ? `<g fill="none" stroke="${INK}" stroke-width="2.6"><circle cx="37" cy="46" r="10"/><circle cx="63" cy="46" r="10"/><path d="M47.5 45q2.5-2.4 5 0"/></g>` : '';
    return `<circle cx="50" cy="50" r="50" fill="${p.c}"/><g class="eyes">${eyes}</g>${extra}<g class="mouth">${mouth}</g>`;
  }
  /* a real profile photo replaces the drawn face wherever that person appears */
  const PHOTO = {};
  function setPhoto(id, url) { if (url) PHOTO[id] = url; else delete PHOTO[id]; }
  function faceG(id, x, y, r) {
    if (PHOTO[id]) {
      const c = uid('fc');
      return `<g class="face"><clipPath id="${c}"><circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}"/></clipPath>
        <image href="${PHOTO[id]}" x="${f1(x - r)}" y="${f1(y - r)}" width="${f1(2 * r)}" height="${f1(2 * r)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${c})"/></g>`;
    }
    return `<g class="face" transform="translate(${f1(x - r)} ${f1(y - r)}) scale(${(r / 50).toFixed(4)})">${faceInner(id)}</g>`;
  }
  function faceSVG(id, cls = '') {
    if (PHOTO[id]) return `<img class="face-svg ${cls}" src="${PHOTO[id]}" alt="">`;
    return `<svg class="face-svg ${cls}" viewBox="0 0 100 100" aria-hidden="true">${faceInner(id)}</svg>`;
  }

  function friedEgg(o) {
    const { w, h, cx = w / 2, cy = h / 2, r, seed = 3, amp = .14, sx = 1, sy = 1,
      yx = cx, yy = cy, yr = r * .36, face = null, cls = '', yolkCls = '' } = o;
    return `<svg class="${cls}" viewBox="0 0 ${f1(w)} ${f1(h)}" width="${f1(w)}" height="${f1(h)}" aria-hidden="true" overflow="visible">
      ${albumen(cx, cy, r, { seed, amp, sx, sy })}
      <g class="${yolkCls}">${face ? faceG(face, yx, yy, yr) : yolk(yx, yy, yr)}</g>
    </svg>`;
  }
  const miniEgg = (cls = '') => friedEgg({ w: 40, h: 40, r: 15, seed: 11, amp: .12, yr: 6.6, yx: 21, yy: 19, cls: 'mini-egg ' + cls });

  /* ───────── whole eggs (shell, decorated) ───────── */
  const EGG = 'M50 3C76 3 95 50 95 79c0 28-20 48-45 48S5 107 5 79C5 50 24 3 50 3Z';
  const CRACK = '3,70 13,62 22,72 33,61 44,72 55,61 66,71 77,61 87,70 97,63';
  const CLIP_TOP = '-20,-20 120,-20 120,63 97,63 87,70 77,61 66,71 55,61 44,72 33,61 22,72 13,62 3,70 -20,70';
  const CLIP_BOT = '-20,70 3,70 13,62 22,72 33,61 44,72 55,61 66,71 77,61 87,70 97,63 120,63 120,150 -20,150';

  function patternDef(id, kind, acc) {
    switch (kind) {
      case 'dots': return `<pattern id="${id}" width="15" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(18)"><circle cx="7.5" cy="7.5" r="2.9" fill="${acc}"/></pattern>`;
      case 'stripes': return `<pattern id="${id}" width="50" height="17" patternUnits="userSpaceOnUse"><path d="M0 5q12.5-5 25 0t25 0v6q-12.5 5-25 0t-25 0z" fill="${acc}"/></pattern>`;
      case 'zigzag': return `<pattern id="${id}" width="16" height="13" patternUnits="userSpaceOnUse"><path d="M0 9l4-5 4 5 4-5 4 5" stroke="${acc}" stroke-width="2.4" fill="none" stroke-linejoin="round" stroke-linecap="round"/></pattern>`;
      case 'checks': return `<pattern id="${id}" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="8" height="16" fill="${acc}" opacity=".38"/><rect width="16" height="8" fill="${acc}" opacity=".38"/></pattern>`;
      case 'hearts': return `<pattern id="${id}" width="20" height="19" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)"><path d="M10 15.5c-3.6-2.7-6.4-5-6.4-7.8a3.2 3.2 0 0 1 6.4-1 3.2 3.2 0 0 1 6.4 1c0 2.8-2.8 5.1-6.4 7.8z" fill="${acc}"/></pattern>`;
      case 'sparkles': return `<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M7 3l1.3 4.2L12.5 8.5 8.3 9.8 7 14 5.7 9.8 1.5 8.5l4.2-1.3z" fill="${acc}"/><circle cx="17" cy="17" r="1.6" fill="${acc}"/></pattern>`;
      default: return '';
    }
  }
  /* parts: 'whole' | 'top' | 'bottom' */
  function eggSVG(opts = {}, part = 'whole', cls = '') {
    const { swatch = 'shell', pattern = 'plain', text = '', speckle = false, ty = 74, shine: shineO = .8 } = opts;
    const sw = SWATCHES.find(s => s.id === swatch) || SWATCHES[6];
    const pid = uid('pt'), cid = uid('ec'), pid2 = uid('ep');
    let label = '';
    const t = (text || '').trim();
    if (t) {
      const fs = Math.max(9, Math.min(14, 14 * 7 / Math.max(7, t.length)));
      const lw = Math.min(84, t.length * fs * .56 + 18);
      label = `<rect x="${f1(50 - lw / 2)}" y="${f1(ty - fs * .95)}" width="${f1(lw)}" height="${f1(fs * 1.75)}" rx="${f1(fs * .87)}" fill="${sw.base}"/>
        <text class="egg-text" x="50" y="${f1(ty + fs * .34)}" text-anchor="middle" font-size="${f1(fs)}" fill="${sw.ink}">${esc(t)}</text>`;
    }
    let specks = '';
    if (speckle) {
      const R = rng(5);
      for (let i = 0; i < 14; i++) specks += `<circle cx="${f1(14 + R() * 72)}" cy="${f1(16 + R() * 104)}" r="${f1(.8 + R() * 1)}" fill="#D2B48E"/>`;
    }
    const body = `<rect x="-5" y="-5" width="110" height="140" fill="${sw.base}"/>
      ${pattern !== 'plain' ? `<rect x="-5" y="-5" width="110" height="140" fill="url(#${pid})"/>` : ''}${specks}${label}`;
    const shine = shineO ? `<path d="M25 50q2-21 16-34" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="${shineO}"/>` : '';
    const inner = `<g clip-path="url(#${cid})">${body}</g>${shine}<path d="${EGG}" fill="none" ${OL()}/>`;
    const partClip = part === 'whole' ? '' : `<clipPath id="${pid2}"><polygon points="${part === 'top' ? CLIP_TOP : CLIP_BOT}"/></clipPath>`;
    return `<svg class="egg-svg ${cls}" viewBox="0 0 100 130" aria-hidden="true" overflow="visible"><defs><clipPath id="${cid}"><path d="${EGG}"/></clipPath>
      ${patternDef(pid, pattern, sw.acc)}${partClip}</defs>
      ${part === 'whole' ? inner : `<g clip-path="url(#${pid2})">${inner}</g><polyline class="crack-edge" points="${CRACK}" fill="none" ${OL()} clip-path="url(#${cid})"/>`}
      ${part === 'whole' ? `<polyline class="crack" points="${CRACK}" pathLength="1" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
        <polyline class="crack crack-2" points="44,72 47,80 43,88" pathLength="1" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>
        <polyline class="crack crack-2" points="66,71 70,77 69,84" pathLength="1" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>` : ''}
    </svg>`;
  }

  /* a fried egg with flames licking up behind it: an egg war is on (smaller flames while it's still being voted on) */
  function flameEgg(cls = '') {
    return `<svg class="flame-egg ${cls}" viewBox="0 0 48 52" aria-hidden="true" overflow="visible">
      <g class="fl-out"><path d="M9 36C5 27 8 18 14 13c0 6 3 9 6 8-1-8 2-15 8-20-1 8 4 11 5 17 2-3 3-6 2-10 7 6 9 17 5 28z" fill="#EE7A3B" ${OL()}/></g>
      <g class="fl-in"><path d="M15 36c-2-6 0-11 4-14 0 4 2 6 4 5 0-5 2-9 6-12-1 5 3 8 3 12 2-1 3-3 3-5 4 5 4 10 2 14z" fill="#F9C64A"/></g>
      <path d="${blob(24, 39, 14, { seed: 11, amp: .12, sx: 1.18, sy: .78, n: 14 })}" fill="${FLAT.white}" ${OL()}/>
      <circle cx="25" cy="37.5" r="5.6" fill="${FLAT.yolk}"/></svg>`;
  }

  /* the bottom half of a cracked shell: one white shape with a zigzag rim */
  function halfShell() {
    const zig = 'M4 9L15 16 26 6 38 16 50 7 62 16 74 6 86 16 98 7 110 16 121 7 128 10';
    return `<svg class="half-shell" viewBox="0 0 132 66" aria-hidden="true" preserveAspectRatio="none" overflow="visible">
      <path d="${zig}C129 42 102 62 66 62C30 62 3 42 4 9Z" fill="${FLAT.white}" ${OL()}/></svg>`;
  }

  /* ───────── pan & gift ───────── */
  function pan() {
    const rim = '#C9CCD3', base = '#E1E3E7';
    return `<svg class="pan-svg" viewBox="0 0 170 130" aria-hidden="true" overflow="visible">
      <g class="pan-rock">
        <path d="M128 64l36-9q6-1 6 4t-6 6l-34 8z" fill="${rim}" ${OL()}/>
        <ellipse cx="74" cy="66" rx="62" ry="35" fill="${rim}" ${OL()}/>
        <ellipse cx="74" cy="63" rx="52" ry="28" fill="${base}" ${OL()}/>
        <g class="pan-egg">
          <path d="${blob(71, 62, 24, { seed: 21, amp: .16, sy: .62 })}" fill="${FLAT.white}" ${OL()}/>
          <ellipse cx="67" cy="58.5" rx="8.6" ry="6.6" fill="${FLAT.yolk}"/>
          <g class="bubbles" fill="${FLAT.white}" ${OL(rim, 1)}>
            <circle cx="40" cy="70" r="1.8" style="--d:0s"/><circle cx="103" cy="58" r="1.5" style="--d:.35s"/>
            <circle cx="96" cy="76" r="1.6" style="--d:.7s"/><circle cx="46" cy="54" r="1.3" style="--d:1s"/>
          </g>
        </g>
      </g>
      <g class="steam" fill="none" stroke="${rim}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round">
        <path d="M58 30q-6-8 0-15t0-15" style="--d:0s"/><path d="M76 28q6-8 0-15t0-15" style="--d:.8s"/><path d="M94 31q-6-8 0-15t0-15" style="--d:1.6s"/>
      </g>
    </svg>`;
  }
  function gift() {
    return `<svg viewBox="0 0 40 40" aria-hidden="true">
      <rect x="7" y="18" width="26" height="17" rx="3" fill="${FLAT.yolk}"/>
      <rect x="5" y="12" width="30" height="7.5" rx="2.4" fill="#F7C766"/>
      <rect x="17.5" y="12" width="5" height="23" fill="#E9775A"/>
      <path d="M20 12c-3-6-11-7-10-2 1 3 6 3 10 2zM20 12c3-6 11-7 10-2-1 3-6 3-10 2z" fill="#E9775A"/>
    </svg>`;
  }

  /* ───────── placeholder photos (all 1:1), a few flat shapes each ───────── */
  const BACK = {
    kitchen: `<rect width="100" height="100" fill="#F3E3C7"/><rect x="58" y="10" width="30" height="36" rx="3" fill="#CFE3EC"/><rect y="84" width="100" height="16" fill="#E2C29A"/>`,
    brunch:  `<rect width="100" height="100" fill="#F6D9C9"/><circle cx="24" cy="26" r="14" fill="#FBEDE4"/><rect y="82" width="100" height="18" fill="#EFE2D0"/>`,
    hike:    `<rect width="100" height="100" fill="#D4E6EC"/><path d="M-5 74L24 38l20 22 16-18 45 32z" fill="#A9C3A6"/><rect y="74" width="100" height="26" fill="#C2CF9E"/>`,
    beach:   `<rect width="100" height="100" fill="#FBDDB9"/><circle cx="24" cy="28" r="9" fill="#FFF0CC"/><rect y="56" width="100" height="18" fill="#9CC5CF"/><rect y="74" width="100" height="26" fill="#F1DDB8"/>`,
    lilac:   `<rect width="100" height="100" fill="#E6DEF5"/><rect x="12" y="14" width="22" height="28" rx="2" fill="#FFFFFF"/><rect y="84" width="100" height="16" fill="#D2C4EA"/>`,
  };
  const LAYOUT = {
    3: [[30, 52, 16], [70, 52, 16], [50, 74, 19]],
    4: [[23, 52, 14.5], [50, 45, 15.5], [77, 52, 14.5], [50, 76, 18]],
    5: [[17, 54, 12.5], [37, 45, 13.5], [63, 45, 13.5], [83, 54, 12.5], [50, 76, 17]],
  };
  function person(id, x, y, r) {
    const p = PEOPLE[id];
    return `<ellipse cx="${x}" cy="${f1(y + r * 1.45)}" rx="${f1(r * 1.2)}" ry="${f1(r * .85)}" fill="${mix(p.c, INK, .16)}"/>${faceG(id, x, y, r)}`;
  }
  function groupPhoto(g) {
    const ids = [...g.members.filter(m => m !== g.selfie), g.selfie || g.members[0]];
    const L = LAYOUT[ids.length] || LAYOUT[4];
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${BACK[g.theme] || BACK.kitchen}
      ${ids.map((id, i) => person(id, ...L[i])).join('')}</svg>`;
  }

  function scene(name) {
    switch (name) {
      case 'latte': return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="100" height="100" fill="#D9B793"/>
        <circle cx="50" cy="52" r="33" fill="#F7F1E8"/>
        <circle cx="50" cy="52" r="21" fill="#FFFFFF"/><circle cx="50" cy="52" r="17" fill="#A9774E"/>
        <path d="M50 46c-4-6-13-3-10 4 2 5 8 8 10 12 2-4 8-7 10-12 3-7-6-10-10-4z" fill="#F4E3CB"/>
      </svg>`;
      case 'sunset': return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="100" height="100" fill="#A891BE"/><rect y="30" width="100" height="16" fill="#E5A08F"/><rect y="46" width="100" height="16" fill="#FBC891"/>
        <circle cx="54" cy="62" r="16" fill="#FFE5A6"/>
        <rect y="62" width="100" height="38" fill="#7A72A0"/>
        <path d="M42 68h24M46 73h16M50 78h8" stroke="#FFE5A6" stroke-width="1.8" stroke-linecap="round"/>
      </svg>`;
      case 'window': return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="100" height="100" fill="#F2E3CD"/>
        <rect x="16" y="10" width="68" height="52" rx="3" fill="#BFDDF0"/><path d="M50 10v52M16 36h68" stroke="#F2E3CD" stroke-width="3"/>
        <rect y="68" width="100" height="32" fill="#DDB990"/>
        <path d="M30 58q-10-8-11-20q9 5 11 20zM30 58q2-15 11-22q1 12-11 22z" fill="#86B27F"/><path d="M22 58h16l-2 11H24z" fill="#E08A63"/>
      </svg>`;
      default: return BACK[name] ? `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${BACK[name]}</svg>` : '';
    }
  }
  /* a face-forward "camera" shot: the videos friends send */
  function talkScene(id, back = 'kitchen', cls = '') {
    return `<svg class="${cls}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${BACK[back] || BACK.kitchen}
      <g class="bob">${person(id, 50, 52, 27)}</g></svg>`;
  }

  /* ───────── icons ───────── */
  const s = (d, w = 1.8) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
    back: s('<path d="M15 5l-7 7 7 7"/>'),
    chev: s('<path d="M7 10l5 5 5-5"/>', 2),
    right: s('<path d="M9 5l7 7-7 7"/>'),
    send: s('<path d="M4 12l16-8-6 16-2.6-6.4z"/><path d="M11.4 13.6L20 4"/>'),
    retake: s('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
    flip: s('<path d="M4 9a8 8 0 0 1 14.5-3.5L20 7"/><path d="M20 3v4h-4"/><path d="M20 15a8 8 0 0 1-14.5 3.5L4 17"/><path d="M4 21v-4h4"/>'),
    gallery: s('<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="9" cy="9" r="1.8"/><path d="M20.5 15l-5-5-11 10.5"/>'),
    camera: s('<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.5"/>'),
    mic: s('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>', 2),
    video: s('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10.5l5-3v9l-5-3z"/>', 2),
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/></svg>',
    check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 2.2),
    text: s('<path d="M5 7V5h14v2M12 5v14M9 19h6"/>'),
    color: s('<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 1.6-2.2-.5-1.4.3-2.8 1.8-2.8H18a3 3 0 0 0 3-3c0-5-4-9-9-9z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.2" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>'),
    pattern: s('<path d="M4 8q4-4 8 0t8 0M4 16q4-4 8 0t8 0"/>'),
    cal: s('<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    home: s('<path d="M4 11l8-6.5 8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/>'),
    sun: s('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
    settings: s('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>'),
    replay: s('<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4v4.6h4.6"/>'),
    plus: s('<path d="M12 5v14M5 12h14"/>', 2),
    chat: s('<path d="M5 18.5V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8.5z"/>'),
    copy: s('<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>'),
    trash: s('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
    cake: s('<path d="M5 20v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M4 20h16M5 15q2.3 2 4.7 0t4.6 0 4.7 0M12 11V8"/><path d="M12 5.5q1 1.2 0 2.2q-1-1 0-2.2z" fill="currentColor"/>'),
    pin: s('<path d="M12 21s6-5.6 6-11a6 6 0 0 0-12 0c0 5.4 6 11 6 11z"/><circle cx="12" cy="10" r="2.2"/>'),
    clock: s('<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>'),
    people: s('<circle cx="9" cy="9" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M15.5 14.2a4.6 4.6 0 0 1 5 4.8"/>'),
    edit: s('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>'),
    left: s('<path d="M15 5l-7 7 7 7"/>'),
    down: s('<path d="M6 9l6 6 6-6"/>'),
    sparkle: s('<path d="M12 4l1.6 5.4L19 11l-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z"/>'),
    lock: s('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    save: s('<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>', 2),
    mirror: s('<path d="M12 3v18" stroke-dasharray="2 2.6"/><path d="M9 7L4 17h5zM15 7l5 10h-5z"/>'),
    flag: s('<path d="M6 21V4M6 4.5q3-1.6 6 0t6 0V13q-3 1.6-6 0t-6 0"/>'),
    trophy: s('<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
    target: s('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  };

  function esc(t) { return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  return { uid, f1, rng, mix, blob, blobPts, smoothPath, flameEgg, openPath, fitR, albumen, setPhoto, defs, yolk, glint, faceG, faceSVG, friedEgg, miniEgg, eggSVG, halfShell, pan, gift, groupPhoto, scene, talkScene, I, esc, EGG };
})();


export { Art, FLAT, OL, PATTERNS, PEOPLE, SWATCHES };
