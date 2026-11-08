'use dom';

// A5: a coop's photo gallery and the "daily" stack, from the prototype's gallery.js (`renderGallery`,
// `renderDaily`, `lightbox`). One DOM file, both pages: `page` picks which.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { avatar, call, DAYS, esc, hdr, I, lightbox, masonryHTML, MON, MONTHS, OV_HTML, plural, setTop, sideEgg, toast, TOAST_HTML, wireOv, type DomPerson, type DomPhoto } from './ui';

export interface DomAlbum {
  id: string;
  title: string;
  coverUrl: string | null;
  count: number;
}
export interface DomDailyDay {
  day: string;
  by: string | null;
  posted: boolean;
  url: string | null;
  time: string;
  prompt: string;
}

interface Props {
  top: number;
  page: 'gallery' | 'daily';
  coopName: string;
  me: string;
  people: Record<string, DomPerson>;
  photos: DomPhoto[];
  albums: DomAlbum[];
  daily: DomDailyDay[];
  streak: number;
  onBack: () => Promise<void>;
  onAlbum: (id: string) => Promise<void>;
  onAddPhotos: () => Promise<string | null>;
  onAddToday: () => Promise<void>;
  dom?: DOMProps;
}

export default function GalleryPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const { top, page, coopName, me, people, photos, albums, daily, streak } = props;
  const nameOf = (id: string) => people[id]?.username ?? 'friend';
  const shown = daily.filter((d) => d.posted && d.url);
  const bigList: DomPhoto[] = shown.map((d) => ({ url: d.url, by: d.by ?? '', caption: `${d.time}, by ${d.by === me ? 'you' : nameOf(d.by ?? '')}` }));

  function galleryHTML() {
    return `${hdr(esc(coopName), 'gallery')}
    <div class="scroll" id="galScroll">
      ${albums.length ? `<h3 class="sec">event albums</h3><div class="albums">${albums.map((e) => `<button class="album" data-album="${e.id}">
        <div class="a-cover">${e.coverUrl ? `<img src="${esc(e.coverUrl)}" alt="">` : ''}</div>
        <b>${esc(e.title)}</b><small>${plural(e.count, 'post')}</small></button>`).join('')}</div>` : ''}
      <h3 class="sec">all photos<span class="grow"></span><span class="gal-count">${plural(photos.length, 'photo')}</span></h3>
      ${photos.length ? masonryHTML(photos, me, nameOf) : `<div class="empty-note">no photos yet. tap the egg below to add some from your phone.</div>`}
    </div>`;
  }

  function dailyHTML() {
    const today = daily[0];
    const keep = today?.posted ? 'today is in. see you tomorrow!' : today?.by === me ? "it's your day. post today to keep it going" : `${esc(nameOf(today?.by ?? ''))} posts today to keep it going`;
    const cards = daily.map((d, i) => {
      const date = new Date(`${d.day}T12:00:00`);
      const label = i === 0 ? 'today' : i === 1 ? 'yesterday' : DAYS[date.getDay()];
      const has = d.posted;
      const big = shown.indexOf(d);
      const body = has
        ? d.url
          ? `<img src="${esc(d.url)}" alt="">`
          : `<div class="dc-add">${Art.miniEgg()}posted!</div>`
        : i === 0
          ? d.by === me
            ? `<button class="dc-add" data-daily-add>${I.plus}add today's photo</button>`
            : `<div class="dc-add">${Art.miniEgg()}waiting on ${esc(nameOf(d.by ?? ''))}</div>`
          : `<div class="dc-add">no photo this day</div>`;
      return `<article class="dcard"><div class="dc-head"><b>${label}</b><span>${MONTHS[date.getMonth()]} ${date.getDate()}</span></div>
      <div class="photo"${big >= 0 ? ` data-daily-big="${big}" role="button" tabindex="0" aria-label="see it bigger"` : ''}>${body}</div>
      ${has && d.by ? `<div class="pg-by">${avatar(people[d.by] ?? { id: d.by })}<b>${d.by === me ? 'you' : esc(nameOf(d.by))}</b><span>${i === 0 ? esc(d.time) : i === 1 ? 'yesterday' : `${MON[date.getMonth()]} ${date.getDate()}`}</span></div>` : ''}
      <p class="dc-prompt">${esc(d.prompt)}</p></article>`;
    });
    return `${hdr(esc(coopName), 'daily', `<span class="streak" aria-label="${streak} day streak">${Art.miniEgg()}${streak}</span>`)}
    <div class="scroll" id="galScroll"><div class="streak-banner">${Art.miniEgg()}<div><b>${plural(streak, 'day')} in a row</b><small>${keep}</small></div></div>
      <div class="daily-list">${cards.join('')}</div></div>`;
  }

  const html = page === 'gallery' ? galleryHTML() : dailyHTML();

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    wireOv(r);
    if (page === 'gallery') {
      sideEgg(r.querySelector<HTMLElement>('#galEgg')!, {
        label: 'add photos',
        icon: I.plus,
        onTap: () =>
          void latest.current
            .onAddPhotos()
            .catch(() => "those photos didn't upload. try again")
            .then((m) => {
              if (m) toast(r, m);
            }),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const host = root.current?.querySelector<HTMLElement>('#galHost');
    if (!host) return;
    const st = host.querySelector('#galScroll')?.scrollTop ?? 0;
    host.innerHTML = html;
    const sc = host.querySelector('#galScroll');
    if (sc) sc.scrollTop = st;
  }, [html]);

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    if (t.closest('[data-back]')) return call(p.onBack);
    const ph = t.closest<HTMLElement>('[data-ph]');
    if (ph) return lightbox(r, p.photos, Number(ph.dataset.ph), p.me, nameOf);
    const al = t.closest<HTMLElement>('[data-album]');
    if (al) return call(p.onAlbum, al.dataset.album ?? '');
    if (t.closest('[data-daily-add]')) return call(p.onAddToday);
    const big = t.closest<HTMLElement>('[data-daily-big]');
    if (big) lightbox(r, bigList, Number(big.dataset.dailyBig), p.me, nameOf);
  }

  return (
    <section ref={root} className="view on scr" id={page === 'gallery' ? 'v-gallery' : 'v-daily'} onClick={onClick} style={{ overflow: 'hidden' }}>
      <div id="galHost" />
      {page === 'gallery' ? <div className="side-egg" id="galEgg" /> : null}
      <div dangerouslySetInnerHTML={{ __html: OV_HTML }} style={{ display: 'contents' }} />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
