'use dom';

// A5: play! / egg war, ported from the prototype's war.js (`renderPlay`, `renderWar`, `voteHTML`,
// `liveHTML`, `boardHTML`, `feedHTML`, `offHTML`, `overHTML`, the vote tag pop, confetti, toasts).
// The prototype's pretend wars are replaced by Developer B's `egg_war_status`; every action goes back
// to the native side, which calls the RPC and passes the new status down.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import { Art, FLAT } from './art/art';
import './art/art.css';
import { faceId } from './faces';
import { play, T } from './play';

type State = 'vote' | 'live' | 'off' | 'over';
interface BoardRow {
  user_id: string;
  sniper: number;
  sniped: number;
  score: number;
}
export interface WarStatusProp {
  members: number;
  need: number;
  can_start: boolean;
  war: null | {
    id: string;
    state: State;
    started_by: string | null;
    vote_ends_at: string;
    live_ends_at: string | null;
    people: { user_id: string; choice: 'in' | 'out' }[];
    board: BoardRow[];
    snipes: number;
  };
}
export interface WarPerson {
  id: string;
  username: string;
  photoUrl?: string | null;
}
export interface WarSnipe {
  id: string;
  by: string;
  target: string;
  caption: string | null;
  imgUrl: string | null;
  at: string;
}

interface Props {
  mode: 'play' | 'war';
  coopName: string;
  me: string;
  status: WarStatusProp;
  people: WarPerson[];
  snipes: WarSnipe[];
  /** Show the prototype's "demo: skip / end now" links (demo coop only). */
  demo: boolean;
  /** Safe-area top inset. */
  top: number;
  onBack: () => Promise<void>;
  onStart: () => Promise<void>;
  onJoin: () => Promise<void>;
  onLeave: () => Promise<void>;
  onVote: (choice: 'in' | 'out') => Promise<void>;
  onSnipe: () => Promise<void>;
  onSkip: () => Promise<void>;
  onDeleteSnipe: (id: string) => Promise<void>;
  /** "start a new egg war" from the results. */
  onAgain: () => Promise<void>;
  dom?: DOMProps;
}

const CSS = `
  .war-root { position: absolute; inset: 0; background: var(--bg); overflow: hidden; }
  .av { display: inline-block; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex: none; }
  .toast { position: absolute; top: calc(var(--top) + 8px); left: 50%; z-index: 95; padding: 9px 18px; border-radius: 999px;
    background: var(--ink); color: #fff; font: 500 14px/1.3 var(--f-body); transform: translate(-50%, -140%); opacity: 0;
    transition: transform .45s var(--ease-out), opacity .3s; white-space: nowrap; pointer-events: none; }
  .toast.on { transform: translate(-50%, 0); opacity: 1; }
  .leave-link { display: block; margin: 18px auto 0; font: 500 13px/1 var(--f-body); color: var(--ink-3); text-decoration: underline; }
  .sn-del { position: absolute; left: 10px; top: 10px; width: 34px; height: 34px; border-radius: 50%; background: rgba(255,255,255,.9); display: grid; place-items: center; }
  .sn-del svg { width: 18px; height: 18px; }
`;

const esc = (t: unknown) => Art.esc(t);
const pad2 = (n: number) => String(n).padStart(2, '0');
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
function countdownText(end: number, short?: boolean) {
  const ms = Math.max(0, end - Date.now());
  const h = Math.floor(ms / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const s = Math.floor((ms % 6e4) / 1000);
  return short ? (h ? `${h}h ${m}m` : `${m}m`) : `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
const daysLeft = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 864e5));
function daysLeftText(end: number) {
  const d = (end - Date.now()) / 864e5;
  if (d <= 0) return 'over';
  return d < 1 ? `${plural(Math.max(1, Math.ceil(d * 24)), 'hour')} left` : `${plural(Math.ceil(d), 'day')} left`;
}
function agoText(iso: string) {
  const m = (Date.now() - Date.parse(iso)) / 6e4;
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  return h < 24 ? `${plural(Math.round(h), 'hour')} ago` : h < 48 ? 'yesterday' : `${Math.floor(h / 24)} days ago`;
}
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
function OL(c = FLAT.line, w = 1.5) {
  return `stroke="${c}" stroke-width="${w}" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"`;
}

/* paint splats for the landing page (war.js `splat`) */
function splat(color: string, seed: number, size = 120) {
  const R = Art.rng(seed);
  const c = size / 2;
  const N = 22;
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.283;
    const arm = i % 2 ? 0.62 + R() * 0.16 : 0.8 + R() * 0.34;
    pts.push(`${f1(c + Math.cos(a) * size * 0.34 * arm)},${f1(c + Math.sin(a) * size * 0.34 * arm)}`);
  }
  let drops = '';
  for (let i = 0; i < 5; i++) {
    const a = R() * 6.283;
    const d = size * (0.42 + R() * 0.12);
    drops += `<circle cx="${f1(c + Math.cos(a) * d)}" cy="${f1(c + Math.sin(a) * d)}" r="${f1(2 + R() * 4.5)}"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" overflow="visible" aria-hidden="true" fill="${color}"><path d="M${pts.join('L')}Z" stroke="${color}" stroke-width="${f1(size * 0.07)}" stroke-linejoin="round"/>${drops}</svg>`;
}

function warEgg(top: string, yolkInner: string, yolkBtn = '') {
  return `<div class="war-egg"><svg viewBox="0 0 300 196" aria-hidden="true">${Art.albumen(150, 98, 90, { seed: 64, amp: 0.06, sx: 1.6, sy: 1.04, n: 18 })}
      <circle cx="150" cy="114" r="54" fill="${FLAT.yolk}"/></svg>
    <span class="we-top">${top}</span>${yolkBtn ? yolkBtn : `<div class="we-yolk">${yolkInner}</div>`}</div>`;
}

export default function EggWarView(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const [tab, setTab] = useState<'board' | 'feed'>('board');
  const [allBoard, setAllBoard] = useState(false);
  const prevState = useRef<State | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    latest.current = props;
  });

  const { mode, coopName, me, status, people, snipes, demo, top } = props;
  const w = status.war;
  const active = w && (w.state === 'vote' || w.state === 'live') ? w : null;
  const person = (id: string) => people.find((p) => p.id === id);
  const un = (id: string) => person(id)?.username ?? 'friend';
  const avatar = (id: string) => `<span class="av">${Art.faceSVG(faceId(person(id) ?? { id }))}</span>`;
  const tag = (id: string) => `<span class="wtag${id === me ? ' me' : ''}">@${esc(un(id))}</span>`;
  const hdr = (title: string, sub = '') =>
    `<header class="hdr"><button class="icon-btn" data-back aria-label="back">${Art.I.back}</button>
    <div class="hdr-t">${title ? `<b>${title}</b>` : ''}${sub ? `<span>${sub}</span>` : ''}</div><div class="hdr-r"></div></header>`;

  function boardHTML(rows: BoardRow[], all: boolean) {
    const list = all ? rows : rows.slice(0, 3);
    return `<div class="lb" role="table" aria-label="leaderboard">
      <div class="lb-r lb-h" role="row"><span></span><span></span><span></span><span>sniper</span><span>sniped</span><span>score</span></div>
      ${list
        .map(
          (r, i) => `<div class="lb-r${r.user_id === me ? ' me' : ''}" role="row"><span class="lb-rank r${i + 1}">${i + 1}</span>${avatar(r.user_id)}<b>@${esc(un(r.user_id))}</b>
        <span class="n good">${r.sniper}</span><span class="n bad">${r.sniped}</span><span class="n score${r.score < 0 ? ' neg' : ''}">${signed(r.score)}</span></div>`,
        )
        .join('')}
    </div>${!all && rows.length > 3 ? `<button class="lb-more" data-lb-all>see everyone (${rows.length})${Art.I.right}</button>` : ''}
    ${all ? '' : `<p class="war-note">sniper: how many times you egged someone. sniped: how many times you got egged. score is sniper minus sniped, so it can go below zero.</p>`}`;
  }

  function feedHTML() {
    if (!snipes.length) return `<div class="empty-note">no snipes yet. tap the yolk and catch someone off guard.</div>`;
    return `<div class="feed-list">${snipes
      .map(
        (s, i) => `<article class="snipe${i === 0 && Date.now() - Date.parse(s.at) < 60_000 ? ' fresh' : ''}">
      <div class="sn-photo">${s.imgUrl ? `<img src="${s.imgUrl}" alt="">` : Art.talkScene(faceId({ id: s.target }), 'kitchen')}
        <span class="sn-tag">@${esc(un(s.target))} got sniped by @${esc(un(s.by))}</span>
        ${s.by === me || s.target === me ? `<button class="sn-del" data-sn-del="${s.id}" aria-label="take this snipe down">${Art.I.trash}</button>` : ''}</div>
      ${s.caption ? `<p class="sn-cap">${esc(s.caption)}</p>` : ''}<span class="sn-time">${agoText(s.at)}</span></article>`,
      )
      .join('')}</div>`;
  }

  function playHTML() {
    const few = status.members < 3;
    const sub = active
      ? active.state === 'vote'
        ? `@${esc(un(active.started_by ?? ''))} started one. ${countdownText(Date.parse(active.vote_ends_at), true)} left to opt in.`
        : `the war is on, ${daysLeftText(Date.parse(active.live_ends_at ?? ''))}.`
      : few
        ? 'you need at least 3 people in the coop for an egg war.'
        : `everyone in ${esc(coopName)} gets 24 hours to opt in. if more than half say yes, the war begins.`;
    return `${hdr(esc(coopName), 'play!')}
    <div class="play-stage">
      <div class="splat s1">${splat('#F2AE3D', 3)}</div><div class="splat s2">${splat('#F7C766', 9, 90)}</div>
      <div class="splat s3">${splat('#E2614A', 7)}</div><div class="splat s4">${splat('#E98A6E', 13, 80)}</div>
      <div class="play-egg">
        <svg viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true"><path d="${Art.EGG}" fill="#fff" ${OL()}/></svg>
        <div class="pe-in"><h2>${active ? 'join<br>egg war' : 'initiate<br>egg war'}</h2><p>${sub}</p>
          <div class="pe-btns"><button class="pill yolky" data-play-go ${few && !active ? 'disabled' : ''}>${active ? 'join' : "let's go"}</button>
          <button class="pill beige" data-back>not now</button></div></div>
      </div>
    </div>`;
  }

  function warHTML() {
    if (!w) return `${hdr(esc(coopName), 'egg war')}<div class="scroll war-scroll"><div class="empty-note">no egg war right now.</div></div>`;
    const ins = w.people.filter((p) => p.choice === 'in').map((p) => p.user_id);
    const outs = w.people.filter((p) => p.choice === 'out').map((p) => p.user_id);
    let body = '';
    if (w.state === 'vote') {
      const undecided = people.map((p) => p.id).filter((id) => !ins.includes(id) && !outs.includes(id));
      body = `${warEgg('the countdown begins', `<b id="weTimer">${countdownText(Date.parse(w.vote_ends_at))}</b><small>left to opt in</small>`)}
      <div class="war-need"><div class="wn-dots">${people.map((_, i) => `<i class="${i < ins.length ? 'on' : ''}"></i>`).join('')}</div>
        <span>${ins.length} of ${status.members} in. ${ins.length >= status.need ? "that's enough to start!" : `needs ${status.need} to start.`}</span></div>
      <div class="vote-boxes">
        <button class="vbox in${ins.includes(me) ? ' mine' : ''}" data-vote="in" aria-pressed="${ins.includes(me)}"><b>${ins.includes(me) ? Art.I.check : ''}opted in</b><div class="vb-tags">${ins.map(tag).join('') || '<em>no one yet</em>'}</div></button>
        <button class="vbox out${outs.includes(me) ? ' mine' : ''}" data-vote="out" aria-pressed="${outs.includes(me)}"><b>${outs.includes(me) ? Art.I.check : ''}opted out</b><div class="vb-tags">${outs.map(tag).join('') || '<em>no one yet</em>'}</div></button>
      </div>
      ${undecided.length ? `<p class="war-wait">still deciding: ${undecided.map(tag).join(' ')}</p>` : ''}
      <p class="war-note">tap a box to put yourself in it. when the countdown ends, the war starts if more than half the coop opted in. if not, it's called off and everyone who opted in gets a heads-up.</p>
      ${demo ? '<button class="demo-link" data-war-skip>demo: skip to the end of the countdown</button>' : ''}`;
    } else if (w.state === 'live') {
      const inIt = ins.includes(me);
      const n = daysLeft(Date.parse(w.live_ends_at ?? ''));
      const yolk = inIt
        ? `<button class="we-yolk cam" data-snipe aria-label="take a snipe photo">${Art.I.camera}<b>EGG</b></button>`
        : `<button class="we-yolk cam" data-war-join aria-label="join the egg war"><b>join</b></button>`;
      body = `${warEgg(`<span class="we-n">${n}</span>${n === 1 ? 'day' : 'days'} left...`, '', yolk)}
      ${inIt ? '' : `<p class="war-note" style="text-align:center;margin-top:0">you opted out of this one. tap the yolk to join.</p>`}
      <div class="war-tabs" role="tablist"><button role="tab" data-wtab="board" aria-selected="${tab === 'board'}">leaderboard</button><button role="tab" data-wtab="feed" aria-selected="${tab === 'feed'}">feed</button></div>
      <div class="war-panel">${tab === 'board' ? boardHTML(w.board, allBoard) : feedHTML()}</div>
      ${inIt ? '<button class="leave-link" data-war-leave>opt out of this war</button>' : ''}
      ${demo ? '<button class="demo-link" data-war-skip>demo: end the war now</button>' : ''}`;
    } else if (w.state === 'off') {
      body = `<div class="peace">${warEgg('', `<span class="wo-flag">${Art.I.flag}</span>`)}
        <h2>they chose peace.</h2><p class="peace-big">so should you.</p>
        <p class="war-note">only ${ins.length} of ${status.members} opted in, and it takes more than half. you and everyone who opted in got a heads-up that it was called off.</p>
        <button class="pill solid" data-back>back to ${esc(coopName)}</button></div>`;
    } else {
      const top1 = w.board[0];
      body = `<div class="war-over">${warEgg('the war is over!', `<span class="wo-trophy">${Art.I.trophy}</span>`)}
        ${top1 ? `<h2>@${esc(un(top1.user_id))} wins</h2><p class="war-need" style="justify-content:center"><span>with a score of ${signed(top1.score)} after ${plural(w.snipes, 'snipe')}</span></p>` : ''}
        <h3 class="sec">final leaderboard</h3>${boardHTML(w.board, true)}
        <p class="war-note">the feed is cleared when a war ends.</p>
        ${status.can_start ? '<button class="pill yolky" data-war-again>start a new egg war</button>' : ''}</div>`;
    }
    return `${hdr(esc(coopName), 'egg war')}<div class="scroll war-scroll" id="warScroll">${body}</div>`;
  }

  // Render on every change, keeping the scroll position (renderWar's `st`).
  const html = mode === 'play' ? playHTML() : warHTML();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty('--top', `${top}px`);
    const st = el.querySelector('#warScroll')?.scrollTop ?? 0;
    const view = el.querySelector<HTMLElement>('.war-view')!;
    const first = !view.innerHTML;
    view.innerHTML = html;
    const sc = el.querySelector('#warScroll');
    if (sc) sc.scrollTop = st;
    if (first && mode === 'play') {
      play(el.querySelector('.play-egg'), [{ transform: 'scale(.9) rotate(-3deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)', keep: false });
      el.querySelectorAll('.splat').forEach((s, i) => play(s, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'none' }], { duration: 480, delay: 120 + i * 70, keep: false }));
    }
  }, [html, mode, top]);

  function toast(msg: string) {
    const t = root.current?.querySelector('.toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('on');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => t.classList.remove('on'), 2600);
  }

  function confettiBurst(n = 64) {
    const el = root.current;
    if (!el) return;
    const W = el.clientWidth;
    const H = el.clientHeight;
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
      el.append(c);
      play(c, [{ transform: `translate(0,0) rotate(${rot}deg)` }, { transform: `translate(${dx}px, ${H + 40}px) rotate(${rot + 520}deg)` }], {
        duration: 1700 + Math.random() * 1400,
        delay: Math.random() * 450,
        easing: 'cubic-bezier(.25,.6,.45,1)',
        keep: false,
      }).then(() => c.remove());
    }
  }

  // The vote → live moment gets the prototype's confetti.
  useEffect(() => {
    const s = w?.state ?? null;
    if (prevState.current === 'vote' && s === 'live') confettiBurst(50);
    prevState.current = s;
  }, [w?.state]);

  // Countdown ticks (tickWar), without re-rendering the whole page.
  useEffect(() => {
    if (w?.state !== 'vote') return;
    const id = setInterval(() => {
      const t = root.current?.querySelector('#weTimer');
      if (t) t.textContent = countdownText(Date.parse(w.vote_ends_at));
    }, 1000);
    return () => clearInterval(id);
  }, [w?.state, w?.vote_ends_at]);

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const p = latest.current;
    const call = (f: () => Promise<void>) => void f().catch(() => {});
    if (t.closest('[data-back]')) return call(p.onBack);
    if (t.closest('[data-play-go]')) {
      if (!active) return call(p.onStart);
      return call(p.onJoin);
    }
    const v = t.closest<HTMLElement>('[data-vote]');
    if (v && w?.state === 'vote') {
      const side = v.dataset.vote as 'in' | 'out';
      call(() => p.onVote(side));
      // the prototype's tag pop, once the new status renders
      setTimeout(() => {
        play(root.current?.querySelector(`.vbox.${side} .wtag.me`), [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'none' }], { duration: 420, keep: false });
      }, T(350));
      return;
    }
    if (t.closest('[data-war-skip]')) return call(p.onSkip);
    if (t.closest('[data-war-again]')) return call(p.onAgain);
    if (t.closest('[data-war-join]')) {
      toast("you're in. watch your back");
      return call(p.onJoin);
    }
    if (t.closest('[data-war-leave]')) {
      toast("you're out. nobody can egg you now");
      return call(p.onLeave);
    }
    const tb = t.closest<HTMLElement>('[data-wtab]');
    if (tb) return setTab(tb.dataset.wtab as 'board' | 'feed');
    if (t.closest('[data-lb-all]')) return setAllBoard(true);
    const del = t.closest<HTMLElement>('[data-sn-del]');
    if (del) return call(() => p.onDeleteSnipe(del.dataset.snDel ?? ''));
    if (t.closest('[data-snipe]')) return call(p.onSnipe);
  }

  return (
    <div ref={root} className="war-root" onClick={onClick}>
      <style>{CSS}</style>
      <section className={mode === 'play' ? 'war-view' : 'war-view'} id={mode === 'play' ? 'v-play' : 'v-war'} />
      <div className="toast" role="status" />
    </div>
  );
}
