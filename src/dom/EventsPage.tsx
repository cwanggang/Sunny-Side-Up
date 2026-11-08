'use dom';

// A5: upcoming events and the month calendar, from the prototype's events.js (`renderEvents`, `evRow`,
// `calHTML`, `dayHTML`, `optEgg`, `toggleOut`). `coopId` null is the calendar across all coops.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import { Art, FLAT } from './art/art';
import './art/art.css';
import { play } from './play';
import { call, DAYS, DOW, esc, fmtClock, fmtShort, hdr, I, MONTHS, plural, setTop, sideEgg, toast, TOAST_HTML } from './ui';

export interface DomEvent {
  id: string;
  circleId: string;
  title: string;
  location: string | null;
  startsAt: string;
  past: boolean;
  chat: boolean;
  chatOpen: boolean;
  gallery: boolean;
  out: boolean;
  /** On the event's people list (false: a coop event you were never added to; "join" adds you). */
  invited: boolean;
  going: number;
  unread: boolean;
}

interface Props {
  top: number;
  title: string;
  sub: string;
  coopId: string | null;
  coopNames: Record<string, string>;
  events: DomEvent[];
  onBack: () => Promise<void>;
  onOpen: (id: string, tab: string) => Promise<void>;
  onOpt: (id: string, out: boolean) => Promise<void>;
  onNew: () => Promise<void>;
  dom?: DOMProps;
}

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/* the opt-out button: a whole egg while you're going, a cracked one once you've opted out */
function optEgg(out: boolean) {
  const egg = 'M13 1.5C19.5 1.5 24.5 13 24.5 20.5S19.5 32.5 13 32.5 1.5 28 1.5 20.5 6.5 1.5 13 1.5Z';
  if (!out) return `<svg viewBox="0 0 26 34" aria-hidden="true"><path d="${egg}" fill="#fff" stroke="${FLAT.line}" stroke-width="1.4"/></svg>`;
  const a = Art.uid('oe');
  const b = Art.uid('oe');
  const zig = '1,19 5,22 9,18 13,22 17,18 21,22 25,19';
  return `<svg viewBox="0 0 26 34" aria-hidden="true"><defs>
      <clipPath id="${a}"><polygon points="-2,-2 28,-2 28,19 ${zig.split(' ').reverse().join(' ')} -2,19"/></clipPath>
      <clipPath id="${b}"><polygon points="-2,19 ${zig} 28,19 28,36 -2,36"/></clipPath></defs>
    <ellipse cx="13" cy="23" rx="7" ry="3.4" fill="${FLAT.yolk}"/>
    <g transform="translate(-3 -6) rotate(-22 13 18)"><path d="${egg}" fill="#fff" stroke="${FLAT.line}" stroke-width="1.4" clip-path="url(#${a})"/><polyline points="${zig}" fill="none" stroke="${FLAT.line}" stroke-width="1.2" stroke-linejoin="round"/></g>
    <g transform="translate(0 2)"><path d="${egg}" fill="#fff" stroke="${FLAT.line}" stroke-width="1.4" clip-path="url(#${b})"/><polyline points="${zig}" fill="none" stroke="${FLAT.line}" stroke-width="1.2" stroke-linejoin="round"/></g></svg>`;
}

export default function EventsPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    latest.current = props;
  });
  const { top, title, sub, coopId, coopNames, events } = props;

  const evRow = (e: DomEvent) => {
    const start = new Date(e.startsAt);
    const subLine = e.out ? (e.invited ? 'you opted out' : 'not on your list yet') : coopId ? (e.location ?? '') : (coopNames[e.circleId] ?? '');
    const optLabel = e.out ? (e.invited ? 'rejoin' : 'join') : 'opt out';
    return `<div class="ev-row${e.out ? ' out' : ''}" data-row="${e.id}">
    <button class="ev-opt" data-opt="${e.id}" aria-label="${e.out ? optLabel : 'opt out of'} ${esc(e.title)}">${optEgg(e.out)}<small>${optLabel}</small></button>
    <button class="ev-main" data-open-ev="${e.id}"><b>${esc(e.title)}</b><small>${esc(subLine)}</small></button>
    <div class="ev-when"><span>${fmtShort(start)}</span><span>${fmtClock(start)}</span></div>
    ${e.chat ? `<button class="ev-chat${e.chatOpen ? '' : ' closed'}" data-chat="${e.id}" aria-label="open the chat for ${esc(e.title)}">${I.chat}${e.chatOpen && e.unread && !e.out ? '<i></i>' : ''}</button>` : '<span style="width:40px"></span>'}
  </div>`;
  };

  const calHTML = () => {
    const y = month.getFullYear();
    const mo = month.getMonth();
    const first = new Date(y, mo, 1).getDay();
    const days = new Date(y, mo + 1, 0).getDate();
    const now = new Date();
    const today = ymd(now);
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let cells = DOW.map((d) => `<span class="dow">${d[0]}</span>`).join('') + '<span></span>'.repeat(first);
    for (let d = 1; d <= days; d++) {
      const date = new Date(y, mo, d);
      const key = ymd(date);
      const n = events.filter((e) => ymd(new Date(e.startsAt)) === key).length;
      cells += `<button class="cd${key === today ? ' today' : ''}${day === key ? ' sel' : ''}${date < startToday ? ' past' : ''}" data-day="${key}"
      aria-label="${MONTHS[mo]} ${d}${n ? `, ${plural(n, 'event')}` : ''}">${d}${n ? '<i></i>' : ''}</button>`;
    }
    return `<div class="cal-head"><button data-cal="-1" aria-label="previous month">${I.left}</button><b>${MONTHS[mo]} ${y}</b>
    <button data-cal="1" aria-label="next month">${I.right}</button></div><div class="cal-grid">${cells}</div>`;
  };

  const dayHTML = () => {
    if (!day) return `<p class="day-hint">tap a day to look back at past events, their chats and photos, or ahead at what's coming</p>`;
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const label = `${DAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}`;
    const evs = events.filter((e) => ymd(new Date(e.startsAt)) === day);
    if (!evs.length) return `<div class="day-list"><p class="day-hint">nothing on ${label}</p></div>`;
    return `<div class="day-list">${evs
      .map((e) => {
        const status = e.past ? 'this already happened' : e.out ? (e.invited ? 'you opted out' : 'not on your list yet') : `${e.going} going`;
        return `<div class="day-card"><b>${esc(e.title)}</b><small>${label}, ${fmtClock(new Date(e.startsAt))}${coopId ? '' : `, ${esc(coopNames[e.circleId] ?? '')}`}</small><small>${status}</small>
      <div class="chips"><button class="chip" data-open-ev="${e.id}">details</button>
      ${e.chat ? `<button class="chip" data-chat="${e.id}">${e.chatOpen ? I.chat : I.lock}${e.chatOpen ? 'chat' : 'past chat'}</button>` : ''}
      ${e.gallery ? `<button class="chip" data-gal-ev="${e.id}">${I.gallery}photos</button>` : ''}</div></div>`;
      })
      .join('')}</div>`;
  };

  const up = events.filter((e) => !e.past).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const html = `${hdr(esc(title), esc(sub))}
    <div class="scroll" id="evScroll">
      <h3 class="sec">upcoming ${Art.miniEgg()}</h3>
      <div class="ev-list">${up.length ? up.map(evRow).join('') : `<div class="empty-note">nothing planned yet. tap the egg below to start something.</div>`}</div>
      <h3 class="sec">calendar</h3>
      <div class="cal" id="cal">${calHTML()}</div>
      <div id="calDay">${dayHTML()}</div>
    </div>`;

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    const host = r.querySelector<HTMLElement>('#evHost')!;
    const st = host.querySelector('#evScroll')?.scrollTop ?? 0;
    host.innerHTML = html;
    const sc = host.querySelector('#evScroll');
    if (sc) sc.scrollTop = st;
  }, [html, top]);

  useEffect(() => {
    const egg = root.current?.querySelector<HTMLElement>('#evEgg');
    if (egg) sideEgg(egg, { label: 'create event', icon: I.plus, onTap: () => call(latest.current.onNew) });
  }, []);

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const p = latest.current;
    if (t.closest('[data-back]')) return call(p.onBack);
    const opt = t.closest<HTMLElement>('[data-opt]');
    if (opt) {
      const ev = p.events.find((x) => x.id === opt.dataset.opt);
      if (!ev) return;
      toast(root.current!, ev.out ? (ev.invited ? `you're back in for ${ev.title}` : `you joined ${ev.title}`) : `you opted out of ${ev.title}`);
      play(opt.querySelector('svg'), [{ transform: 'scale(1)' }, { transform: 'scale(1.18) rotate(-8deg)' }, { transform: 'scale(.95) rotate(4deg)' }, { transform: 'none' }], { duration: 420, keep: false });
      return call(p.onOpt, ev.id, !ev.out);
    }
    const o = t.closest<HTMLElement>('[data-open-ev]');
    if (o) return call(p.onOpen, o.dataset.openEv ?? '', 'details');
    const c = t.closest<HTMLElement>('[data-chat]');
    if (c) return call(p.onOpen, c.dataset.chat ?? '', 'chat');
    const gl = t.closest<HTMLElement>('[data-gal-ev]');
    if (gl) return call(p.onOpen, gl.dataset.galEv ?? '', 'gallery');
    const m = t.closest<HTMLElement>('[data-cal]');
    if (m) return setMonth(new Date(month.getFullYear(), month.getMonth() + Number(m.dataset.cal), 1));
    const dd = t.closest<HTMLElement>('[data-day]');
    if (dd) setDay(day === dd.dataset.day ? null : (dd.dataset.day ?? null));
  }

  return (
    <section ref={root} className="view on scr" id="v-events" onClick={onClick} style={{ overflow: 'hidden' }}>
      <div id="evHost" />
      <div className="side-egg" id="evEgg" />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
