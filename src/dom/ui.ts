// The prototype's shared screen helpers, copied for DOM components: `hdr`, `plural`, `avatar`, `sideEgg`,
// `toast`, `openOv`/`closeOv`, `confettiBurst`, `burst`, `yolkMorph` and the gallery's `masonryHTML` /
// `lightbox`. Where the prototype reads a global (#screen, #fx, #ov, #toast) these take the screen's root.
import { Art, FLAT, OL } from './art/art';
import { faceId } from './faces';
import { play, T } from './play';

export const I = Art.I;
export const esc = (t: unknown) => Art.esc(t ?? '');
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const pxs = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, `${v}px`]));

export const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
export const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const fmtDate = (d: Date) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
export const fmtShort = (d: Date) => `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
export function fmtClock(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`;
}

// Text fields must not zoom the page when focused (iOS zooms on inputs under 16px).
if (typeof document !== 'undefined') {
  const meta = document.querySelector('meta[name="viewport"]');
  meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
  document.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches?.('input, textarea')) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 320);
  });
  document.addEventListener('focusout', () => setTimeout(() => window.scrollTo(0, 0), 50));
}

export interface DomPerson {
  id: string;
  username: string;
  name?: string;
  photoUrl?: string | null;
}

export const avatar = (p: { id: string; photoUrl?: string | null }) => `<span class="av">${Art.faceSVG(faceId(p))}</span>`;

export function hdr(title: string, sub = '', right = '') {
  return `<header class="hdr"><button class="icon-btn" data-back aria-label="back">${I.back}</button>
    <div class="hdr-t">${title ? `<b>${title}</b>` : ''}${sub ? `<span>${sub}</span>` : ''}</div><div class="hdr-r">${right}</div></header>`;
}

/** Sets the status bar height the prototype's layout reads, and marks the root as the screen. */
export function setTop(root: HTMLElement, top: number) {
  root.style.setProperty('--top', `${top}px`);
}

/* the egg at the bottom of any screen: flat, seen from the side. the white runs across the whole bottom of the
   screen with a wavy edge, and a solid yolk dome sits on it carrying the label (the yolk is the button) */
export function sideEgg(host: HTMLElement, { label, icon = '', aria, onTap }: { label: string; icon?: string; aria?: string; onTap: () => void }) {
  const W = host.clientWidth || host.parentElement?.clientWidth || window.innerWidth;
  const H = 128;
  const cx = W / 2;
  const edge = 70;
  const yw = Math.round(Math.min(86, W * 0.225));
  const up = 46;
  const yb = edge + 12;
  const pts: number[][] = [];
  for (let x = -8; x <= W + 8; x += 14) {
    const u = (x - cx) / (W / 2);
    pts.push([x, edge + 24 * u * u + 2.2 * Math.sin(x / 21 + 0.6) + 1.2 * Math.sin(x / 8.5) * Math.min(1, Math.abs(u) * 2)]);
  }
  const line = Art.openPath(pts);
  host.style.height = `${H}px`;
  host.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">
      <path d="${line}L${W + 8},${H + 60}L-8,${H + 60}Z" fill="#FFFFFF"/>
      <path d="${line}" fill="none" ${OL()}/>
      <path class="se-yolk" d="M${cx - yw},${yb}A${yw},${up} 0 0 1 ${cx + yw},${yb}Q${cx},${yb + 9} ${cx - yw},${yb}Z" fill="${FLAT.yolk}" ${OL()}/>
    </svg><span class="se-label" style="left:${cx}px;top:${Math.round(yb - up * 0.4)}px">${icon}${esc(label)}</span>
    <button class="se-hit" style="left:${cx - yw - 18}px;top:${yb - up - 12}px;width:${2 * yw + 36}px;height:${up + 34}px" aria-label="${esc(aria || label)}"></button>`;
  const hit = host.querySelector<HTMLButtonElement>('.se-hit')!;
  hit.onclick = onTap;
  hit.onpointerdown = () => host.classList.add('pressed');
  hit.onpointerup = hit.onpointerleave = () => host.classList.remove('pressed');
}

/* ───────── toast ───────── */
const toastTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
export const TOAST_HTML = `<div class="toast" role="status" aria-live="polite"><span class="toast-egg"></span><span class="toast-text"></span></div>`;
export function toast(root: HTMLElement, msg: string, ms = 2600) {
  const t = root.querySelector('.toast');
  if (!t) return;
  const egg = t.querySelector('.toast-egg');
  if (egg && !egg.innerHTML) egg.innerHTML = Art.miniEgg();
  t.querySelector('.toast-text')!.textContent = msg;
  t.classList.add('on');
  const old = toastTimers.get(t);
  if (old) clearTimeout(old);
  toastTimers.set(t, setTimeout(() => t.classList.remove('on'), ms));
}

/* ───────── overlay host shared by popups, sheets and the photo viewer ───────── */
export const OV_HTML = `<div class="ov"></div>`;
type Ov = HTMLElement & { _closing?: boolean; _onClose?: (() => void) | null };
export function openOv(root: HTMLElement, html: string, { onClose }: { onClose?: () => void } = {}) {
  const ov = root.querySelector<Ov>('.ov')!;
  ov._closing = false;
  ov.innerHTML = `<div class="ov-scrim" data-ov-close></div>${html}`;
  ov.classList.add('on');
  ov._onClose = onClose ?? null;
  const panel = ov.lastElementChild as HTMLElement;
  play(ov.querySelector('.ov-scrim'), [{ opacity: 0 }, { opacity: 1 }], { duration: 220, keep: false });
  if (panel.classList.contains('sheet')) play(panel, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 380, keep: false });
  else play(panel, [{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 280, keep: false });
  return panel;
}
export async function closeOv(root: HTMLElement) {
  const ov = root.querySelector<Ov>('.ov');
  if (!ov || !ov.classList.contains('on') || ov._closing) return;
  ov._closing = true;
  const panel = ov.lastElementChild as HTMLElement | null;
  const f = ov._onClose;
  ov._onClose = null;
  play(ov.querySelector('.ov-scrim'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  await play(panel, panel?.classList.contains('sheet') ? [{ transform: 'none' }, { transform: 'translateY(100%)' }] : [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
  ov._closing = false;
  /* something new may have opened while this one was closing: leave it alone */
  if (ov.lastElementChild === panel) {
    ov.classList.remove('on');
    ov.innerHTML = '';
  }
  f?.();
}
/** Wire the overlay's close taps once (call from a mount effect). */
export function wireOv(root: HTMLElement) {
  const ov = root.querySelector('.ov');
  ov?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('[data-ov-close]')) void closeOv(root);
  });
}

/* ───────── yellow confetti, sparks ───────── */
export function confettiBurst(root: HTMLElement, n = 64) {
  const W = root.clientWidth;
  const H = root.clientHeight;
  const cols = ['#F2AE3D', '#FFE7A8', '#F7C766', '#FFFFFF', '#E39A24'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    const col = cols[i % cols.length];
    const rot = Math.random() * 360;
    const dx = (Math.random() - 0.5) * 140;
    c.className = 'confetti';
    Object.assign(c.style, {
      left: `${Math.random() * W}px`,
      background: col,
      width: `${6 + Math.random() * 6}px`,
      height: `${9 + Math.random() * 8}px`,
      boxShadow: col === '#FFFFFF' ? '0 0 0 1px #E2DED3' : 'none',
      borderRadius: i % 3 ? '3px' : '50%',
    });
    root.append(c);
    play(c, [{ transform: `translate(0,0) rotate(${rot}deg)` }, { transform: `translate(${dx}px, ${H + 40}px) rotate(${rot + 520}deg)` }], {
      duration: 1700 + Math.random() * 1400,
      delay: Math.random() * 450,
      easing: 'cubic-bezier(.25,.6,.45,1)',
      keep: false,
    }).then(() => c.remove());
  }
}
export function burst(host: HTMLElement, x: number, y: number, n = 12) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.className = 'spark-dot';
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 50 + Math.random() * 60;
    const sz = 4 + Math.random() * 6;
    Object.assign(d.style, { left: `${x}px`, top: `${y}px`, width: `${sz}px`, height: `${sz}px`, background: i % 3 ? '#F2AE3D' : '#fff' });
    host.append(d);
    play(
      d,
      [
        { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 1.2}px), calc(-50% + ${Math.sin(a) * dist * 1.2 + 20}px)) scale(.4)`, opacity: 0 },
      ],
      { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', keep: false },
    ).then(() => d.remove());
  }
}

export function relRect(root: HTMLElement, el: Element) {
  const s = root.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
}

/* the yolk swells until it is the whole screen. it starts as the exact outline of the yolk you tapped
   (the dome on the bottom egg, a circle elsewhere) and every point travels straight out to a big circle,
   so it never flashes into a stretched oval on the way */
const easeInOutQuart = (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);
function yolkOutline(root: HTMLElement, el: Element) {
  const sr = root.getBoundingClientRect();
  const N = 96;
  if (el instanceof SVGGeometryElement) {
    const L = el.getTotalLength();
    const m = el.getScreenCTM()!;
    return Array.from({ length: N }, (_, i) => {
      const p = el.getPointAtLength((L * i) / N);
      const q = new DOMPoint(p.x, p.y).matrixTransform(m);
      return [q.x - sr.left, q.y - sr.top];
    });
  }
  const r = relRect(root, el);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rad = Math.min(r.w, r.h) / 2;
  return Array.from({ length: N }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  });
}
export interface YolkMorph {
  shrink: () => Promise<void>;
}
/** Plays the yolk swelling to fill `root`, then leaves it there until `shrink()` (coming back). */
export async function yolkExpand(root: HTMLElement, fx: HTMLElement, circleEl: Element): Promise<YolkMorph> {
  const P0 = yolkOutline(root, circleEl);
  const W = root.clientWidth;
  const H = root.clientHeight;
  const c = P0.reduce((m, p) => [m[0] + p[0] / P0.length, m[1] + p[1] / P0.length], [0, 0]);
  const R = Math.hypot(Math.max(c[0], W - c[0]), Math.max(c[1], H - c[1])) + 40;
  const P1 = P0.map((p) => {
    const a = Math.atan2(p[1] - c[1], p[0] - c[0]);
    return [c[0] + R * Math.cos(a), c[1] + R * Math.sin(a)];
  });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'yolk-morph');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `<path fill="${FLAT.yolk}" ${OL()}/>`;
  const path = svg.firstElementChild as SVGPathElement;
  path.style.transformOrigin = `${c[0]}px ${c[1]}px`;
  const draw = (t: number) =>
    path.setAttribute('d', `M${P0.map((p, i) => `${(p[0] + (P1[i][0] - p[0]) * t).toFixed(1)},${(p[1] + (P1[i][1] - p[1]) * t).toFixed(1)}`).join('L')}Z`);
  const run = (from: number, to: number, dur: number) =>
    new Promise<void>((res) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const x = Math.min(1, (now - t0) / T(dur));
        draw(from + (to - from) * easeInOutQuart(x));
        if (x < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  draw(0);
  fx.append(svg);
  await play(path, [{ transform: 'scale(1)' }, { transform: 'scale(1.07,.92)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-in-out', keep: false });
  await run(0, 1, 700);
  return {
    shrink: async () => {
      await run(1, 0, 640);
      svg.remove();
    },
  };
}

/* ───────── gallery grid and the photo viewer ───────── */
export interface DomPhoto {
  url: string | null;
  ar?: number | null;
  by: string;
  caption?: string;
}
export function masonryHTML(list: DomPhoto[], me: string, nameOf: (id: string) => string) {
  return `<div class="masonry">${list
    .map(
      (p, i) => `<button class="m-tile" data-ph="${i}" style="aspect-ratio:${(p.ar || 1).toFixed(3)}" aria-label="photo by ${esc(p.by === me ? 'you' : nameOf(p.by))}">
    ${p.url ? `<img src="${esc(p.url)}" alt="" loading="lazy">` : ''}</button>`,
    )
    .join('')}</div>`;
}
export function lightbox(root: HTMLElement, list: DomPhoto[], start: number, me: string, nameOf: (id: string) => string) {
  let i = start;
  const panel = openOv(root, `<div class="lightbox" role="dialog" aria-label="photo viewer"></div>`);
  const show = () => {
    const p = list[i];
    panel.innerHTML = `<div class="lb-top"><button class="icon-btn" data-ov-close aria-label="close">${I.close}</button>
        <span>${p.caption ? esc(p.caption) : `${p.by === me ? 'you' : esc(nameOf(p.by))}${list.length > 1 ? `, ${i + 1} of ${list.length}` : ''}`}</span><span style="width:42px"></span></div>
      <div class="lb-img">${p.url ? `<img src="${esc(p.url)}" alt="">` : ''}</div>
      <div class="lb-nav">${list.length > 1 ? `<button class="icon-btn" data-lb="-1" aria-label="previous photo">${I.left}</button><button class="icon-btn" data-lb="1" aria-label="next photo">${I.right}</button>` : ''}</div>`;
  };
  show();
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lb]');
    if (b) {
      i = (i + Number(b.dataset.lb) + list.length) % list.length;
      show();
    }
  });
}

/** Call a native callback from the web view: rejected or torn-down calls are not this page's problem. */
export const call = <A extends unknown[]>(f: ((...a: A) => Promise<unknown>) | undefined, ...a: A) => {
  void f?.(...a).catch(() => {});
};
