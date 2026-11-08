'use dom';

// A5: a friend's egg, from the prototype's profile.js (`openMember`, `crackMember`, `memberCardHTML`): one tap
// cracks it, the halves part, and the profile sits between them.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art, OL } from './art/art';
import './art/art.css';
import { faceId } from './faces';
import { play, sleep } from './play';
import { call, esc, I, lightbox, OV_HTML, pxs, relRect, setTop, wireOv } from './ui';

interface Props {
  top: number;
  isMe: boolean;
  coopName: string | null;
  person: { id: string; username: string; name: string; birthday: string | null; photoUrl: string | null; egg: { swatch: string; pattern: string }; facts: { k: string; v: string }[] };
  mutual: { id: string; name: string }[];
  onClose: () => Promise<void>;
  onCoop: (id: string) => Promise<void>;
  dom?: DOMProps;
}

const COLOR_WORDS: Record<string, string> = { 'tomato red': '#E5533D', 'sky blue': '#7DB8E8', 'forest green': '#3F7F55', 'burnt orange': '#CC6A2C', sage: '#A8B98F', lilac: '#C8A8E9', teal: '#3BA59B', navy: '#2D3E6B', magenta: '#C9409A', aqua: '#5ECFD0', gold: '#D4A537', olive: '#8A8F3C', lavender: '#B9A7E6' };
function colorOf(word: string) {
  const w = word.toLowerCase().trim();
  if (COLOR_WORDS[w]) return COLOR_WORDS[w];
  return window.CSS?.supports?.('color', w) ? w : null;
}
const CRACK_Y = 66; /* where the zigzag sits in the egg drawing (out of 130) */
const CRACK_PTS = [[3, 70], [13, 62], [22, 72], [33, 61], [44, 72], [55, 61], [66, 71], [77, 61], [87, 70], [97, 63]];
const EDGE_L = [5.7, 67.85];
const EDGE_R = [93.7, 65.3]; /* where the shell's outline crosses the crack, left and right */
const fmtBday = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric' }).toLowerCase();

export default function MemberPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const st = useRef({ busy: false, open: false });
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const p = latest.current;
    setTop(r, p.top);
    wireOv(r);
    r.querySelector('#mbMain')!.innerHTML = `<button class="icon-btn mb-close" id="mbClose" data-back aria-label="close">${I.close}</button>
    <div class="mb-stage" id="mbStage"><p class="mb-from">${p.isMe ? 'your egg, the way friends see it' : p.coopName ? `${esc(p.person.username)} in ${esc(p.coopName)}` : esc(p.person.username)}</p>
      <button class="mb-egg idle" id="mbEgg" aria-label="crack ${p.isMe ? 'your' : `${esc(p.person.username)}'s`} egg">${Art.eggSVG({ ...p.person.egg, text: p.person.username, ty: 96 })}</button>
      <p class="mb-hint" id="mbHint">tap to crack</p></div>
    <div class="mb-body" id="mbBody" hidden></div><div class="mb-shells" id="mbShells"></div>`;
  }, []);

  function memberCardHTML() {
    const { person: m, isMe, mutual } = latest.current;
    return `<div class="mb-in" id="mbIn">
      <button class="mb-pic" data-full aria-label="see the photo">${Art.faceSVG(faceId(m))}</button>
      <h2 class="mb-name">${esc(m.name || m.username)}</h2><p class="mono" style="margin:6px 0 0">@${esc(m.username)}</p>
      ${m.birthday ? `<p class="mb-bday">${I.cake}${fmtBday(m.birthday)}</p>` : ''}
      <div class="mb-block"><span>${isMe ? 'your coops' : 'mutual coops'}</span><div class="chips">${mutual.map((g) => `<button class="chip" data-coop="${g.id}">${esc(g.name)}</button>`).join('') || '<span class="chip ghost">none yet</span>'}</div></div>
      <dl class="mb-facts">${m.facts
        .map((f) => {
          const c = f.k === 'favorite color' ? colorOf(f.v) : null;
          return `<div><dt>${esc(f.k)}</dt><dd>${c ? `<i style="background:${c}"></i>` : ''}${esc(f.v)}</dd></div>`;
        })
        .join('')}</dl>
    </div><div class="mb-more" id="mbMore" hidden>${I.down}</div>`;
  }

  async function crack() {
    const r = root.current!;
    const S = st.current;
    if (S.busy || S.open) return;
    S.busy = true;
    const $ = <E extends Element = HTMLElement>(s: string) => r.querySelector<E>(s)!;
    const egg = $('#mbEgg');
    const p = latest.current.person;
    const W = r.clientWidth;
    const H = r.clientHeight;
    const top0 = latest.current.top;
    egg.classList.remove('idle');
    /* the crack runs across while the egg gives a little squash */
    play(egg, [{ transform: 'none' }, { transform: 'scale(1.05,.94)' }, { transform: 'scale(.99,1.01)' }, { transform: 'none' }], { duration: 300, easing: 'ease-out', keep: false });
    egg.querySelectorAll('.crack').forEach((c, i) => play(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: i ? 150 : 230, delay: i ? 110 : 0, easing: 'ease-out' }));
    play($('#mbHint'), [{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
    play($('.mb-from'), [{ opacity: 1 }, { opacity: 0 }], { duration: 180 });
    await sleep(290);
    /* final layout: the top half caps the screen, the bottom half cups it, the profile fills the space between */
    const b = relRect(r, egg);
    const Wf = Math.min(W - 28, 420);
    const s = Wf / 100;
    const left = (W - Wf) / 2;
    const capY = top0 + 66;
    const cupY = H - 86;
    const crack0 = b.y + (CRACK_Y * b.h) / 130;
    const capTop = capY - CRACK_Y * s;
    const cupTop = cupY - CRACK_Y * s;
    const shells = $('#mbShells');
    shells.innerHTML = Art.eggSVG({ ...p.egg, shine: 0.28 }, 'top', 'mb-cap') + Art.eggSVG({ ...p.egg, shine: 0.28 }, 'bottom', 'mb-cup');
    const [cap, cup] = Array.from(shells.querySelectorAll('svg'));
    Object.assign(cap.style, pxs({ left, top: capTop, width: Wf, height: 130 * s }));
    Object.assign(cup.style, pxs({ left, top: cupTop, width: Wf, height: 130 * s }));
    /* the inside of the egg: its sides continue the shell's outline exactly where it meets the crack,
       and its fill follows both zigzags, so nothing pokes past the shell */
    const body = $('#mbBody');
    const bl = left + EDGE_L[0] * s;
    const bw = (EDGE_R[0] - EDGE_L[0]) * s;
    const bt = capTop + 60 * s;
    const bb = cupTop + 73 * s;
    const X = (u: number) => Art.f1((u - EDGE_L[0]) * s);
    const Yc = (u: number) => Art.f1(capTop + u * s - bt);
    const Yb = (u: number) => Art.f1(cupTop + u * s - bt);
    const zig = [[EDGE_L[0], EDGE_L[1]], ...CRACK_PTS.slice(1, -1), [EDGE_R[0], EDGE_R[1]]];
    const fill = `M${zig.map(([x, y]) => `${X(x)},${Yc(y)}`).join('L')}L${[...zig].reverse().map(([x, y]) => `${X(x)},${Yb(y)}`).join('L')}Z`;
    body.innerHTML =
      `<svg class="mb-inside" width="${Art.f1(bw)}" height="${Art.f1(bb - bt)}" overflow="visible" aria-hidden="true">
      <path d="${fill}" fill="rgba(255,255,255,.58)"/>
      <line x1="0" y1="${Yc(EDGE_L[1])}" x2="0" y2="${Yb(EDGE_L[1])}" ${OL()}/>
      <line x1="${Art.f1(bw)}" y1="${Yc(EDGE_R[1])}" x2="${Art.f1(bw)}" y2="${Yb(EDGE_R[1])}" ${OL()}/></svg>` + memberCardHTML();
    Object.assign(body.style, pxs({ left: bl, width: bw, top: bt, height: bb - bt }));
    const inn = $('#mbIn');
    Object.assign(inn.style, { paddingTop: `${Math.round(12 * s + 16)}px`, paddingBottom: `${Math.round(12 * s + 20)}px` });
    body.hidden = false;
    egg.style.visibility = 'hidden';
    /* both halves start exactly where the egg was and travel to their spots */
    const k0 = b.w / Wf;
    const dx = b.x - left;
    const ease = 'cubic-bezier(.65,0,.25,1)';
    const dur = 780;
    play(cap, [{ transform: `translate(${dx}px, ${b.y - capTop}px) scale(${k0})` }, { transform: `translate(${dx}px, ${b.y - capTop - 24}px) scale(${k0}) rotate(-4deg)`, offset: 0.18 }, { transform: 'none' }], { duration: dur, easing: ease, keep: false });
    play(cup, [{ transform: `translate(${dx}px, ${b.y - cupTop}px) scale(${k0})` }, { transform: `translate(${dx}px, ${b.y - cupTop + 10}px) scale(${k0})`, offset: 0.18 }, { transform: 'none' }], { duration: dur, easing: ease, keep: false });
    const ew = b.w * 0.88;
    const ins = Math.max(0, (bw - ew) / 2);
    const t0 = Math.max(0, crack0 - bt);
    const b0 = Math.max(0, bb - crack0);
    play(body, [{ clipPath: `inset(${t0}px ${ins}px ${b0}px ${ins}px)` }, { clipPath: `inset(${t0}px ${ins}px ${b0}px ${ins}px)`, offset: 0.14 }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: dur, easing: ease, keep: false });
    $('#mbClose').style.display = 'none';
    const more = $('#mbMore');
    inn.style.opacity = '0';
    await sleep(dur * 0.62);
    $('#mbStage').style.display = 'none';
    play(inn, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420 });
    await sleep(dur * 0.4);
    shells.insertAdjacentHTML('beforeend', `<button class="icon-btn mb-x" data-back aria-label="close profile" style="left:${Math.round(bl + 10)}px;top:${Math.round(capTop + 72 * s + 8)}px">${I.close}</button>`);
    play($('.mb-x'), [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    const check = () => {
      more.hidden = inn.scrollTop + inn.clientHeight >= inn.scrollHeight - 12;
    };
    check();
    inn.addEventListener('scroll', check, { passive: true });
    S.busy = false;
    S.open = true;
  }

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const p = latest.current;
    if (t.closest('[data-back]')) return call(p.onClose);
    if (t.closest('#mbEgg')) return void crack();
    const c = t.closest<HTMLElement>('[data-coop]');
    if (c) return call(p.onCoop, c.dataset.coop ?? '');
    if (t.closest('[data-full]') && p.person.photoUrl) {
      lightbox(root.current!, [{ url: p.person.photoUrl, by: p.person.id, caption: `${p.person.username}'s photo` }], 0, '', () => '');
    }
  }

  return (
    <section ref={root} className="view on" id="v-member" onClick={onClick} style={{ overflow: 'hidden', background: 'var(--bg)' }}>
      <div id="mbMain" style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
