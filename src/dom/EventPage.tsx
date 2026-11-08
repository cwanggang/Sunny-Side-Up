'use dom';

// A5: one event, from the prototype's events.js (`renderEvent`, `detailsHTML`, `chatHTML`, `chatBarHTML`,
// `openTimer`, `peopleHTML`, `evGalHTML`). The pretend friends who answer in the prototype's chat are gone:
// this is the real chat. Our events have a start but no end time, so that row is left out.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import './art/art.css';
import { avatar, call, closeOv, DAYS, esc, fmtClock, fmtShort, hdr, I, lightbox, masonryHTML, MONTHS, openOv, OV_HTML, plural, setTop, toast, TOAST_HTML, wireOv, type DomPhoto } from './ui';

export interface DomEventPerson {
  id: string;
  username: string;
  photoUrl: string | null;
  role: 'edit' | 'view' | 'comment';
  lead: boolean;
  out: boolean;
  inCoop: boolean;
}

interface Props {
  top: number;
  me: string;
  coopName: string;
  title: string;
  location: string | null;
  description: string | null;
  startsAt: string;
  past: boolean;
  chat: boolean;
  chatOpen: boolean;
  chatClosesAt: string;
  chatDays: number;
  gallery: boolean;
  people: DomEventPerson[];
  messages: { id: string; by: string; text: string }[];
  photos: DomPhoto[];
  tab: string;
  lengths: { days: number; label: string }[];
  onBack: () => Promise<void>;
  onOpt: (out: boolean) => Promise<void>;
  onSend: (text: string) => Promise<void>;
  onTimer: (days: number) => Promise<void>;
  onRole: (id: string, role: 'edit' | 'view' | 'comment') => Promise<void>;
  onAddGuest: (id: string) => Promise<void>;
  onAddPhotos: () => Promise<string | null>;
  dom?: DOMProps;
}

function relWhen(d: Date) {
  const h = (d.getTime() - Date.now()) / 36e5;
  if (h < 1) return 'in under an hour';
  if (h < 24) return `in ${plural(Math.round(h), 'hour')}`;
  const n = Math.round(h / 24);
  return n === 1 ? 'tomorrow' : `in ${n} days`;
}

export default function EventPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const [tab, setTab] = useState(props.tab);
  useEffect(() => {
    latest.current = props;
  });
  const { top, me, coopName, title, location, description, startsAt, past, chat, chatOpen, chatClosesAt, gallery, people, messages, photos } = props;

  const person = (id: string) => people.find((p) => p.id === id);
  const un = (id: string) => person(id)?.username ?? 'friend';
  const av = (id: string) => avatar({ id, photoUrl: person(id)?.photoUrl });
  const mine = person(me);
  const out = !!mine?.out;
  const iLead = !!mine?.lead;
  const going = people.filter((p) => !p.out);
  const leads = people.filter((p) => p.lead);
  const start = new Date(startsAt);
  const ends = new Date(chatClosesAt);

  const detailsHTML = () => `<dl class="kv">
    <div><dt>date</dt><dd>${DAYS[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}</dd></div>
    <div><dt>starts</dt><dd>${fmtClock(start)}</dd></div>
    <div><dt>location</dt><dd>${esc(location || 'not set yet')}</dd></div>
    <div><dt>people</dt><dd><div class="av-stack">${going.slice(0, 6).map((p) => av(p.id)).join('')}<em>${going.length} going</em></div></dd></div>
    ${description ? `<div><dt>description</dt><dd>${esc(description)}</dd></div>` : ''}
    <div><dt>event lead</dt><dd>${leads.map((l) => `<span class="handle-l">@${esc(l.username)}</span>`).join('')}</dd></div>
    <div><dt>you</dt><dd>${iLead ? 'lead this event' : mine ? `can ${mine.role}` : 'can view'}</dd></div>
    <div><dt>chat</dt><dd>${!chat ? 'off for this event' : chatOpen ? `open until ${fmtShort(ends)}` : 'closed'}</dd></div>
  </dl>`;

  const msgHTML = (m: { by: string; text: string }) =>
    m.by === me
      ? `<div class="msg me"><div class="bub">${esc(m.text)}</div></div>`
      : `<div class="msg">${av(m.by)}<div class="bub"><span class="who">${esc(un(m.by))}</span>${esc(m.text)}</div></div>`;

  const chatHTML = () => {
    if (!chat) return `<div class="empty-note">the chat is off for this event.</div>`;
    const when = chatOpen ? `temporary chat. it closes ${relWhen(ends)}, on ${fmtShort(ends)} at ${fmtClock(ends)}.` : `this chat closed on ${fmtShort(ends)}. you can still read it.`;
    return `<div class="chat-top"><div class="chat-ttl${chatOpen ? '' : ' closed'}">${chatOpen ? I.clock : I.lock}<span>${when}</span></div>
    <div class="chat-row2"><div class="av-stack">${going.slice(0, 5).map((p) => av(p.id)).join('')}<em>${plural(going.length, 'person', 'people')} in this chat</em></div>
      ${chatOpen && iLead ? `<button class="chip" data-timer>${I.clock}set timer</button>` : ''}</div>
    ${chatOpen && !iLead ? `<small style="font:400 11.5px/1.35 var(--f-body);color:var(--ink-3)">only ${leads.map((l) => `@${esc(l.username)}`).join(' and ')} can change how long it stays open</small>` : ''}
  </div><div class="msgs" id="msgs">${messages.length ? messages.map(msgHTML).join('') : `<p class="day-hint">no messages yet. say hi!</p>`}</div>`;
  };

  const peopleHTML = () => `<div class="ppl">${people
    .map((p) => {
      const role = p.lead
        ? `<span class="role lead">lead</span>`
        : `<button class="role" ${iLead ? `data-role="${p.id}"` : 'disabled'} aria-label="${esc(p.username)} can ${p.role}${iLead ? ', tap to change' : ''}">can ${p.role}</button>`;
      return `<div class="ppl-row${p.out ? ' out' : ''}">${av(p.id)}<div class="pp-t"><b>${p.id === me ? 'you' : esc(p.username)}</b>
      <small>${p.out ? 'opted out' : p.inCoop ? 'going' : `not in ${esc(coopName)} yet`}</small></div>
      ${!p.inCoop ? `<button class="add-g" data-addg="${p.id}">add to coop</button>` : ''}${role}</div>`;
    })
    .join('')}</div>
  <p class="ppl-note">${iLead ? 'you lead this event, so you can tap a role to change it. ' : ''}people who came but aren't in ${esc(coopName || 'the coop')} can be added to it after the event.</p>`;

  const galHTML = () => {
    if (!gallery) return `<div class="empty-note">the gallery is off for this event.</div>`;
    return `<div class="sec" style="margin-top:2px"><span class="gal-count">${plural(photos.length, 'photo')}</span><span class="grow"></span>
      <button class="chip on" data-addph>${I.plus}add photos</button></div>
    ${photos.length ? masonryHTML(photos, me, un) : `<div class="empty-note">no photos yet. add the first ones!</div>`}`;
  };

  const panel = tab === 'chat' ? chatHTML() : tab === 'people' ? peopleHTML() : tab === 'gallery' ? galHTML() : detailsHTML();
  const head = `${hdr(esc(coopName), 'event')}
    <div class="evd-head" id="evdHead"><h2 class="display">${esc(title)}</h2>
      ${past ? `<p class="g-kicker" style="margin-top:8px">this event already happened</p>` : mine ? `<button class="optout${out ? ' back-in' : ''}" data-opt>${out ? 'you opted out. rejoin?' : '× opt out'}</button>` : `<button class="optout back-in" data-opt>join this event</button>`}
      <div class="tabs" role="tablist">${['details', 'chat', 'people', 'gallery'].map((t) => `<button role="tab" aria-selected="${tab === t}" data-tab="${t}">${t}</button>`).join('')}</div></div>`;

  const barState = tab !== 'chat' || !chat ? 'none' : !chatOpen ? 'closed' : !mine || out ? 'left' : 'open';

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    wireOv(r);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    r.querySelector('#evdTop')!.innerHTML = head;
    const p = r.querySelector<HTMLElement>('#evdPanel')!;
    const h = r.querySelector<HTMLElement>('#evdHead')!;
    p.style.top = `${h.offsetTop + h.offsetHeight}px`;
  }, [head]);

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const p = r.querySelector<HTMLElement>('#evdPanel')!;
    const st = p.scrollTop;
    p.classList.toggle('chat-mode', tab === 'chat');
    p.innerHTML = panel;
    p.scrollTop = tab === 'chat' ? p.scrollHeight : st;
  }, [panel, tab]);

  async function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    if (t.closest('[data-back]')) return call(p.onBack);
    const tb = t.closest<HTMLElement>('[data-tab]');
    if (tb) return setTab(tb.dataset.tab ?? 'details');
    if (t.closest('[data-opt]')) {
      // not on the event yet: this is "join" (the server adds you as a viewer)
      if (!mine) {
        toast(r, `you joined ${title}`);
        return call(p.onOpt, false);
      }
      toast(r, out ? `you're back in for ${title}` : `you opted out of ${title}`);
      return call(p.onOpt, !out);
    }
    if (t.closest('[data-timer]')) {
      const sh = openOv(
        r,
        `<div class="sheet" role="dialog" aria-label="chat timer"><h3>how long should the chat stay open?</h3>
    <p class="g-kicker" style="text-align:left;margin:-6px 0 14px">only event leads can change this. everyone in the chat sees when it closes.</p>
    <div class="opt-list">${p.lengths.map((l) => `<button data-v="${l.days}" aria-pressed="${p.chatDays === l.days}">${l.label}${p.chatDays === l.days ? I.check : ''}</button>`).join('')}</div></div>`,
      );
      return sh.addEventListener('click', (ev) => {
        const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-v]');
        if (!b) return;
        void closeOv(r);
        call(latest.current.onTimer, Number(b.dataset.v));
      });
    }
    const role = t.closest<HTMLElement>('[data-role]');
    if (role) {
      const who = person(role.dataset.role ?? '');
      if (!who) return;
      const order = ['edit', 'view', 'comment'] as const;
      return call(p.onRole, who.id, order[(order.indexOf(who.role) + 1) % 3]);
    }
    const a = t.closest<HTMLElement>('[data-addg]');
    if (a) {
      toast(r, `${un(a.dataset.addg ?? '')} joined ${coopName}`);
      return call(p.onAddGuest, a.dataset.addg ?? '');
    }
    if (t.closest('[data-addph]')) {
      const done = await p.onAddPhotos().catch(() => "those photos didn't upload. try again");
      if (done) toast(r, done);
      return;
    }
    const ph = t.closest<HTMLElement>('[data-ph]');
    if (ph) lightbox(r, photos, Number(ph.dataset.ph), me, un);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inp = root.current?.querySelector<HTMLInputElement>('#chatIn');
    const text = inp?.value.trim();
    if (!inp || !text) return;
    inp.value = '';
    void latest.current.onSend(text).catch((x: unknown) => toast(root.current!, x instanceof Error ? x.message.toLowerCase() : "that didn't send"));
  }

  return (
    <section ref={root} className="view on scr" id="v-event" onClick={(e) => void onClick(e)} style={{ overflow: 'hidden' }}>
      <div id="evdTop" />
      <div className="evd-panel" id="evdPanel" />
      {barState === 'open' ? (
        <form className="chat-bar" onSubmit={onSubmit}>
          <input id="chatIn" placeholder="type here..." autoComplete="off" maxLength={300} aria-label="message" />
          <button aria-label="send" dangerouslySetInnerHTML={{ __html: I.send }} />
        </form>
      ) : barState === 'closed' ? (
        <div className="chat-bar closed">this chat is closed</div>
      ) : barState === 'left' ? (
        <div className="chat-bar closed">{out ? "you opted out, so you've left this chat" : "you're not on this event"}</div>
      ) : null}
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
