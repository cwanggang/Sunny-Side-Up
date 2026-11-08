'use dom';

// A5: a coop's carton page, from the prototype's coop.js (`renderGroup`, `toggleLid`, `warPill`). The tap
// targets for the screens the prototype doesn't have (feed, birthdays, hangouts ...) sit in a "more" sheet.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { CT } from './carton';
import { faceId } from './faces';
import { play, T } from './play';
import { call, confettiBurst, esc, hdr, I, openOv, closeOv, OV_HTML, plural, setTop, TOAST_HTML, wireOv, type DomPerson } from './ui';

interface Props {
  top: number;
  name: string;
  code: string;
  description: string | null;
  me: DomPerson | null;
  members: string[];
  people: Record<string, { username: string; egg: { swatch: string; pattern: string } }>;
  war: { state: 'vote' | 'live'; text: string; inIt: boolean } | null;
  welcome: boolean;
  onBack: () => Promise<void>;
  onMember: (id: string) => Promise<void>;
  onProfile: () => Promise<void>;
  onNav: (to: string) => Promise<void>;
  onInvite: () => Promise<void>;
  onSnipe: () => Promise<void>;
  onLeave: () => Promise<void>;
  dom?: DOMProps;
}

const MORE: [string, string, string][] = [
  ['spotlight', "today's photo", 'camera'],
  ['feed', 'feed', 'chat'],
  ['compose', 'send something', 'send'],
  ['sunday', 'sunny sunday', 'sun'],
  ['birthdays', 'birthdays and moments', 'cake'],
  ['hangouts', 'hangout ideas', 'sparkle'],
];

export default function CoopPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const { top, me, name, war, description, welcome } = props;

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    wireOv(r);
    if (welcome) setTimeout(() => confettiBurst(r), T(420));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* profile corner (drawProfileCorner) */
  useEffect(() => {
    const r = root.current;
    if (!r || !me) return;
    const W = r.clientWidth;
    const H = r.clientHeight;
    const svg = r.querySelector('#gpEgg')!;
    const h = r.querySelector<HTMLElement>('#gpHandle')!;
    const btn = r.querySelector<HTMLElement>('#gpBtn')!;
    const fx = W - 50;
    const fy = top + 24;
    const fr = 22;
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    h.textContent = `@${me.username}`;
    Object.assign(h.style, { left: `${fx}px`, top: `${fy + fr + 9}px` });
    const hw = h.offsetWidth / 2 + 4;
    const hy0 = fy + fr + 7;
    const hy1 = fy + fr + 11 + h.offsetHeight;
    const pts = [[fx - fr, fy - fr], [fx + fr, fy - fr], [fx - fr, fy + fr], [fx + fr, fy + fr], [fx - hw, hy0], [fx + hw, hy0], [fx - hw, hy1], [fx + hw, hy1]];
    const o = { seed: 17, amp: 0.1, sx: 1.05, n: 16 };
    const ccx = W - 6;
    const ccy = top - 16;
    svg.innerHTML = `${Art.albumen(ccx, ccy, Art.fitR(ccx, ccy, pts, o, 12), o)}<g>${Art.faceG(faceId(me), fx, fy, fr)}</g>`;
    Object.assign(btn.style, { left: `${fx - 34}px`, top: `${fy - 30}px`, width: '68px', height: `${hy1 - fy + 34}px` });
  }, [me?.id, me?.username, me?.photoUrl, top]); // eslint-disable-line react-hooks/exhaustive-deps

  /* the carton */
  const key = JSON.stringify([props.name, props.code, props.me?.id, props.members, props.people]);
  useEffect(() => {
    const host = root.current?.querySelector<HTMLElement>('#carton');
    const p = latest.current;
    if (!host || !p.members.length) return;
    CT.mount(host, { name: p.name, code: p.code, me: p.me?.id ?? '', members: p.members, people: p.people });
  }, [key]);

  async function toggleLid() {
    const r = root.current!;
    if (CT.isBusy()) return;
    const under = r.querySelector<HTMLElement>('#gUnder')!;
    const inv = r.querySelector<HTMLElement>('#gInvite')!;
    if (!CT.isClosed()) play(under, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    else play(inv, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
    const shut = await CT.toggle();
    under.hidden = shut;
    inv.hidden = !shut;
    play(shut ? inv : under, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 360 });
  }

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    if (t.closest('[data-back]')) return call(p.onBack);
    if (t.closest('[data-copy]')) return call(p.onInvite);
    if (t.closest('[data-snipe]')) return call(p.onSnipe);
    if (t.closest('[data-war]')) return call(p.onNav, 'war');
    if (t.closest('[data-lid], [data-invite]') || (CT.isClosed() && t.closest('#carton svg'))) return void toggleLid();
    const m = t.closest<HTMLElement>('[data-member]');
    if (m) {
      play(m.querySelector('.ct-sprite'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(5deg)' }, { transform: 'none' }], { duration: 320, keep: false });
      const id = m.getAttribute('data-member') ?? '';
      return void setTimeout(() => call(latest.current.onMember, id), T(200));
    }
    if (t.closest('#gpBtn')) return call(p.onProfile);
    const n = t.closest<HTMLElement>('[data-gnav]');
    if (n) return call(p.onNav, n.dataset.gnav ?? '');
    if (t.closest('[data-more]')) {
      const sh = openOv(
        r,
        `<div class="sheet" role="dialog" aria-label="more"><h3>${esc(p.name)}</h3>
        <div class="opt-list">${MORE.map(([k, l]) => `<button data-to="${k}">${l}${I.right}</button>`).join('')}<button data-leave style="color:var(--red)">leave this coop</button></div></div>`,
      );
      sh.addEventListener('click', (ev) => {
        const x = ev.target as HTMLElement;
        const to = x.closest<HTMLElement>('[data-to]');
        if (to) {
          void closeOv(r);
          call(latest.current.onNav, to.dataset.to ?? '');
        } else if (x.closest('[data-leave]')) {
          const box = openOv(
            r,
            `<div class="confirm" role="alertdialog"><span class="cf-ic">${Art.miniEgg()}</span>
            <h3>are you sure you want to leave the coop?</h3><p>you will need a code to rejoin.</p>
            <div class="cf-btns"><button class="cf-cancel" data-ov-close>cancel</button><button class="cf-leave" id="cfLeave">leave</button></div></div>`,
          );
          box.querySelector('#cfLeave')!.addEventListener('click', () => {
            void closeOv(r);
            call(latest.current.onLeave);
          });
        }
      });
    }
  }

  const pill = !war
    ? `<p class="g-kicker">${plural(props.members.length, 'egg')} in this coop</p>`
    : war.state === 'vote'
      ? `<button class="war-pill" data-war>${Art.I.target}<span>egg war vote: <b>${esc(war.text)}</b> left to opt in</span></button>`
      : `<button class="war-pill live" data-war>${Art.I.target}<span>egg war: <b>${esc(war.text)}</b></span>${war.inIt ? '<span class="wp-egg" data-snipe>EGG</span>' : ''}</button>`;

  return (
    <section ref={root} className="view on scr" id="v-group" onClick={onClick} style={{ overflow: 'hidden' }}>
      <div dangerouslySetInnerHTML={{ __html: hdr('', '') }} style={{ display: 'contents' }} />
      <div className="g-top-r">
        <svg className="cw" id="gpEgg" aria-hidden="true" />
        <span className="handle" id="gpHandle" />
        <button className="corner-hit" id="gpBtn" aria-label="your profile" />
      </div>
      <div className="g-body">
        <div dangerouslySetInnerHTML={{ __html: pill }} style={{ display: 'contents' }} />
        <div className="carton" id="carton" />
        <div className="g-under" id="gUnder">
          {description ? <p className="g-desc">{description}</p> : null}
          <button className="ckb-why" data-more>
            more
          </button>
        </div>
        <div className="g-under g-invite" id="gInvite" hidden>
          <button className="copy-btn" data-copy dangerouslySetInnerHTML={{ __html: `${I.send}share invite` }} />
          <small>tap the carton to open it again</small>
        </div>
      </div>
      <nav className="g-nav" aria-label={name}>
        <button data-gnav="events">events</button>
        <button data-gnav="gallery">gallery</button>
        <button data-gnav="daily">daily</button>
        <button data-gnav="play">play!</button>
      </nav>
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
