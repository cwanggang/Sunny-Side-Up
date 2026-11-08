'use dom';

// A5: "pick one:" and the voice memo, from the prototype's sunday.js (`startRespond`, `setupVoice`,
// `voiceRecord`, `voiceStop`, `voicePlay`) and chick.js (`startNudgeEgg`). The recording happens natively; the
// bars move with the prototype's own stand-in level, as they do there when no meter is available. Our second
// option is a photo, not a video (the rest of the app, and the reveal, carry photos and voice memos).
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { play } from './play';
import { avatar, call, closeOv, esc, I, openOv, setTop, toast, TOAST_HTML, wireOv, yolkExpand, type DomPerson, type YolkMorph } from './ui';

const BARS = 34;
const fmtS = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  top: number;
  barTitle: string;
  whoLabel: string;
  who: DomPerson;
  coopName: string;
  promptLabel: string;
  prompt: string;
  gift: boolean;
  focused: boolean;
  onBack: () => Promise<void>;
  /** "take a photo": the yolk swells into the camera. */
  onPhoto: () => Promise<void>;
  /** "choose from your photos": the native picker, then decorate. Without it, photo goes straight to the camera. */
  onLibrary?: () => Promise<void>;
  /** Offer a voice memo too (default true). Today's photo is photo-only. */
  voice?: boolean;
  onRecord: () => Promise<void>;
  onStop: () => Promise<void>;
  onListen: () => Promise<void>;
  onAgain: () => Promise<void>;
  onDecorate: () => Promise<void>;
  dom?: DOMProps;
}

export default function PickPage(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const morph = useRef<YolkMorph | null>(null);
  const voice = useRef({ state: 'idle' as 'idle' | 'rec' | 'done' | 'play', t0: 0, raf: 0, amps: [] as number[], dur: 0, ripT: 0, playT0: 0 });
  useEffect(() => {
    latest.current = props;
  });
  const { top, barTitle, whoLabel, who, promptLabel, prompt, gift, focused } = props;

  const $ = <E extends Element = HTMLElement>(s: string) => root.current!.querySelector<E>(s)!;
  const $$ = (s: string) => Array.from(root.current!.querySelectorAll<HTMLElement>(s));

  useEffect(() => {
    const r = root.current;
    if (!r) return;
    setTop(r, top);
    wireOv(r);
    $$('[data-back]').forEach((b) => (b.innerHTML = I.back));
    $('#optPhotoEgg').innerHTML = `${Art.friedEgg({ w: 116, h: 100, r: 42, seed: 41, amp: 0.13, yx: 63, yy: 51, yr: 23 })}<span class="opt-ic">${I.camera}</span>`;
    const voiceOpt = r.querySelector('#optVoiceEgg');
    if (voiceOpt) voiceOpt.innerHTML = `${Art.friedEgg({ w: 116, h: 100, r: 42, seed: 43, amp: 0.13, yx: 63, yy: 51, yr: 23 })}<span class="opt-ic">${I.mic}</span>`;
    $('#voiceEgg').insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 330 305" aria-hidden="true" overflow="visible">${Art.albumen(165, 150, 118, { seed: 51, amp: 0.12, sx: 1.06 })}</svg>`);
    $('#wave').innerHTML = Array.from({ length: BARS }, () => '<i></i>').join('');
    $('#voiceAgain').innerHTML = `${I.retake}<span>start over</span>`;
    $('#voiceSend').innerHTML = `<span>decorate it!</span>${I.right}`;
    voiceReset();
    $$('#v-pick .opt').forEach((o, i) => play(o, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 200 + i * 90, keep: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focused || !morph.current) return;
    const m = morph.current;
    morph.current = null;
    void m.shrink();
  }, [focused]);

  function voiceReset() {
    const v = voice.current;
    cancelAnimationFrame(v.raf);
    Object.assign(v, { state: 'idle', amps: [], dur: 0 });
    const y = $('#voiceYolk');
    y.innerHTML = I.mic;
    y.setAttribute('aria-label', 'start recording');
    y.style.transform = '';
    $('#voiceTime').textContent = '0:00';
    $('#voiceHint').textContent = `tap the yolk and talk to ${latest.current.who.username}`;
    $('#voiceActions').hidden = true;
    $$('#wave i').forEach((b) => {
      b.style.height = '6px';
      b.classList.remove('hot');
    });
  }
  const level = (s: number) => Math.max(0.08, Math.min(1, 0.45 + 0.3 * Math.sin(s * 7.3) * Math.sin(s * 2.1) + 0.25 * Math.sin(s * 13.7 + 1) + (Math.random() - 0.5) * 0.35));
  function ripple() {
    const r = document.createElement('span');
    r.className = 'ripple';
    $('#voiceEgg').append(r);
    play(r, [{ transform: 'scale(1)', opacity: 0.9 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 1600, easing: 'cubic-bezier(.2,.6,.3,1)', keep: false }).then(() => r.remove());
  }
  async function voiceRecord() {
    const v = voice.current;
    const r = root.current!;
    $('#voiceHint').textContent = 'opening your microphone';
    try {
      await latest.current.onRecord();
    } catch (e) {
      $('#voiceHint').textContent = `tap the yolk and talk to ${latest.current.who.username}`;
      return toast(r, e instanceof Error ? e.message.toLowerCase() : "the mic didn't open", 3600);
    }
    v.state = 'rec';
    v.t0 = performance.now();
    v.amps = [];
    v.ripT = 0;
    const y = $('#voiceYolk');
    y.innerHTML = '<span class="stop"></span>';
    y.setAttribute('aria-label', 'stop recording');
    $('#voiceHint').textContent = 'recording. tap the yolk to stop';
    $('#voiceActions').hidden = true;
    let lastPush = 0;
    const bars = $$('#wave i');
    const tick = (now: number) => {
      const s = (now - v.t0) / 1000;
      const a = level(s);
      y.style.transform = `scale(${1 + a * 0.12})`;
      if (now - lastPush > 70) {
        v.amps.push(a);
        lastPush = now;
      }
      const view = v.amps.slice(-BARS);
      bars.forEach((b, i) => {
        const x = view[i - (BARS - view.length)];
        b.style.height = x == null ? '6px' : `${6 + x * 42}px`;
        b.classList.toggle('hot', x != null);
      });
      if (now - v.ripT > 560) {
        ripple();
        v.ripT = now;
      }
      $('#voiceTime').textContent = fmtS(s);
      if (s >= 60) return voiceStop();
      v.raf = requestAnimationFrame(tick);
    };
    v.raf = requestAnimationFrame(tick);
  }
  function voiceStop() {
    const v = voice.current;
    cancelAnimationFrame(v.raf);
    v.state = 'done';
    v.dur = Math.max(1, (performance.now() - v.t0) / 1000);
    call(latest.current.onStop);
    const y = $('#voiceYolk');
    y.style.transform = '';
    y.innerHTML = I.play;
    y.setAttribute('aria-label', 'listen back');
    $('#voiceHint').textContent = 'sounds good? tap the yolk to listen back';
    const bars = $$('#wave i');
    bars.forEach((b, i) => {
      const x = v.amps[Math.floor((i / BARS) * v.amps.length)] ?? 0.1;
      b.style.height = `${6 + x * 42}px`;
      b.classList.remove('hot');
    });
    $('#voiceActions').hidden = false;
    $$('#voiceActions .pill').forEach((b, i) => play(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 60, keep: false }));
  }
  function voicePause() {
    const v = voice.current;
    cancelAnimationFrame(v.raf);
    v.state = 'done';
    $('#voiceYolk').innerHTML = I.play;
    $('#voiceYolk').style.transform = '';
  }
  function voicePlay() {
    const v = voice.current;
    v.state = 'play';
    v.playT0 = performance.now();
    $('#voiceYolk').innerHTML = I.pause;
    call(latest.current.onListen);
    const bars = $$('#wave i');
    const tick = (now: number) => {
      const s = (now - v.playT0) / 1000;
      const f = Math.min(1, s / v.dur);
      bars.forEach((b, i) => b.classList.toggle('hot', i / BARS < f));
      $('#voiceTime').textContent = fmtS(s);
      $('#voiceYolk').style.transform = `scale(${1 + Math.abs(Math.sin(s * 9)) * 0.05})`;
      if (f >= 1) {
        voicePause();
        $('#voiceTime').textContent = fmtS(v.dur);
        return;
      }
      v.raf = requestAnimationFrame(tick);
    };
    v.raf = requestAnimationFrame(tick);
  }

  // go('voice', { anim: 'push' }) and back, inside this one screen.
  function slide(toVoice: boolean) {
    const r = root.current!;
    const W = r.clientWidth;
    const ease = 'cubic-bezier(.32,.72,0,1)';
    const pick = $('#v-pick');
    const vo = $('#v-voice');
    vo.classList.add('on');
    pick.classList.add('on');
    if (toVoice) {
      play(vo, [{ transform: `translateX(${W}px)` }, { transform: 'none' }], { duration: 440, easing: ease, keep: false });
      play(pick, [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-W * 0.3}px)`, opacity: 0.5 }], { duration: 440, easing: ease, keep: false }).then(() => pick.classList.remove('on'));
    } else {
      play(vo, [{ transform: 'none' }, { transform: `translateX(${W}px)` }], { duration: 440, easing: ease, keep: false }).then(() => vo.classList.remove('on'));
      play(pick, [{ transform: `translateX(${-W * 0.3}px)`, opacity: 0.5 }, { transform: 'none', opacity: 1 }], { duration: 440, easing: ease, keep: false });
    }
  }

  // the yolk on the photo option swells over the screen, then the camera opens (prototype's openCamera)
  async function takePhoto(o: HTMLElement) {
    const r = root.current!;
    const y = o.querySelector('.yolk circle') ?? o.querySelector('.yolk');
    if (y && !morph.current) morph.current = await yolkExpand(r, $('.fx'), y);
    return call(latest.current.onPhoto);
  }

  async function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    const p = latest.current;
    const v = voice.current;
    if (t.closest('[data-voice-back]')) {
      if (v.state === 'rec') voiceStop();
      else if (v.state === 'play') voicePause();
      return slide(false);
    }
    if (t.closest('[data-back]')) return call(p.onBack);
    const o = t.closest<HTMLElement>('[data-pick]');
    if (o) {
      if (o.dataset.pick === 'voice') return slide(true);
      if (p.onLibrary) {
        openOv(
          r,
          `<div class="sheet" role="dialog" aria-label="photo"><h3>add a photo</h3>
            <div class="opt-list"><button data-photo-src="camera">take a photo${I.camera}</button>
            <button data-photo-src="library">choose from your photos${I.gallery}</button></div></div>`,
        );
        return;
      }
      return takePhoto(o);
    }
    const src = t.closest<HTMLElement>('[data-photo-src]');
    if (src) {
      await closeOv(r);
      if (src.dataset.photoSrc === 'library') return call(p.onLibrary!);
      return takePhoto(r.querySelector<HTMLElement>('[data-pick="photo"]')!);
    }
    if (t.closest('#voiceYolk')) {
      if (v.state === 'idle') return void voiceRecord();
      if (v.state === 'rec') return voiceStop();
      if (v.state === 'done') return voicePlay();
      if (v.state === 'play') {
        call(p.onListen);
        return voicePause();
      }
    }
    if (t.closest('#voiceAgain')) {
      call(p.onAgain);
      return voiceReset();
    }
    if (t.closest('#voiceSend')) {
      if (v.state === 'play') voicePause();
      call(p.onDecorate);
    }
  }

  return (
    <section ref={root} onClick={(e) => void onClick(e)} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'var(--bg)' }}>
      <section className="view on" id="v-pick">
        <header className="bar">
          <button className="icon-btn" data-back aria-label="back" />
          <div className="bar-title">
            <b>{barTitle}</b>
          </div>
        </header>
        <div className="pick-body">
          <div className="pick-who" dangerouslySetInnerHTML={{ __html: `${avatar(who)}<div><span class="mono">${esc(whoLabel)}</span><b>${esc(who.username)}</b></div>` }} />
          <h2 className="display">pick one:</h2>
          <button className="opt" data-pick="photo">
            <span className="opt-egg" id="optPhotoEgg" />
            <span className="opt-t">
              <b>photo</b>
            </span>
          </button>
          {props.voice !== false ? (
            <button className="opt" data-pick="voice">
              <span className="opt-egg" id="optVoiceEgg" />
              <span className="opt-t">
                <b>voice memo</b>
              </span>
            </button>
          ) : null}
          <div className="pick-prompt">
            <span className="mono">{promptLabel}</span>
            <p>{prompt}</p>
            {gift ? <small style={{ font: '400 12.5px/1.35 var(--f-body)', color: 'var(--ink-2)' }}>{who.username} already sent you something. send yours to see it!</small> : null}
          </div>
        </div>
      </section>
      <section className="view" id="v-voice">
        <header className="bar">
          <button className="icon-btn" data-back data-voice-back aria-label="back" />
          <div className="bar-title">
            voice memo for <b>{who.username}</b>
          </div>
        </header>
        <div className="voice-body">
          <span className="mono">{props.coopName}</span>
          <div className="voice-egg" id="voiceEgg">
            <button className="voice-yolk" id="voiceYolk" aria-label="start recording" />
          </div>
          <div className="wave" id="wave" />
          <div className="voice-time" id="voiceTime">
            0:00
          </div>
          <p className="voice-hint" id="voiceHint" />
        </div>
        <div className="voice-actions" id="voiceActions" hidden>
          <button className="pill ghost" id="voiceAgain" />
          <button className="pill solid" id="voiceSend" />
        </div>
      </section>
      <div className="fx" />
      <div className="ov" />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
