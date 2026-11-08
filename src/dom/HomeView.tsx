'use dom';

// A5: the whole home screen, from the prototype's app.js (`renderHome`, `homeEntrance`, `setMode`, the corner
// eggs and menu, `renderBottomLabel`, the weekday card stacks) and coop.js (the coop list, leave, "add a
// coop"). One web view for everything on it. Data comes in as props; actions go back to the native side.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import { Art, OL } from './art/art';
import './art/art.css';
import { createChick, type ChickCarryProp, type ChickMailProp, type ChickNudgeProp } from './chick';
import { faceId } from './faces';
import { play, sleep, T } from './play';
import { crackTile, fryTile, popTile, tileHTML, type SundayTileEgg, type SundayTilePerson, type SundayTileState } from './sundayTiles';
import { avatar, call, closeOv, esc, fmtDate, I, openOv, OV_HTML, plural, relRect, setTop, sideEgg, toast, TOAST_HTML, wireOv, yolkExpand, type DomPerson, type YolkMorph } from './ui';

export interface HomeCoopProp {
  id: string;
  name: string;
  members: number;
  today: string | null;
  coverUrl: string | null;
  photo: { url: string | null; by: string; time: string } | null;
  event: { id: string; title: string; day: number; dow: string; mon: string; when: string; going: string[] } | null;
  war: { state: 'vote' | 'live'; label: string } | null;
  sunday: { state: SundayTileState; partner: SundayTilePerson | null; theirs: SundayTileEgg | null };
}
export type HomeMode = 'weekday' | 'sunday';
export type SundayAct = 'cracked' | 'respond' | 'open' | 'watch';

interface Props {
  top: number;
  me: DomPerson | null;
  people: Record<string, DomPerson>;
  coops: HomeCoopProp[];
  loaded: boolean;
  mode: HomeMode;
  /** Is home the screen you're looking at? (Coming back shrinks the yolk, and the chick may drop by.) */
  focused: boolean;
  bottom: { label: string; aria: string; ready: boolean; tip: string };
  demo: boolean;
  chick: { on: boolean; nudge: ChickNudgeProp | null; latest: ChickNudgeProp | null; mail: ChickMailProp | null; carry: ChickCarryProp | null };
  onMode: (m: HomeMode) => Promise<void>;
  onCoop: (id: string) => Promise<void>;
  onEvents: (id: string | null) => Promise<void>;
  onEvent: (id: string) => Promise<void>;
  onWar: (id: string) => Promise<void>;
  onCover: (id: string) => Promise<string | null>;
  onProfile: () => Promise<void>;
  onRoute: (to: 'settings' | 'nudges' | 'demo' | 'coop/new') => Promise<void>;
  onCamera: () => Promise<void>;
  onJoin: (code: string) => Promise<string | null>;
  onLeave: (id: string) => Promise<void>;
  onSunday: (id: string, act: SundayAct) => Promise<void>;
  onChickSend: (n: ChickNudgeProp) => Promise<void>;
  onChickOpen: (m: ChickMailProp) => Promise<void>;
  onChickDismiss: (n: ChickNudgeProp) => Promise<void>;
  onChickOff: () => Promise<void>;
  onCarryDone: () => Promise<void>;
  dom?: DOMProps;
}

const SLOTS = ['translate(0px,0px) rotate(0deg) scale(1)', 'translate(6px,7px) rotate(2.4deg) scale(.965)', 'translate(-5px,13px) rotate(-2.2deg) scale(.93)'];
const MENU_YOLK = { x: 44, dy: 28, r: 21 };
const easeOutSoft = (x: number) => {
  const c1 = 0.9;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
};
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

export default function HomeView(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const [ready, setReady] = useState(false);
  const stacks = useRef(new Map<string, number>());
  const tiles = useRef(new Map<string, { key: string; state: SundayTileState; busy?: boolean }>());
  const chick = useRef<ReturnType<typeof createChick> | null>(null);
  const morph = useRef<YolkMorph | null>(null);
  const menu = useRef({ P0: null as number[][] | null, P1: null as number[][] | null, t: 0, raf: 0 });
  useEffect(() => {
    latest.current = props;
  });

  const { top, me, people, coops, mode, loaded, bottom, focused, demo } = props;
  const sunday = mode === 'sunday';
  const nameOf = (id: string | null | undefined) => (!id ? 'someone' : (people[id]?.username ?? 'a friend'));
  const personOf = (id: string) => people[id] ?? { id, username: 'friend' };
  const myId = me?.id ?? '';

  /* ───────── corner eggs ───────── */
  function $<E extends Element = HTMLElement>(s: string) {
    return root.current!.querySelector<E>(s)!;
  }
  function sizeLayer(svg: Element) {
    const r = root.current!;
    svg.setAttribute('width', String(r.clientWidth));
    svg.setAttribute('height', String(r.clientHeight));
    svg.setAttribute('viewBox', `0 0 ${r.clientWidth} ${r.clientHeight}`);
  }
  function drawCornerWhite(t: number) {
    const el = root.current?.querySelector('#cornerWhite');
    const CM = menu.current;
    if (!el || !CM.P0 || !CM.P1) return;
    el.setAttribute('d', Art.smoothPath(CM.P0.map((p, i) => [p[0] + (CM.P1![i][0] - p[0]) * t, p[1] + (CM.P1![i][1] - p[1]) * t])));
  }
  /* the menu egg: the corner white and the open white are the same egg (same wobble, same number of points),
     so opening the menu just lets the white spread out from the corner until it holds every item */
  function fitMenuEgg() {
    const r = root.current!;
    const N = 30;
    const P0 = Art.blobPts(16, top - 12, 90, { seed: 13, amp: 0.1, sx: 1.05, n: N });
    const pts: number[][] = [];
    r.querySelectorAll('#menu > *').forEach((el) => {
      const b = relRect(r, el);
      const last = el.lastElementChild;
      const right = last ? (() => { const q = relRect(r, last); return q.x + q.w; })() : b.x + b.w;
      pts.push([b.x - 2, b.y + 2], [right + 8, b.y + 2], [b.x - 2, b.y + b.h - 2], [right + 8, b.y + b.h - 2]);
    });
    P0.forEach((p) => {
      if (p[0] > -2 && p[1] > -2) pts.push(p);
    });
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2 - 10;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const o1 = { seed: 13, amp: 0.07, sx: 1, sy: Math.max(1, Math.min(1.45, (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs)))), n: N };
    menu.current.P0 = P0;
    menu.current.P1 = Art.blobPts(cx, cy, Art.fitR(cx, cy, pts, o1, 16), o1);
    drawCornerWhite(menu.current.t);
  }
  function tweenCorner(to: number, dur: number, ease: (x: number) => number) {
    const CM = menu.current;
    cancelAnimationFrame(CM.raf);
    const from = CM.t;
    const t0 = performance.now();
    if (!dur) {
      CM.t = to;
      return drawCornerWhite(to);
    }
    const step = (now: number) => {
      const x = Math.min(1, (now - t0) / T(dur));
      CM.t = from + (to - from) * ease(x);
      drawCornerWhite(CM.t);
      if (x < 1) CM.raf = requestAnimationFrame(step);
      else CM.t = to;
    };
    CM.raf = requestAnimationFrame(step);
  }
  function openMenu() {
    fitMenuEgg();
    root.current!.classList.add('menu-open');
    tweenCorner(1, 480, easeOutSoft);
  }
  function closeMenu(instant = false) {
    const h = root.current!;
    if (!h.classList.contains('menu-open')) return;
    h.classList.remove('menu-open');
    tweenCorner(0, instant ? 0 : 320, easeInOut);
  }

  // Draw everything that only needs doing once.
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    const yy = top + MENU_YOLK.dy;
    r.querySelectorAll('#cwSmall, #cwBig, #cwYolk, #crEgg').forEach(sizeLayer);
    $('#cwSmall').innerHTML = `<path id="cornerWhite" fill="#FFFFFF" ${OL()}/>`;
    $('#cwYolk').innerHTML = `<g id="cornerLYolk">${Art.yolk(MENU_YOLK.x, yy, MENU_YOLK.r)}</g>`;
    Object.assign($('#menuBtn').style, { left: `${MENU_YOLK.x - 28}px`, top: `${yy - 28}px`, width: '56px', height: '56px' });
    $('#titleChev').innerHTML = I.down;
    wireOv(r);
    chick.current = createChick(r, $('#chickLayer'), () => latest.current.mode === 'sunday', {
      onSend: (n) => call(latest.current.onChickSend, n),
      onOpen: (m) => call(latest.current.onChickOpen, m),
      onDismiss: (n) => call(latest.current.onChickDismiss, n),
      onOff: () => call(latest.current.onChickOff),
    });
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* profile: your picture is the yolk, and the white is sized to hold your handle */
  useEffect(() => {
    const r = root.current;
    if (!ready || !r || !me) return;
    const W = r.clientWidth;
    const fx = W - 50;
    const fy = top + 24;
    const fr = 22;
    const h = $('#handle');
    h.textContent = `@${me.username}`;
    Object.assign(h.style, { left: `${fx}px`, top: `${fy + fr + 9}px` });
    const hw = h.offsetWidth / 2 + 4;
    const hy0 = fy + fr + 7;
    const hy1 = fy + fr + 11 + h.offsetHeight;
    const pts = [[fx - fr, fy - fr], [fx + fr, fy - fr], [fx - fr, fy + fr], [fx + fr, fy + fr], [fx - hw, hy0], [fx + hw, hy0], [fx - hw, hy1], [fx + hw, hy1]];
    const o = { seed: 17, amp: 0.1, sx: 1.05, n: 16 };
    const ccx = W - 6;
    const ccy = top - 16;
    $('#crEgg').innerHTML = `${Art.albumen(ccx, ccy, Art.fitR(ccx, ccy, pts, o, 12), o)}<g>${Art.faceG(faceId(me), fx, fy, fr)}</g>`;
    Object.assign($('#profileBtn').style, { left: `${fx - 34}px`, top: `${fy - 30}px`, width: '68px', height: `${hy1 - fy + 34}px` });
  }, [ready, me?.id, me?.username, me?.photoUrl, top]); // eslint-disable-line react-hooks/exhaustive-deps

  // The menu's items (the demo ones only when demo controls are configured).
  useEffect(() => {
    if (!ready) return;
    const M: Record<string, [string, string]> = {
      weekday: [I.home, 'my coops'],
      sunday: [I.sun, 'sunny sunday'],
      calendar: [I.cal, 'calendar'],
      nudges: [I.sparkle, 'nudges'],
      settings: [I.settings, 'settings'],
      demo: [I.retake, 'demo controls'],
      chick: [I.sparkle, 'demo: call the chick'],
    };
    const keys = ['weekday', 'sunday', 'calendar', 'nudges', 'settings'];
    $('#menu').innerHTML =
      keys.map((k) => `<button data-menu="${k}" aria-current="${k === mode}">${M[k][0]}<span>${M[k][1]}</span></button>`).join('') +
      (demo ? `<hr>${['demo', 'chick'].map((k) => `<button data-menu="${k}">${M[k][0]}<span>${M[k][1]}</span></button>`).join('')}` : '');
    fitMenuEgg();
  }, [ready, mode, demo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───────── the feeds ───────── */
  function pageGroup(g: HomeCoopProp) {
    const who = g.today === myId ? `<span class="u">it's your day</span>` : g.today ? `it's ${esc(nameOf(g.today))}'s day` : 'quiet today';
    const cover = g.coverUrl
      ? `<img src="${esc(g.coverUrl)}" alt="${esc(g.name)} coop photo"><button class="pg-edit" data-cover="${g.id}" data-nocycle aria-label="change the coop photo">${I.edit}</button>`
      : `<button class="pg-add" data-cover="${g.id}" data-nocycle aria-label="add a photo for ${esc(g.name)}">${I.plus}<span>add a coop photo</span></button>`;
    return `<div class="photo">${cover}</div><div class="pg-foot">${who}</div>`;
  }
  function pagePhoto(g: HomeCoopProp) {
    if (g.photo) {
      return `<div class="photo">${g.photo.url ? `<img src="${esc(g.photo.url)}" alt="">` : ''}</div>
    <div class="pg-by">${avatar(personOf(g.photo.by))}<b>${g.photo.by === myId ? 'you' : esc(nameOf(g.photo.by))}</b><span>${esc(g.photo.time)}</span></div>`;
    }
    return `<div class="pg-empty">${Art.miniEgg()}<p>${g.today === myId ? 'your photo goes here' : `waiting on ${esc(nameOf(g.today))}`}</p></div>
    <div class="pg-by"><span class="mono" style="margin:0">${g.today === myId ? 'tap the yolk below' : 'any minute now'}</span></div>`;
  }
  function pageEvent(g: HomeCoopProp) {
    const e = g.event;
    const link = `<button class="ev-link" data-events="${g.id}" data-nocycle>${I.cal}see all events</button>`;
    if (!e) {
      return `<div class="pg-ev"><span class="mono">up next</span><div class="ev-title" style="margin-top:14px">nothing planned yet</div>
    <div class="ev-where">plan something from the events page</div><div style="margin-top:auto">${link}</div></div>`;
    }
    return `<div class="pg-ev"><span class="mono">up next</span>
    <div class="ev-date"><b>${e.day}</b><span>${e.dow}<br>${e.mon}</span></div>
    <div class="ev-title" data-event="${e.id}" data-nocycle>${esc(e.title)}</div><div class="ev-where">${esc(e.when)}</div>
    <div class="ev-going">${e.going.slice(0, 3).map((id) => avatar(personOf(id))).join('')}<span>${e.going.length} going</span></div>${link}</div>`;
  }
  function warBadge(g: HomeCoopProp) {
    if (!g.war) return '';
    return `<button class="stack-badge war-badge${g.war.state === 'vote' ? ' vote' : ''}" data-war-badge="${g.id}" data-nocycle aria-label="${esc(g.war.label)}" title="${esc(g.war.label)}">${Art.flameEgg()}</button>`;
  }

  function initStack(st: HTMLElement, gid: string) {
    const cards = Array.from(st.querySelectorAll<HTMLElement>('.card'));
    const dots = Array.from(st.parentElement!.querySelectorAll('.dots i'));
    const order = [0, 1, 2];
    while (order[0] !== (stacks.current.get(gid) ?? 0)) order.push(order.shift()!);
    const layout = (anim: boolean) => {
      order.forEach((ci, pos) => {
        const c = cards[ci];
        c.style.transition = anim ? 'transform .55s cubic-bezier(.22,1,.36,1)' : 'none';
        c.style.transform = SLOTS[pos];
        c.style.zIndex = String(3 - pos);
        c.classList.toggle('top', pos === 0);
      });
      dots.forEach((d, i) => d.classList.toggle('on', i === order[0]));
    };
    layout(false);
    let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, down = false, drag = false, busy = false; // prettier-ignore
    async function cycle(dir: number) {
      if (busy) return;
      busy = true;
      const topCard = cards[order[0]];
      st.style.zIndex = '20';
      topCard.style.transition = 'transform .26s cubic-bezier(.4,0,1,1)';
      topCard.style.transform = `translate(${dir * 118}%, -4%) rotate(${dir * 15}deg)`;
      await sleep(250);
      order.push(order.shift()!);
      stacks.current.set(gid, order[0]);
      topCard.style.zIndex = '0';
      void topCard.offsetWidth;
      layout(true);
      await sleep(520);
      st.style.zIndex = '';
      busy = false;
    }
    st.addEventListener('pointerdown', (e) => {
      if (busy || e.button > 0 || (e.target as HTMLElement).closest('[data-nocycle]')) return;
      down = true;
      drag = false;
      sx = e.clientX;
      sy = e.clientY;
      dx = dy = 0;
      t0 = performance.now();
    });
    st.addEventListener('pointermove', (e) => {
      if (!down) return;
      dx = e.clientX - sx;
      dy = e.clientY - sy;
      if (!drag && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        drag = true;
        try {
          st.setPointerCapture(e.pointerId);
        } catch {
          /* fine */
        }
        st.style.zIndex = '20';
      }
      if (!drag) return;
      const topCard = cards[order[0]];
      const nxt = cards[order[1]];
      const p = Math.min(1, Math.abs(dx) / 140);
      topCard.style.transition = 'none';
      nxt.style.transition = 'none';
      topCard.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${dx * 0.08}deg)`;
      nxt.style.transform = `translate(${6 - 6 * p}px, ${7 - 7 * p}px) rotate(${2.4 - 2.4 * p}deg) scale(${0.965 + 0.035 * p})`;
    });
    st.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      const v = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (drag) {
        if (Math.abs(dx) > 60 || v > 0.6) void cycle(Math.sign(dx) || -1);
        else {
          layout(true);
          st.style.zIndex = '';
        }
      } else if (Math.abs(dx) < 7 && Math.abs(dy) < 7) void cycle(-1);
    });
    st.addEventListener('pointercancel', () => {
      if (down) {
        down = false;
        layout(true);
        st.style.zIndex = '';
      }
    });
  }

  const weekKey = JSON.stringify([coops.map(({ sunday: _s, ...c }) => c), people, myId]);
  useEffect(() => {
    if (!ready) return;
    const feed = $('#feedWeek');
    feed.innerHTML = coops.length
      ? coops
          .map(
            (g) => `<article class="group" data-g="${g.id}">
      <button class="g-name" data-open-group="${g.id}" aria-label="open ${esc(g.name)}">${esc(g.name)}</button>
      <div class="stack${g.today === myId ? ' mine' : ''}" role="group" aria-label="${esc(g.name)}. swipe or tap to flip through">
        <div class="card">${pageGroup(g)}</div><div class="card">${pagePhoto(g)}</div><div class="card">${pageEvent(g)}</div>
        ${warBadge(g)}
      </div>
      <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
    </article>`,
          )
          .join('')
      : '';
    feed.querySelectorAll<HTMLElement>('.stack').forEach((st) => initStack(st, st.parentElement!.dataset.g ?? ''));
  }, [ready, weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sunKey = JSON.stringify(coops.map((c) => [c.id, c.name, c.sunday]));
  useEffect(() => {
    if (!ready) return;
    const feed = $('#feedSun');
    const seen = new Set<string>();
    for (const c of coops) {
      seen.add(c.id);
      let slot = feed.querySelector<HTMLElement>(`[data-g="${c.id}"]`);
      if (!slot) {
        slot = document.createElement('div');
        slot.dataset.g = c.id;
        slot.style.minWidth = '0';
        feed.append(slot);
      }
      const key = JSON.stringify([c.name, c.sunday]);
      const old = tiles.current.get(c.id);
      if (old?.busy || old?.key === key) continue;
      slot.innerHTML = tileHTML(c.sunday.state, c.name, c.sunday.partner, c.sunday.theirs);
      tiles.current.set(c.id, { key, state: c.sunday.state });
      if (old && old.state !== c.sunday.state) popTile(slot.querySelector('.tile'));
    }
    feed.querySelectorAll<HTMLElement>('[data-g]').forEach((s) => {
      if (!seen.has(s.dataset.g ?? '')) s.remove();
    });
  }, [ready, sunKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* the bottom egg */
  useEffect(() => {
    if (!ready) return;
    const be = $('#bottomEgg');
    be.classList.toggle('ready', bottom.ready);
    sideEgg(be, { label: bottom.label, aria: bottom.aria, onTap: homeEggTap });
  }, [ready, bottom.label, bottom.ready, bottom.aria]); // eslint-disable-line react-hooks/exhaustive-deps

  async function homeEggTap() {
    const p = latest.current;
    if (p.mode === 'sunday' || morph.current) return;
    const r = root.current!;
    const y = $('#bottomEgg .se-yolk');
    if (!p.bottom.ready) {
      play(y, [{ transform: 'none' }, { transform: 'scale(1.06,.9)' }, { transform: 'scale(.98,1.04)' }, { transform: 'none' }], { duration: 450, keep: false });
      return toast(r, p.bottom.tip);
    }
    morph.current = await yolkExpand(r, $('.fx'), y);
    call(latest.current.onCamera);
  }

  // setMode(): the feed fades out and the other one rises in.
  const shownMode = useRef(mode);
  useEffect(() => {
    if (!ready) return;
    const r = root.current!;
    const sc = $('#homeScroll');
    const apply = () => {
      r.classList.toggle('sunday-mode', mode === 'sunday');
      sc.classList.toggle('sunday', mode === 'sunday');
      $('#homeTitle').textContent = mode === 'sunday' ? 'sunny sunday!' : 'my coops';
      $('#feedWeek').hidden = mode === 'sunday';
      $('#feedSun').hidden = mode !== 'sunday';
    };
    if (shownMode.current === mode) return apply();
    shownMode.current = mode;
    play(sc, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px)' }], { duration: 220, keep: false }).then(() => {
      sc.scrollTop = 0;
      apply();
      play(sc, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 420, keep: false });
      r.querySelectorAll(mode === 'sunday' ? '#feedSun .tile' : '#feedWeek .group').forEach((el, i) =>
        play(el, [{ opacity: 0, transform: 'translateY(22px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 650, delay: 60 + i * 70, keep: false }),
      );
    });
  }, [ready, mode]);

  // homeEntrance(), once the coops have arrived.
  const entered = useRef(false);
  useEffect(() => {
    if (!ready || !loaded || entered.current) return;
    entered.current = true;
    const r = root.current!;
    play($('#cornerL'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 100, keep: false });
    play($('#cornerR'), [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 160, keep: false });
    play($('.home-title'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 200, keep: false });
    r.querySelectorAll(sunday ? '#feedSun .tile' : '#feedWeek .group').forEach((el, i) =>
      play(el, [{ opacity: 0, transform: 'translateY(28px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 750, delay: 300 + i * 90, keep: false }),
    );
    if (!sunday) play($('#bottomEgg'), [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 800, delay: 450, keep: false });
  }, [ready, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back: the yolk shrinks back into the bottom egg.
  useEffect(() => {
    if (!focused || !morph.current) return;
    const m = morph.current;
    morph.current = null;
    void m.shrink();
  }, [focused]);

  /* ───────── the chick's visits ───────── */
  const visited = useRef(new Set<string>());
  // At most one suggestion per landing, however many nudges are waiting.
  const nudgedThisLanding = useRef(false);
  useEffect(() => {
    if (focused) nudgedThisLanding.current = false;
  }, [focused]);
  const carryId = props.chick.carry?.id ?? null;
  const mailId = props.chick.mail?.id ?? null;
  const nudgeId = props.chick.nudge?.id ?? null;
  useEffect(() => {
    if (!ready || !focused) return;
    // An egg you just "put off" comes back the next time you land here.
    visited.current.forEach((k) => {
      if (k.startsWith('later:')) visited.current.delete(k);
    });
    const timer = setTimeout(
      () => {
        const p = latest.current;
        const ch = chick.current;
        const r = root.current;
        if (!ch || !r || !p.focused || ch.isOut() || r.classList.contains('menu-open') || r.classList.contains('list-open')) return;
        if (p.chick.carry && !visited.current.has(p.chick.carry.id)) {
          visited.current.add(p.chick.carry.id);
          call(p.onCarryDone);
          return void ch.carry(p.chick.carry);
        }
        if (!p.chick.on) return;
        if (p.chick.mail && !visited.current.has(`later:${p.chick.mail.id}`)) {
          visited.current.add(`later:${p.chick.mail.id}`);
          return void ch.delivery(p.chick.mail);
        }
        if (p.chick.nudge && !visited.current.has(p.chick.nudge.id) && !nudgedThisLanding.current) {
          visited.current.add(p.chick.nudge.id);
          nudgedThisLanding.current = true;
          return void ch.nudge(p.chick.nudge);
        }
      },
      T(carryId ? 700 : 2200),
    );
    return () => clearTimeout(timer);
  }, [ready, focused, carryId, mailId, nudgeId, props.chick.on]);

  /* ───────── the coop list under "my coops" ───────── */
  function renderGroupList() {
    const p = latest.current;
    $('#groupList').innerHTML =
      `<button class="gl-add" data-gl-add><span class="plus">${I.plus}</span>add coop</button>` +
      p.coops
        .map(
          (g) => `<div class="gl-row"><button class="gl-leave" data-leave="${g.id}" aria-label="leave ${esc(g.name)}">${I.trash}leave</button>
      <div class="gl-slide" role="button" tabindex="0" data-open="${g.id}" aria-label="open ${esc(g.name)}">
        <span class="gl-ic">${g.coverUrl ? `<img src="${esc(g.coverUrl)}" alt="">` : Art.miniEgg()}</span>
        <span class="gl-t"><b>${esc(g.name)}</b><small>${plural(g.members, 'member')}</small></span>${I.right}</div></div>`,
        )
        .join('') +
      (p.coops.length ? `<p class="gl-tip">swipe a coop to the left to leave it</p>` : '');
    root.current!.querySelectorAll<HTMLElement>('#groupList .gl-slide').forEach(wireSwipe);
  }
  function wireSwipe(sl: HTMLElement) {
    const OPEN = -84;
    let x0 = 0, dx = 0, down = false, moved = false, open = false; // prettier-ignore
    const set = (x: number, anim: boolean) => {
      sl.style.transition = anim ? 'transform .3s cubic-bezier(.22,1,.36,1)' : 'none';
      sl.style.transform = x ? `translateX(${x}px)` : '';
    };
    sl.addEventListener('pointerdown', (e) => {
      down = true;
      moved = false;
      x0 = e.clientX;
      dx = 0;
    });
    sl.addEventListener('pointermove', (e) => {
      if (!down) return;
      dx = e.clientX - x0;
      if (!moved && Math.abs(dx) > 6) {
        moved = true;
        try {
          sl.setPointerCapture(e.pointerId);
        } catch {
          /* fine */
        }
      }
      if (moved) set(Math.max(OPEN - 14, Math.min(0, dx + (open ? OPEN : 0))), false);
    });
    const end = () => {
      if (!down) return;
      down = false;
      if (moved) {
        open = dx + (open ? OPEN : 0) < OPEN / 2;
        set(open ? OPEN : 0, true);
      }
    };
    sl.addEventListener('pointerup', end);
    sl.addEventListener('pointercancel', end);
    sl.addEventListener('click', () => {
      if (moved) {
        moved = false;
        return;
      }
      if (open) {
        open = false;
        set(0, true);
        return;
      }
      closeGroupList(true);
      call(latest.current.onCoop, sl.dataset.open ?? '');
    });
  }
  function openGroupList() {
    const h = root.current!;
    if (h.classList.contains('list-open')) return;
    closeMenu(true);
    $('#homeScroll').scrollTop = 0;
    renderGroupList();
    const t = relRect(h, $('#titleBtn'));
    const gl = $('#groupList');
    gl.style.top = `${t.y + t.h + 6}px`;
    gl.hidden = false;
    h.classList.add('list-open');
    $('#titleBtn').setAttribute('aria-expanded', 'true');
    play(gl, [{ opacity: 0, transform: 'translateY(-8px) scaleY(.94)' }, { opacity: 1, transform: 'none' }], { duration: 300, keep: false });
  }
  function closeGroupList(instant = false) {
    const h = root.current!;
    if (!h.classList.contains('list-open')) return;
    h.classList.remove('list-open');
    $('#titleBtn').setAttribute('aria-expanded', 'false');
    const gl = $('#groupList');
    if (instant) {
      gl.hidden = true;
      return;
    }
    play(gl, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 180, keep: false }).then(() => {
      if (!h.classList.contains('list-open')) gl.hidden = true;
    });
  }
  /* leaving needs a yes: you'd need the code to get back in */
  function confirmLeave(gid: string) {
    const r = root.current!;
    const g = latest.current.coops.find((c) => c.id === gid);
    if (!g) return;
    const box = openOv(
      r,
      `<div class="confirm" role="alertdialog"><span class="cf-ic">${g.coverUrl ? `<img src="${esc(g.coverUrl)}" alt="">` : Art.miniEgg()}</span>
      <h3>are you sure you want to leave the coop?</h3><p>you will need a code to rejoin.</p>
      <div class="cf-btns"><button class="cf-cancel" data-ov-close>cancel</button><button class="cf-leave" id="cfLeave">leave</button></div></div>`,
      { onClose: () => renderGroupList() },
    );
    box.querySelector('#cfLeave')!.addEventListener('click', () => {
      void closeOv(r);
      closeGroupList(true);
      toast(r, `you left ${g.name}`);
      call(latest.current.onLeave, gid);
    });
  }
  /* add a coop: an egg-shaped popup with two ways in */
  function openCoopPop() {
    const r = root.current!;
    const pop = openOv(r, `<div class="egg-pop" role="dialog" aria-label="add a coop"></div>`);
    pop.innerHTML = `<button class="eg-x" data-ov-close aria-label="close">${I.close}</button><h3>add a coop</h3>
      <button class="eg-link" data-coop="new">create new</button><button class="eg-link" data-coop="join">join with code</button>`;
    pop.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-coop]');
      if (!b) return;
      if (b.dataset.coop === 'new') {
        void closeOv(r);
        return void setTimeout(() => call(latest.current.onRoute, 'coop/new'), T(160));
      }
      pop.innerHTML = `<button class="eg-x" data-ov-close aria-label="close">${I.close}</button><h3>type the coop code</h3>
      <input id="joinCode" maxlength="7" placeholder="ABC-123" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="coop code">
      <p class="eg-err" id="joinErr" role="alert"></p><button class="pill solid small" id="joinGo">enter</button>`;
      play(pop, [{ transform: 'scaleX(.9)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 260, keep: false });
      const inp = pop.querySelector<HTMLInputElement>('#joinCode')!;
      const err = pop.querySelector('#joinErr')!;
      setTimeout(() => inp.focus(), 60);
      const shake = () => play(inp, [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(-4px)' }, { transform: 'none' }], { duration: 360, keep: false });
      const go = async () => {
        const raw = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (raw.length < 6) {
          err.textContent = 'codes have 3 letters and 3 numbers';
          return shake();
        }
        err.textContent = '';
        const problem = await latest.current.onJoin(raw).catch((x: unknown) => (x instanceof Error ? x.message : "couldn't join"));
        if (problem) {
          err.textContent = problem.toLowerCase();
          return shake();
        }
        void closeOv(r);
      };
      inp.addEventListener('keydown', (k) => {
        if (k.key === 'Enter') void go();
      });
      pop.querySelector('#joinGo')!.addEventListener('click', () => void go());
    });
  }

  /* ───────── taps ───────── */
  async function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    if (t.closest('#menuBtn')) return r.classList.contains('menu-open') ? closeMenu() : openMenu();
    if (t.closest('#menuScrim')) return closeMenu();
    const mb = t.closest<HTMLElement>('[data-menu]');
    if (mb) {
      const k = mb.dataset.menu ?? '';
      closeMenu();
      return void setTimeout(() => {
        if (k === 'weekday' || k === 'sunday') call(latest.current.onMode, k);
        else if (k === 'calendar') call(latest.current.onEvents, null);
        else if (k === 'settings' || k === 'nudges' || k === 'demo') call(latest.current.onRoute, k);
        else if (k === 'chick') {
          const q = latest.current.chick;
          if (q.latest) {
            $('#chickLayer').innerHTML = '';
            void chick.current?.nudge(q.latest);
          } else toast(r, 'no nudges yet. run drift + nudge from demo controls');
        }
      }, T(200));
    }
    if (t.closest('#profileBtn')) return call(p.onProfile);
    if (t.closest('#titleBtn')) return r.classList.contains('list-open') ? closeGroupList() : openGroupList();
    if (t.closest('#listScrim')) return closeGroupList();
    if (t.closest('[data-gl-add]')) {
      closeGroupList();
      return void setTimeout(openCoopPop, T(120));
    }
    const lv = t.closest<HTMLElement>('[data-leave]');
    if (lv) return confirmLeave(lv.dataset.leave ?? '');

    const wb = t.closest<HTMLElement>('[data-war-badge]');
    if (wb) return call(p.onWar, wb.dataset.warBadge ?? '');
    const og = t.closest<HTMLElement>('[data-open-group]');
    if (og) return call(p.onCoop, og.dataset.openGroup ?? '');
    const cv = t.closest<HTMLElement>('[data-cover]');
    if (cv) {
      const g = p.coops.find((c) => c.id === cv.dataset.cover);
      const done = await p.onCover(cv.dataset.cover ?? '').catch(() => "that photo didn't upload. try again");
      if (done) toast(r, done);
      else if (g && done === '') toast(r, `new photo for ${g.name}`);
      return;
    }
    const ev = t.closest<HTMLElement>('[data-event]');
    if (ev) return call(p.onEvent, ev.dataset.event ?? '');
    const evb = t.closest<HTMLElement>('[data-events]');
    if (evb) return call(p.onEvents, evb.dataset.events ?? '');

    const b = t.closest<HTMLElement>('[data-act]');
    if (b) {
      const slot = b.closest<HTMLElement>('#feedSun [data-g]');
      const gid = slot?.dataset.g ?? '';
      const g = p.coops.find((c) => c.id === gid);
      const tile = slot?.querySelector<HTMLElement>('.tile');
      if (!g || !tile || tiles.current.get(gid)?.busy) return;
      const act = b.dataset.act;
      if (act === 'fry') return fryTile(tile);
      if (act === 'crack' && g.sunday.partner) {
        tiles.current.set(gid, { key: tiles.current.get(gid)?.key ?? '', state: 'B', busy: true });
        await crackTile(tile, g.sunday.partner);
        tiles.current.set(gid, { key: JSON.stringify([g.name, { ...g.sunday, state: 'B' }]), state: 'B' });
        return call(latest.current.onSunday, gid, 'cracked');
      }
      if (act === 'respond' || act === 'open' || act === 'watch') return call(p.onSunday, gid, act);
    }
  }

  return (
    <section ref={root} className="view on" id="v-home" onClick={(e) => void onClick(e)} style={{ overflow: 'hidden' }}>
      <div className="home-scroll" id="homeScroll">
        <header className="home-title">
          <button className="title-btn" id="titleBtn" aria-expanded="false" aria-controls="groupList">
            <h1 className="display" id="homeTitle">
              my coops
            </h1>
            <span className="t-chev" id="titleChev" />
          </button>
          <p className="mono">{fmtDate(new Date())}</p>
        </header>
        <div className="feed" id="feedWeek" />
        <div className="feed" id="feedSun" hidden />
        {loaded && !coops.length ? <div className="empty-note">no coops yet. tap &quot;my coops&quot; up top to make one or join with a code.</div> : null}
      </div>
      <div className="home-fade" />
      <div className="side-egg bottom-egg" id="bottomEgg" />
      <div className="list-scrim" id="listScrim" />
      <div className="glist" id="groupList" hidden />
      <div className="menu-scrim" id="menuScrim" />
      <div className="corner corner-l" id="cornerL">
        <svg className="cw cw-small" id="cwSmall" aria-hidden="true" />
        <svg className="cw cw-big" id="cwBig" aria-hidden="true" />
        <nav className="menu" id="menu" aria-label="menu" />
        <svg className="cw cw-yolk" id="cwYolk" aria-hidden="true" />
        <button className="corner-hit" id="menuBtn" aria-label="open menu" />
      </div>
      <div className="corner corner-r" id="cornerR">
        <svg className="cw" id="crEgg" aria-hidden="true" />
        <span className="handle" id="handle" />
        <button className="corner-hit" id="profileBtn" aria-label="your profile" />
      </div>
      <div className="chick-layer" id="chickLayer" />
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div className="fx" />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
