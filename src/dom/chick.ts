// The nudge chick, from the prototype's chick.js: it waddles onto the screen and suggests one friend who
// could use an egg; send one and it runs off carrying it; when a friend sends you one it runs in carrying
// that. Same drawing, poses and moves. What differs is what it says: the prototype's "the backend" (made-up
// scores, "has been a lot quieter", "their activity is down 40%") would tell friends why someone was picked,
// which plan §9.4 forbids, so the bubble shows only the server's neutral `message`, and "why am i seeing
// this?" explains how nudges work in general and shows nothing about the friend.
import { Art, OL } from './art/art';
import { play, sleep, T } from './play';
import { avatar, closeOv, esc, I, openOv, relRect, toast } from './ui';

export interface ChickFriend {
  id: string;
  username: string;
  photoUrl?: string | null;
}
export interface ChickNudgeProp {
  id: string;
  friend: ChickFriend;
  message: string;
}
export interface ChickMailProp {
  id: string;
  friend: ChickFriend;
  egg: { swatch: string; pattern: string; text?: string | null };
}
export interface ChickCarryProp {
  id: string;
  to: string;
  egg: { swatch: string; pattern: string };
}

interface Callbacks {
  onSend: (nudge: ChickNudgeProp) => void;
  onOpen: (mail: ChickMailProp) => void;
  onDismiss: (nudge: ChickNudgeProp) => void;
  onOff: () => void;
}

const CK = { body: '#FFE48A', wing: '#F8D266', beak: '#F49A3B', eye: '#3A3133' };
function chickSVG(carry: { swatch: string; pattern: string } | null = null) {
  const egg = carry ? Art.eggSVG({ ...carry, text: '' }).replace('<svg class="egg-svg', '<svg x="33" y="50" width="34" height="44" class="egg-svg ck-held"') : '';
  return `<svg class="ck-svg" viewBox="0 0 100 110" overflow="visible" aria-hidden="true">
    <g class="ck-foot l"><path d="M31 100.5c0-3.6 3.6-5.5 8.5-5.5s9 2 9 5.5-4 4.5-9 4.5-8.5-1-8.5-4.5z" fill="${CK.beak}" ${OL()}/></g>
    <g class="ck-foot r"><path d="M51.5 100.5c0-3.6 4-5.5 9-5.5s8.5 1.9 8.5 5.5-3.6 4.5-8.5 4.5-9-.9-9-4.5z" fill="${CK.beak}" ${OL()}/></g>
    <g class="ck-body">
      <ellipse cx="50" cy="74" rx="31" ry="24" fill="${CK.body}" ${OL()}/>
      ${egg}
      <g class="ck-wing l"><ellipse cx="22" cy="74" rx="9.5" ry="14" transform="rotate(18 22 74)" fill="${CK.wing}" ${OL()}/></g>
      <g class="ck-wing r"><ellipse cx="78" cy="74" rx="9.5" ry="14" transform="rotate(-18 78 74)" fill="${CK.wing}" ${OL()}/></g>
      <g class="ck-head">
        <circle cx="50" cy="38" r="26" fill="${CK.body}" ${OL()}/>
        <g class="ck-eyes"><ellipse cx="40.5" cy="36.5" rx="3.2" ry="4.6" fill="${CK.eye}"/><ellipse cx="59.5" cy="36.5" rx="3.2" ry="4.6" fill="${CK.eye}"/></g>
        <rect x="43" y="42" width="14" height="8.5" rx="4.25" fill="${CK.beak}" ${OL()}/>
      </g>
    </g></svg>
    <svg class="ck-marks" viewBox="0 0 30 30" aria-hidden="true"><path d="M8 18l-5-6M15 14l-1-9M21 17l5-6" fill="none" stroke="${CK.beak}" stroke-width="2.6" stroke-linecap="round"/></svg>
    <span class="ck-q" aria-hidden="true">?</span>
    <svg class="ck-speed" viewBox="0 0 30 24" aria-hidden="true"><path d="M2 6h16M8 13h20M2 20h14" fill="none" stroke="${CK.wing}" stroke-width="2.6" stroke-linecap="round"/></svg>`;
}

type ChickEl = HTMLButtonElement & { _dragged?: boolean };

export function createChick(root: HTMLElement, layer: HTMLElement, isSunday: () => boolean, cb: Callbacks) {
  const SW = () => root.clientWidth;
  const CH: { busy: boolean; target: ChickNudgeProp | null; pending: ChickMailProp | null } = { busy: false, target: null, pending: null };

  /* where the chick stands: on the bottom egg's white, near the right edge (or on the floor on sunny sunday) */
  function chickSpot() {
    const W = SW();
    const w = 84;
    const left = W - w - 18;
    if (isSunday()) return { left, bottom: 22 };
    const u = (left + w / 2 - W / 2) / (W / 2);
    const edge = 70 + 24 * u * u;
    return { left, bottom: Math.round(128 - edge - 4) };
  }

  const pose = (c: Element, ...cls: string[]) => {
    c.className = ['chick', ...cls].join(' ');
  };
  const hop = (c: Element, h = 16) =>
    play(c.querySelector('.ck-svg'), [{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(2px) scale(1.08,.9)', offset: 0.18 }, { transform: `translateY(-${h}px) scale(.96,1.05)`, offset: 0.5 }, { transform: 'translateY(0) scale(1.06,.94)', offset: 0.82 }, { transform: 'none' }], { duration: 480, easing: 'ease-out', keep: false });

  function spawnChick(carry: { swatch: string; pattern: string } | null = null) {
    layer.innerHTML = '';
    const sp = chickSpot();
    const c = document.createElement('button') as ChickEl;
    c.className = 'chick idle';
    c.setAttribute('aria-label', 'the chick');
    Object.assign(c.style, { left: `${sp.left}px`, bottom: `${sp.bottom}px` });
    c.innerHTML = chickSVG(carry);
    layer.append(c);
    c.addEventListener('click', () => {
      if (c._dragged) {
        c._dragged = false;
        return;
      }
      if (!c.classList.contains('walk') && !c.classList.contains('run')) void hop(c);
    });
    let x0: number | null = null;
    let dx = 0;
    let dragging = false;
    c.addEventListener('pointerdown', (e) => {
      if (CH.busy || c.classList.contains('walk') || c.classList.contains('run')) return;
      x0 = e.clientX;
      dx = 0;
      dragging = false;
    });
    c.addEventListener('pointermove', (e) => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      if (!dragging && Math.abs(dx) > 8) {
        dragging = true;
        try {
          c.setPointerCapture(e.pointerId);
        } catch {
          /* fine */
        }
        c.classList.add('tilt');
      }
      if (dragging) c.style.transform = `translateX(${dx}px) rotate(${dx * 0.08}deg)`;
    });
    const up = () => {
      if (x0 == null) return;
      x0 = null;
      if (!dragging) return;
      c._dragged = true;
      if (Math.abs(dx) > 56) return void shooChick(Math.sign(dx), dx);
      c.classList.remove('tilt');
      play(c, [{ transform: c.style.transform }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)', keep: false });
      c.style.transform = '';
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    return { c, sp };
  }

  async function walkIn(c: Element, run = false) {
    pose(c, run ? 'run' : 'walk', ...(c.classList.contains('carry') ? ['carry'] : []));
    const d = SW() - parseFloat((c as HTMLElement).style.left) + 30;
    await play(c, [{ transform: `translateX(${d}px)` }, { transform: 'none' }], { duration: run ? 900 : 1500, easing: 'cubic-bezier(.25,.6,.4,1)', keep: false });
  }
  async function walkOff(c: Element, run = false) {
    pose(c, run ? 'run' : 'walk', ...(c.classList.contains('carry') ? ['carry'] : []));
    const d = SW() - parseFloat((c as HTMLElement).style.left) + 40;
    await play(c, [{ transform: 'none' }, { transform: `translateX(${d}px)` }], { duration: run ? 760 : 1300, easing: 'cubic-bezier(.5,0,.75,.4)', keep: false });
    c.remove();
  }
  function bubble(html: string, sp: { bottom: number }) {
    layer.querySelector('.ck-bubble')?.remove();
    const b = document.createElement('div');
    b.className = 'ck-bubble';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'a nudge from the chick');
    b.style.bottom = `${sp.bottom + 100}px`;
    b.innerHTML = `<button class="ckb-x" data-ck="hide" aria-label="hide the chick">${I.close}</button>${html}`;
    layer.append(b);
    play(b, [{ opacity: 0, transform: 'scale(.6) translateY(16px)' }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.34,1.4,.64,1)', keep: false });
    return b;
  }
  async function closeBubble() {
    const b = layer.querySelector('.ck-bubble');
    if (!b) return;
    await play(b, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.8) translateY(10px)' }], { duration: 200 });
    b.remove();
  }

  /* ───────── 1: the nudge when you land ───────── */
  async function nudge(n: ChickNudgeProp) {
    if (CH.busy) return;
    CH.busy = true;
    CH.target = n;
    CH.pending = null;
    const { c, sp } = spawnChick();
    await walkIn(c);
    pose(c, 'idle');
    await hop(c);
    pose(c, 'idle', 'wave');
    const name = esc(n.friend.username);
    bubble(
      `<div class="ckb-who">${avatar(n.friend)}<span>psst, the chick here</span></div>
    <p class="ckb-main">${esc(n.message)}</p>
    <p class="ckb-sub">send ${name} an egg today? it doesn't have to be your day.</p>
    <div class="ckb-btns"><button class="pill yolky" data-ck="send">send an egg</button><button class="pill beige" data-ck="later">not now</button></div>
    <div class="ckb-foot"><button class="ckb-why" data-ck="why">why am i seeing this?</button><button class="ckb-why" data-ck="off">turn off the chick</button></div>`,
      sp,
    );
    setTimeout(() => c.classList.remove('wave'), T(1700));
    CH.busy = false;
  }

  function whySheet(n: ChickNudgeProp) {
    const name = esc(n.friend.username);
    openOv(
      root,
      `<div class="sheet" role="dialog" aria-label="why the chick picked ${name}"><h3>why ${name}?</h3>
    <p class="why-p">every so often the chick suggests a friend from one of your coops, so nobody goes too long without a hello. it doesn't say why, and it never shares anything about them.</p>
    <p class="why-note">nudges are private: ${name} never finds out you were nudged. anyone can switch off "friendly nudges about me" in settings and the chick leaves them out.</p></div>`,
    );
  }

  layer.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-ck]');
    if (!b || CH.busy) return;
    const c = layer.querySelector('.chick');
    const act = b.dataset.ck;
    if (act === 'why') return CH.target ? whySheet(CH.target) : undefined;
    if (act === 'hide') return shooChick(1);
    if (act === 'off') {
      cb.onOff();
      await shooChick(1, 0, true);
      return toast(root, 'the chick will stay away. eggs from friends show up as notifications. you can bring it back in settings', 4200);
    }
    if (!c) return;
    CH.busy = true;
    await closeBubble();
    if (act === 'send') {
      pose(c, 'idle', 'wave');
      await hop(c, 22);
      CH.busy = false;
      layer.innerHTML = '';
      if (CH.target) cb.onSend(CH.target);
      return;
    }
    if (act === 'open') {
      const p = CH.pending;
      CH.pending = null;
      pose(c, 'idle', 'wave');
      void hop(c);
      layer.querySelector('.ck-egg-drop')?.remove();
      await sleep(250);
      CH.busy = false;
      layer.innerHTML = '';
      if (p) cb.onOpen(p);
      return;
    }
    /* not now / in a bit: a curious head tilt, then it waddles off */
    pose(c, 'idle', 'tilt');
    await sleep(900);
    layer.querySelector('.ck-egg-drop')?.remove();
    await walkOff(c);
    CH.busy = false;
    if (CH.pending) toast(root, `${CH.pending.friend.username}'s egg will be here when you come back`);
    else if (CH.target) cb.onDismiss(CH.target);
  });

  /* ───────── 2: you sent the suggested egg: the chick pops up holding it and runs it over ───────── */
  async function carry(p: ChickCarryProp) {
    if (CH.busy) return;
    CH.busy = true;
    const { c } = spawnChick(p.egg);
    c.classList.add('carry');
    await play(c, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'ease-out', keep: false });
    pose(c, 'idle', 'carry');
    await hop(c, 12);
    toast(root, `the chick is taking your egg to ${p.to}`, 2800);
    await walkOff(c, true);
    CH.busy = false;
  }

  /* ───────── 3: someone sent you an egg: the chick brings it ───────── */
  async function delivery(m: ChickMailProp) {
    if (CH.busy) return;
    CH.busy = true;
    CH.pending = m;
    CH.target = null;
    const { c, sp } = spawnChick(m.egg);
    c.classList.add('carry');
    await walkIn(c, true);
    pose(c, 'idle', 'carry');
    /* sets the egg down beside it */
    const drop = document.createElement('div');
    drop.className = 'ck-egg-drop';
    drop.innerHTML = Art.eggSVG(m.egg);
    Object.assign(drop.style, { left: `${sp.left + 4}px`, bottom: `${Math.max(4, sp.bottom - 18)}px` });
    c.querySelector('.ck-held')?.remove();
    layer.append(drop);
    play(drop, [{ transform: 'translate(22px,-40px) scale(.8)', opacity: 0 }, { transform: 'translate(10px,-14px)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 460, easing: 'ease-out', keep: false });
    pose(c, 'idle', 'wave');
    await hop(c);
    bubble(
      `<div class="ckb-who">${avatar(m.friend)}<span>special delivery!</span></div>
    <p class="ckb-main"><b>${esc(m.friend.username)}</b> sent you an egg.</p>
    <div class="ckb-btns"><button class="pill yolky" data-ck="open">open it</button><button class="pill beige" data-ck="later">in a bit</button></div>`,
      sp,
    );
    setTimeout(() => c.classList.remove('wave'), T(1700));
    CH.busy = false;
  }

  /* send the chick away: it scurries off the side it was pushed toward. a waiting egg stays waiting */
  async function shooChick(dir = 1, from = 0, quiet = false) {
    const c = layer.querySelector<HTMLElement>('.chick');
    if (!c) return;
    CH.busy = true;
    void closeBubble();
    layer.querySelector('.ck-egg-drop')?.remove();
    if (CH.target && !CH.pending) cb.onDismiss(CH.target);
    pose(c, 'run');
    const W = SW();
    const left = parseFloat(c.style.left);
    const to = dir > 0 ? W - left + 40 : -(left + 120);
    c.style.transform = '';
    await play(c, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: 620, easing: 'cubic-bezier(.4,0,.8,.5)', keep: false });
    c.remove();
    CH.busy = false;
    if (quiet) return;
    toast(root, CH.pending ? `shoo! ${CH.pending.friend.username}'s egg will wait for you` : 'shoo! the chick will check back tomorrow');
  }

  return {
    nudge,
    delivery,
    carry,
    /** Is the chick (or its bubble) on screen, or moving? */
    isOut: () => CH.busy || layer.children.length > 0,
    closeOv: () => closeOv(root),
    relRect: (el: Element) => relRect(root, el),
  };
}
