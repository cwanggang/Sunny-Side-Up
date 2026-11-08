'use dom';

// A5: the camera and "sent" pages, from the prototype's app.js (`setupCameraChrome`, `prepareCamera`,
// `cameraEntrance`, `showShot`, `sendPhoto`, `buildSent`). The viewfinder itself is the native camera behind
// this web view: everything here is see-through where the picture shows.
//   photo    today's photo: the "to:" pill, the prompt, send, then the sent page
//   respond  a photo for your person or a friend: "next" goes on to decorate it
//   snipe    egg war: "next" goes on to who you got
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef, useState } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { play, sleep } from './play';
import { burst, call, esc, I, relRect, setTop, toast, TOAST_HTML, avatar, type DomPerson } from './ui';

export interface CameraTarget {
  id: string;
  name: string;
  posted: boolean;
}

interface Props {
  top: number;
  mode: 'photo' | 'respond' | 'snipe';
  /** The "to:" pill for respond / snipe. */
  fixedLabel: string;
  promptLabel: string;
  prompt: string;
  targets: CameraTarget[];
  start: string | null;
  /** The camera is available (false: the egg opens the phone's own camera). */
  live: boolean | null;
  me: DomPerson | null;
  past: { url: string; by: DomPerson; when: string }[];
  noteNames: string;
  /** Called with where the viewfinder square sits, so the native camera lines up under it. */
  onFrame: (f: { x: number; y: number; size: number }) => Promise<void>;
  onClose: () => Promise<void>;
  onFlip: () => Promise<void>;
  onShutter: () => Promise<string | null>;
  onLibrary: () => Promise<string | null>;
  onRetake: () => Promise<void>;
  /** photo: post it. Resolves when saved; rejects with why not. */
  onSend: (targetId: string) => Promise<void>;
  /** respond / snipe: go on to the next screen with this shot. */
  onNext: () => Promise<void>;
  onHome: () => Promise<void>;
  dom?: DOMProps;
}

const SENT_SLOTS = ['none', 'translate(10px,8px) rotate(4deg)', 'translate(-12px,12px) rotate(-5deg)'];
const CSS = `
  #v-camera { background: transparent; }
  html, body { background: transparent; }
  #v-camera .vf { background: transparent; }
  .cam-frame { position: absolute; inset: 0; pointer-events: none; }
`;

export default function CameraPage(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const [targetId, setTargetId] = useState<string | null>(props.start);
  const [shot, setShot] = useState<string | null>(null);
  const [toOpen, setToOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    latest.current = props;
  });
  const { top, mode, fixedLabel, promptLabel, prompt, targets, live, me, past, noteNames } = props;
  const open = targets.filter((t) => !t.posted);
  const target = targets.find((t) => t.id === targetId) ?? open[0] ?? targets[0] ?? null;

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    const $ = (s: string) => r.querySelector<HTMLElement>(s)!;
    $('#camClose').innerHTML = I.close;
    $('#camFlip').innerHTML = I.flip;
    $('#camGallery').innerHTML = I.gallery;
    $('#shutter').innerHTML = Art.friedEgg({ w: 108, h: 96, r: 40, seed: 31, amp: 0.12, sx: 1.08, sy: 0.98, yr: 17, cls: 'sh-egg' });
    // Line the native camera up with the square, then bring everything in (cameraEntrance).
    const f = relRect(r, $('#vf'));
    call(latest.current.onFrame, { x: f.x, y: f.y, size: f.w });
    const vfBottom = f.y + f.h;
    const ctlTop = r.clientHeight - 34 - 96;
    const pr = $('#camPrompt');
    pr.style.top = `${Math.max(vfBottom + 20, vfBottom + (ctlTop - vfBottom - pr.offsetHeight) / 2)}px`;
    [$('.cam-top'), $('#vf'), pr, $('#camLive')].forEach((el, i) =>
      play(el, [{ opacity: 0, transform: i === 1 ? 'scale(.94)' : 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 60 + i * 60, easing: 'cubic-bezier(.22,1,.36,1)', keep: false }),
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The prompt's height changes with its text.
  useEffect(() => {
    const r = root.current;
    if (!r) return;
    const pr = r.querySelector<HTMLElement>('#camPrompt')!;
    const f = relRect(r, r.querySelector('#vf')!);
    const vfBottom = f.y + f.h;
    const ctlTop = r.clientHeight - 34 - 96;
    pr.style.top = `${Math.max(vfBottom + 20, vfBottom + (ctlTop - vfBottom - pr.offsetHeight) / 2)}px`;
  }, [prompt]);

  function flash() {
    play(root.current?.querySelector('#vfFlash'), [{ opacity: 0 }, { opacity: 0.95, offset: 0.15 }, { opacity: 0 }], { duration: 480, easing: 'ease-out', keep: false });
    play(root.current?.querySelector('#vf'), [{ transform: 'scale(1)' }, { transform: 'scale(.985)', offset: 0.2 }, { transform: 'scale(1)' }], { duration: 360, keep: false });
  }

  async function take(f: () => Promise<string | null>) {
    const r = root.current!;
    if (busy.current || shot) return;
    busy.current = true;
    try {
      const url = await f();
      if (url) {
        flash();
        setShot(url);
        r.querySelectorAll('.cam-controls.review .pill').forEach((b, i) => play(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 60, keep: false }));
      }
    } catch (e) {
      toast(r, e instanceof Error ? e.message.toLowerCase() : "the camera didn't open", 3600);
    }
    busy.current = false;
  }

  /* sendPhoto(): the shot flies from the viewfinder onto the top of the coop's stack */
  async function sendPhoto() {
    const r = root.current!;
    if (!target || !shot || busy.current) return;
    busy.current = true;
    try {
      await latest.current.onSend(target.id);
    } catch (e) {
      busy.current = false;
      return toast(r, e instanceof Error ? e.message.toLowerCase() : "that didn't send, try again", 3200);
    }
    const vf = relRect(r, r.querySelector('#vf')!);
    setSent(true);
    await sleep(30);
    const sentTop = r.querySelector<HTMLElement>('#sentTop')!;
    const tR = relRect(r, sentTop);
    const pad = 12;
    const s0 = vf.w / (tR.w - pad * 2);
    const x0 = vf.x - pad * s0;
    const y0 = vf.y - pad * s0;
    const fx = r.querySelector<HTMLElement>('.fx')!;
    const fly = document.createElement('div');
    fly.className = 'fly-card';
    fly.style.width = `${tR.w}px`;
    fly.style.height = `${tR.h}px`;
    fly.innerHTML = sentTop.outerHTML.replace('id="sentTop"', '');
    const fc = fly.firstElementChild as HTMLElement;
    fc.style.cssText = 'position:absolute;inset:0;transform:none';
    fx.append(fly);
    sentTop.style.opacity = '0';
    const faded = [r.querySelector('#sentNote'), r.querySelector('.sent-actions'), r.querySelector('.sent-head')] as HTMLElement[];
    faded.forEach((el) => (el.style.opacity = '0'));
    const under = Array.from(r.querySelectorAll<HTMLElement>('#sentStack .card:not(#sentTop)'));
    under.forEach((c, i) => {
      c.dataset.slot = SENT_SLOTS[i + 1];
      c.style.transform = SENT_SLOTS[i];
    });
    play(fc, [{ backgroundColor: 'rgba(255,255,255,0)' }, { backgroundColor: 'rgba(255,255,255,1)' }], { duration: 500, delay: 200, keep: false });
    play(fc.querySelector('.pg-by'), [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 420, keep: false });
    play(fc.querySelector('.photo'), [{ borderRadius: '32px' }, { borderRadius: '10px' }], { duration: 700, keep: false });
    await play(
      fly,
      [
        { transform: `translate(${x0}px, ${y0}px) scale(${s0}) rotate(0deg)` },
        { transform: `translate(${(x0 + tR.x) / 2 + 14}px, ${Math.min(y0, tR.y) - 26}px) scale(${(s0 + 1) / 2 + 0.04}) rotate(-6deg)`, offset: 0.5 },
        { transform: `translate(${tR.x}px, ${tR.y}px) scale(1) rotate(0deg)` },
      ],
      { duration: 900, easing: 'cubic-bezier(.5,0,.2,1)', keep: false },
    );
    sentTop.style.opacity = '1';
    fly.remove();
    under.forEach((c) => {
      c.style.transition = 'transform .6s cubic-bezier(.34,1.56,.64,1)';
      c.style.transform = c.dataset.slot ?? '';
    });
    play(sentTop, [{ transform: 'scale(1.04,.96)' }, { transform: 'scale(.99,1.01)', offset: 0.5 }, { transform: 'none' }], { duration: 500, keep: false });
    faded.reverse().forEach((el, i) => {
      el.style.opacity = '';
      play(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 120 + i * 120, keep: false });
    });
    burst(r, tR.x + tR.w / 2, tR.y + 10, 14);
    busy.current = false;
  }

  function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const p = latest.current;
    if (!t.closest('.to-wrap') && toOpen) setToOpen(false);
    if (t.closest('#camClose')) return call(p.onClose);
    if (t.closest('#toPill') && mode === 'photo') return setToOpen(!toOpen);
    const to = t.closest<HTMLButtonElement>('[data-to]');
    if (to && !to.disabled) {
      setTargetId(to.dataset.to ?? null);
      return setToOpen(false);
    }
    if (t.closest('#shutter')) {
      play(root.current?.querySelector('#shutter .sh-egg'), [{ transform: 'scale(1)' }, { transform: 'scale(1.08,.9)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 320, keep: false });
      return void take(p.onShutter);
    }
    if (t.closest('#camGallery')) return void take(p.onLibrary);
    if (t.closest('#camFlip')) {
      play(root.current?.querySelector('#camFlip svg'), [{ transform: 'rotate(0)' }, { transform: 'rotate(180deg)' }], { duration: 360, keep: false });
      return call(p.onFlip);
    }
    if (t.closest('#camRetake')) {
      setShot(null);
      return call(p.onRetake);
    }
    if (t.closest('#camSend')) {
      if (mode === 'photo') return void sendPhoto();
      return call(p.onNext);
    }
    if (t.closest('#sentHome')) return call(p.onHome);
    if (t.closest('#sentMore')) {
      setShot(null);
      setSent(false);
      setTargetId(open.find((x) => x.id !== target?.id)?.id ?? null);
      return call(p.onRetake);
    }
  }

  const more = sent ? open.find((x) => x.id !== target?.id) : null;

  return (
    <div ref={root} onClick={onClick} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <style>{CSS}</style>
      <section className="view on" id="v-camera" style={{ visibility: sent ? 'hidden' : undefined }}>
        <header className="cam-top">
          <button className="cam-icon" id="camClose" aria-label="close camera" />
          <div className="to-wrap">
            <button
              className={`to-pill${mode === 'photo' ? '' : ' fixed'}${toOpen ? ' open' : ''}`}
              id="toPill"
              dangerouslySetInnerHTML={{ __html: mode === 'photo' ? `to: <b>${esc(target?.name ?? '')}</b>${targets.length > 1 ? I.chev : ''}` : fixedLabel }}
            />
            <div
              className={`to-menu${toOpen ? ' open' : ''}`}
              role="menu"
              dangerouslySetInnerHTML={{
                __html: `<span class="mono">your day in</span>${targets
                  .map(
                    (g) =>
                      `<button role="menuitem" data-to="${g.id}" ${g.posted ? 'disabled' : ''}>${Art.miniEgg()}<span>${esc(g.name)}</span>${g.posted ? '<em>sent</em>' : g.id === target?.id ? `<em>${I.check.replace('<svg', '<svg width="14" height="14"')}</em>` : ''}</button>`,
                  )
                  .join('')}`,
              }}
            />
          </div>
          <span style={{ width: 42 }} />
        </header>
        <div className="vf" id="vf">
          {live === false && !shot ? (
            <div className="vf-scene" style={{ background: '#262F4A' }} dangerouslySetInnerHTML={{ __html: `<div class="vf-empty">${I.camera}<p>tap the egg to open your camera</p></div>` }} />
          ) : null}
          {shot ? (
            <div className="vf-photo">
              <img src={shot} alt="your photo" />
            </div>
          ) : (
            <div className="vf-brackets">
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
          <span className="vf-chip">1:1</span>
          <div className="vf-flash" id="vfFlash" />
        </div>
        <div className="cam-prompt" id="camPrompt">
          <span className="mono">{promptLabel}</span>
          <p>{prompt}</p>
        </div>
        <div className="cam-controls" id="camLive" hidden={!!shot}>
          <button className="cam-side" id="camGallery" aria-label="choose from your photos" />
          <button className="shutter" id="shutter" aria-label="take a photo" />
          <button className="cam-side" id="camFlip" aria-label="flip camera" />
        </div>
        <div className="cam-controls review" hidden={!shot}>
          <button className="pill ghost" id="camRetake" dangerouslySetInnerHTML={{ __html: `${I.retake}<span>retake</span>` }} />
          <button className="pill solid" id="camSend" dangerouslySetInnerHTML={{ __html: mode === 'photo' ? `<span>send</span>${I.send}` : `<span>next</span>${I.right}` }} />
        </div>
      </section>
      {sent ? (
        <section className="view on" id="v-sent">
          <div className="sent-head">
            <span className="mono">sent to</span>
            <h2 className="display">{target?.name}</h2>
          </div>
          <div
            className="sent-stack"
            id="sentStack"
            dangerouslySetInnerHTML={{
              __html: `${past
                .slice(0, 2)
                .map(
                  (x, i) =>
                    `<div class="card" style="transform:${SENT_SLOTS[i + 1]};z-index:${2 - i}"><div class="photo"><img src="${esc(x.url)}" alt=""></div><div class="pg-by">${avatar(x.by)}<b>${esc(x.by.username)}</b><span>${esc(x.when)}</span></div></div>`,
                )
                .join('')}<div class="card" id="sentTop" style="z-index:3"><div class="photo"><img src="${esc(shot ?? '')}" alt=""></div><div class="pg-by">${me ? avatar(me) : ''}<b>you</b><span>just now</span></div></div>`,
            }}
          />
          <p className="sent-note" id="sentNote">
            {noteNames} can see it now. it stays on top of the stack until tomorrow&apos;s rotation.
          </p>
          <div className="sent-actions">
            <button className="pill solid" id="sentHome" dangerouslySetInnerHTML={{ __html: `${I.replay}<span>back to home</span>` }} />
            {more ? <button className="pill ghost" id="sentMore" dangerouslySetInnerHTML={{ __html: `<span>also send to ${esc(more.name)}</span>${I.right}` }} /> : null}
          </div>
        </section>
      ) : null}
      <div className="fx" />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </div>
  );
}
