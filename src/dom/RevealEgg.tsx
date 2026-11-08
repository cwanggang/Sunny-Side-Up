'use dom';

// A5: "you have an egg!", the prototype's reveal (sunday.js `openEgg`, `spill`, `placeBar`,
// `runLiquid`, `revealPlayer`, reactions), ported line for line. Tap once: it wobbles and cracks.
// Tap again: the shell halves tumble off, the egg white spills over the screen (WebGL metaballs,
// liquid.js), the yolk bounces down and stretches into the reaction bar, and their message fades
// in. The prototype's message is a pretend video; here it's their real voice memo or photo.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { Liquid, type LiquidField } from './art/liquid';
import { faceKeyFor } from './faces';
import { play, sleep, T } from './play';

const REACTIONS = ['❤️', '😂', '🥹', '🔥', '🍳'];

interface Props {
  fromName: string;
  fromId: string;
  groupName: string;
  /** Replaces "from x in y" (the chick's "delivered by the chick"). */
  fromLine?: string;
  /** e.g. "nov 8" */
  dateLabel: string;
  egg: { swatch?: string; pattern?: string; text?: string | null };
  message: { kind: 'voice' | 'photo' | 'text'; url?: string | null; body?: string | null };
  /** Already opened before: skip straight to the message. */
  skipIntro?: boolean;
  /** Safe-area top inset in px (status bar). */
  top?: number;
  onReact: (emoji: string) => Promise<void>;
  onClose: () => Promise<void>;
  dom?: DOMProps;
}

const CSS = `
  .reveal { position: absolute; inset: 0; background: var(--bg); overflow: hidden; }
  .rv-scene img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .rv-cap span { white-space: pre-wrap; }
  .toast { position: absolute; top: calc(var(--top) + 8px); left: 50%; z-index: 95; padding: 9px 18px; border-radius: 999px;
    background: var(--ink); color: #fff; font: 500 14px/1.3 var(--f-body); transform: translate(-50%, -140%); opacity: 0;
    transition: transform .45s var(--ease-out), opacity .3s; white-space: nowrap; }
  .toast.on { transform: translate(-50%, 0); opacity: 1; }
`;

export default function RevealEgg(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const p = latest.current;
    const $ = <E extends Element = HTMLElement>(s: string) => el.querySelector<E>(s)!;
    const $$ = (s: string, r: ParentNode = el) => Array.from(r.querySelectorAll<HTMLElement>(s));
    const SW = () => el.clientWidth;
    const SH = () => el.clientHeight;
    const relRect = (n: Element) => {
      const s = el.getBoundingClientRect();
      const r = n.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    };
    el.style.setProperty('--top', `${p.top ?? 50}px`);

    const egg = { swatch: p.egg.swatch ?? 'shell', pattern: !p.egg.pattern || p.egg.pattern === 'none' ? 'plain' : p.egg.pattern, text: p.egg.text ?? '' };
    const rv = { taps: 0, busy: false, reacted: false };
    let liquid: LiquidField | null = null;
    let alive = true;
    let audio: HTMLAudioElement | null = null;
    let raf = 0;

    // openEgg()
    $('#rvFromLine').textContent = p.fromLine ?? `from ${p.fromName} in ${p.groupName}`;
    const eggEl = $('#rvEgg');
    eggEl.innerHTML = Art.eggSVG(egg);
    eggEl.className = 'rv-egg idle';
    $('#rvHint').textContent = 'tap to crack!';
    $('#rvReact').innerHTML = REACTIONS.map((e) => `<button data-r="${e}" aria-label="react ${e}">${e}</button>`).join('');
    $('#rvFrom').innerHTML = `<span class="av" style="width:44px;height:44px;display:block">${Art.faceSVG(faceKeyFor(p.fromId))}</span><div><span class="mono">from</span><b>${Art.esc(p.fromName)}</b></div>`;
    const scene = $('#rvScene');
    if (p.message.kind === 'photo' && p.message.url) scene.innerHTML = `<img src="${p.message.url}" alt="">`;
    else scene.innerHTML = Art.talkScene(faceKeyFor(p.fromId), 'kitchen', 'blink');
    $('#rvMetaL').textContent = p.groupName;
    $('#rvMetaR').textContent = p.dateLabel;
    $('#rvCap').innerHTML = p.message.body ? `<span>${Art.esc(p.message.body)}</span>` : '';
    $('#rvProg').style.width = '0%';
    const playBtn = $('#rvPlay');
    const replay = $('#rvReplay');
    playBtn.innerHTML = Art.I.play;
    replay.innerHTML = `<span>${Art.I.replay}listen again</span>`;
    replay.hidden = true;
    const hasAudio = p.message.kind === 'voice' && !!p.message.url;
    playBtn.hidden = !hasAudio;
    if (hasAudio) {
      audio = new Audio(p.message.url!);
      audio.preload = 'auto';
    }
    liquid = Liquid.create($<HTMLCanvasElement>('#rvCanvas'));
    liquid.size(SW(), SH());
    liquid.clear();

    // voice playback (the prototype's startVideo/pauseVideo, driving a real <audio>)
    const tick = () => {
      if (!audio) return;
      const d = audio.duration || 0;
      $('#rvProg').style.width = d ? `${Math.min(100, (audio.currentTime / d) * 100)}%` : '0%';
      if (!audio.paused && !audio.ended) raf = requestAnimationFrame(tick);
    };
    const startVideo = (from: number) => {
      if (!audio) return;
      audio.currentTime = from;
      void audio.play().catch(() => {});
      replay.hidden = true;
      playBtn.innerHTML = Art.I.pause;
      playBtn.setAttribute('aria-label', 'pause');
      $('#rvScene svg')?.classList.add('talking');
      raf = requestAnimationFrame(tick);
    };
    const pauseVideo = () => {
      cancelAnimationFrame(raf);
      audio?.pause();
      $('#rvScene svg')?.classList.remove('talking');
      playBtn.innerHTML = Art.I.play;
      playBtn.setAttribute('aria-label', 'play');
    };
    audio?.addEventListener('ended', () => {
      $('#rvScene svg')?.classList.remove('talking');
      replay.hidden = false;
      playBtn.innerHTML = Art.I.play;
      $('#rvProg').style.width = '100%';
    });
    playBtn.addEventListener('click', () => (audio && !audio.paused ? pauseVideo() : startVideo(audio?.ended ? 0 : (audio?.currentTime ?? 0))));
    replay.addEventListener('click', () => startVideo(0));

    // revealPlayer()
    const revealPlayer = (delay: number) => {
      const pl = $('#rvPlayer');
      pl.classList.add('on');
      play(pl, [{ opacity: 0, transform: 'scale(.94) translateY(10px)', filter: 'blur(14px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 950, delay, easing: 'cubic-bezier(.22,1,.36,1)' });
      const close = $('#rvClose');
      close.innerHTML = Art.I.close;
      close.hidden = false;
      play(close, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: delay + 400 });
      setTimeout(() => alive && startVideo(0), T(delay + 500));
      rv.busy = false;
    };

    // placeBar()
    const placeBar = async (animate: boolean) => {
      const Y = $('#rvYolk');
      const W = SW();
      const PW = Math.min(W - 48, 330);
      const yB = SH() - 66 - 34;
      Y.style.opacity = '1';
      Y.classList.add('bar');
      if (animate) {
        await play(Y, [{ width: '66px', transform: `translate(${W / 2 - 33}px,${yB}px)` }, { width: `${PW}px`, transform: `translate(${(W - PW) / 2}px,${yB}px)` }], { duration: 640, easing: 'cubic-bezier(.34,1.45,.64,1)' });
      } else Object.assign(Y.style, { width: `${PW}px`, transform: `translate(${(W - PW) / 2}px,${yB}px)` });
      Y.style.pointerEvents = 'auto';
      $$('#rvReact button').forEach((b, i) =>
        play(b, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: animate ? i * 60 : 0, easing: 'cubic-bezier(.34,1.7,.64,1)' }),
      );
    };

    // runLiquid()
    const runLiquid = (cx: number, cy: number) => {
      const W = SW();
      const H = SH();
      const R = Art.rng(42);
      const sats = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * Math.PI * 2 + (R() - 0.5) * 0.5, d: 70 + R() * 85, r: 11 + R() * 13, k: 6 + R() * 5 }));
      const drops = Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + R() * 0.7, d: 150 + R() * 110, r: 4 + R() * 5, k: 5 + R() * 3 }));
      const drips = Array.from({ length: 5 }, (_, i) => {
        const u = (i - 2) / 2;
        return { x: cx + u * 84 + (R() - 0.5) * 18, y0: cy + 40 - Math.abs(u) * 22, t0: 0.28 + R() * 0.3, w: 15 + R() * 10, g: 500 + R() * 1100, ph: R() * 6 };
      });
      const back = (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);
      const sm = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      const at = (t: number) => {
        const balls: number[][] = [];
        const caps: number[][] = [];
        const g = Math.min(1, t * 4);
        const core = t < 0.3 ? back(t / 0.3) * 78 : 78 + Math.min(1, (t - 0.3) / 1.3) * 34;
        balls.push([cx, cy, core], [cx - 32, cy + 22, core * 0.66 * g], [cx + 30, cy - 12, core * 0.6 * g]);
        for (const s of sats) {
          const d = s.d * (1 - Math.exp(-t * s.k));
          balls.push([cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d + t * t * 40, s.r * Math.min(1, t * 7)]);
        }
        for (const s of drops) {
          const d = s.d * (1 - Math.exp(-t * s.k));
          balls.push([cx + Math.cos(s.a) * d, cy + Math.sin(s.a) * d + t * t * 60, s.r * Math.min(1, t * 9)]);
        }
        for (const d of drips) {
          if (t < d.t0) continue;
          const tt = t - d.t0;
          const len = 0.5 * d.g * tt * tt + 40 * tt;
          const sw = Math.sin(tt * 2.4 + d.ph) * 6;
          const gr = Math.min(1, tt * 4);
          caps.push([d.x, d.y0, d.x + sw * 0.5, d.y0 + len * 0.55, d.w * gr]);
          caps.push([d.x + sw * 0.5, d.y0 + len * 0.55, d.x + sw, d.y0 + len, d.w * 0.78 * gr]);
          balls.push([d.x + sw, d.y0 + len, d.w * 1.45 * gr]);
        }
        if (t > 0.5) {
          const tt = t - 0.5;
          caps.push([cx, cy, cx + Math.sin(tt) * 8, cy + 30 + 190 * tt * tt, 36 * Math.min(1, tt * 2.5)]);
        }
        return { balls, caps, cover: sm(1.0, 2.15, t) * 1.3 };
      };
      liquid!.size(W, H);
      const END = 2.25;
      return new Promise<void>((res) => {
        const t0 = performance.now();
        const frame = (now: number) => {
          const t = Math.min(END, (now - t0) / 1000);
          liquid!.draw(at(t));
          if (t < END && alive) requestAnimationFrame(frame);
          else res();
        };
        requestAnimationFrame(frame);
      });
    };

    // spill()
    const spill = async () => {
      rv.busy = true;
      const er = relRect(eggEl);
      const cx = er.x + er.w / 2;
      const cy = er.y + er.h * 0.56;
      const shells = $('#rvShells');
      shells.innerHTML = Art.eggSVG(egg, 'top') + Art.eggSVG(egg, 'bottom');
      const [top, bot] = Array.from(shells.querySelectorAll<SVGSVGElement>('svg'));
      [top, bot].forEach((s) => Object.assign(s.style, { left: `${er.x}px`, top: `${er.y}px`, width: `${er.w}px`, height: `${er.h}px` }));
      eggEl.style.visibility = 'hidden';
      play($('#rvHint'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      const H = SH();
      play(top, [{ transform: 'none' }, { transform: 'translate(-46px,-110px) rotate(-38deg)', offset: 0.28 }, { transform: `translate(-170px,${H}px) rotate(-230deg)` }], { duration: 1500, easing: 'cubic-bezier(.33,.3,.6,1)', keep: false }).then(() => top.remove());
      play(bot, [{ transform: 'none' }, { transform: 'translate(54px,-34px) rotate(20deg)', offset: 0.22 }, { transform: `translate(170px,${H}px) rotate(170deg)` }], { duration: 1350, easing: 'cubic-bezier(.4,.2,.7,1)', keep: false }).then(() => bot.remove());

      const Y = $('#rvYolk');
      const x0 = cx - 33;
      const y0 = cy - 33;
      const tr = (x: number, y: number, sx = 1, sy = 1) => `translate(${x}px,${y}px) scale(${sx},${sy})`;
      Y.style.opacity = '1';
      play(Y, [{ transform: tr(x0, y0, 0.3, 0.3) }, { transform: tr(x0, y0, 1.15, 0.88), offset: 0.6 }, { transform: tr(x0, y0) }], { duration: 460, easing: 'ease-out' });
      const pour = runLiquid(cx, cy);
      play($('#rvIntro'), [{ opacity: 1 }, { opacity: 0 }], { duration: 500, delay: 1300 });
      await sleep(1150);
      const x = SW() / 2 - 33;
      const yB = SH() - 66 - 34;
      await play(
        Y,
        [
          { transform: tr(x0, y0), easing: 'cubic-bezier(.5,0,1,.6)' },
          { transform: tr(x, yB, 0.9, 1.12), offset: 0.33, easing: 'linear' },
          { transform: tr(x, yB, 1.24, 0.74), offset: 0.38, easing: 'cubic-bezier(0,.55,.45,1)' },
          { transform: tr(x, yB - 140, 0.94, 1.07), offset: 0.6, easing: 'cubic-bezier(.55,0,1,.45)' },
          { transform: tr(x, yB, 1.15, 0.84), offset: 0.78, easing: 'cubic-bezier(0,.55,.45,1)' },
          { transform: tr(x, yB - 42, 0.98, 1.02), offset: 0.89, easing: 'cubic-bezier(.55,0,1,.45)' },
          { transform: tr(x, yB, 1.05, 0.95), offset: 0.96 },
          { transform: tr(x, yB) },
        ],
        { duration: 1500 },
      );
      await pour;
      await placeBar(true);
      revealPlayer(450);
    };

    eggEl.addEventListener('click', () => {
      if (rv.busy) return;
      rv.taps++;
      if (rv.taps === 1) {
        eggEl.classList.remove('idle');
        play(eggEl, [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg) scale(1.02)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-4deg)' }, { transform: 'rotate(0)' }], { duration: 480, easing: 'ease-in-out', keep: false });
        $$('.crack', eggEl).forEach((c, i) => play(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: i ? 200 : 300, delay: i ? 180 : 60, easing: 'ease-out' }));
        $('#rvHint').textContent = 'one more tap!';
        play($('#rvHint'), [{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 400, easing: 'cubic-bezier(.34,1.56,.64,1)', keep: false });
      } else void spill();
    });

    // reactions
    $('#rvReact').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-r]');
      if (!b) return;
      const r = relRect(b);
      const f = document.createElement('span');
      f.className = 'float-emoji';
      f.textContent = b.dataset.r ?? '';
      Object.assign(f.style, { left: `${r.x + r.w / 2 - 15}px`, top: `${r.y}px` });
      el.append(f);
      const dx = (Math.random() - 0.5) * 60;
      play(f, [{ transform: 'translateY(0) scale(.6)', opacity: 0 }, { transform: `translate(${dx * 0.3}px,-60px) scale(1.3)`, opacity: 1, offset: 0.25 }, { transform: `translate(${dx}px,-220px) scale(1)`, opacity: 0 }], { duration: 1300, easing: 'cubic-bezier(.2,.7,.3,1)', keep: false }).then(() => f.remove());
      const Y = $('#rvYolk');
      play(Y, [{ transform: Y.style.transform }, { transform: Y.style.transform + ' scale(1.03,.92)' }, { transform: Y.style.transform }], { duration: 300, keep: false });
      play(b, [{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300, keep: false });
      void latest.current.onReact(b.dataset.r ?? '').catch(() => {});
      if (!rv.reacted) {
        rv.reacted = true;
        const t = $('#rvToast');
        t.textContent = `${latest.current.fromName} will see your ${b.dataset.r}`;
        t.classList.add('on');
        setTimeout(() => t.classList.remove('on'), 2600);
      }
    });

    $('#rvClose').addEventListener('click', () => {
      pauseVideo();
      void latest.current.onClose().catch(() => {});
    });

    if (p.skipIntro) {
      $('#rvIntro').style.opacity = '0';
      liquid.draw({ balls: [[SW() / 2, SH() / 2, 120]], caps: [], cover: 1.4 });
      void placeBar(false);
      revealPlayer(0);
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      audio?.pause();
    };
  }, []);

  return (
    <div ref={root} className="reveal">
      <style>{CSS}</style>
      <div className="rv-intro" id="rvIntro">
        <span className="mono" id="rvFromLine" />
        <h2 className="display">you have an egg!</h2>
        <button className="rv-egg idle" id="rvEgg" aria-label="crack the egg" />
        <p className="rv-hint" id="rvHint">
          tap to crack!
        </p>
      </div>
      <canvas className="rv-canvas" id="rvCanvas" />
      <div className="rv-shells" id="rvShells" />
      <div className="rv-player" id="rvPlayer">
        <div className="rv-from" id="rvFrom" />
        <div className="rv-video" id="rvVideo">
          <div className="rv-scene" id="rvScene" />
          <div className="rv-cap" id="rvCap" />
          <div className="rv-prog">
            <i id="rvProg" />
          </div>
          <button className="rv-play" id="rvPlay" aria-label="play" />
          <button className="rv-replay" id="rvReplay" hidden />
        </div>
        <div className="rv-meta">
          <span className="mono" id="rvMetaL" />
          <span className="mono" id="rvMetaR" />
        </div>
      </div>
      <div className="rv-yolk" id="rvYolk">
        <div className="rv-react" id="rvReact" />
      </div>
      <button className="icon-btn rv-close" id="rvClose" aria-label="close" hidden />
      <div className="toast" id="rvToast" role="status" />
    </div>
  );
}
