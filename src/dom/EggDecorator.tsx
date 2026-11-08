'use dom';

// A5: "decorate it!", the prototype's v-deco screen (sunday.js `setupDeco`, `renderTrays`,
// `setTool`, `bounceDeco`, `deliverEgg`) ported line for line: the big egg, the text / color /
// pattern tools, the trays (each pattern drawn on a little egg), a squash-and-stretch bounce on every
// change, and on deliver the egg squashes, then flies up and away trailing sparks.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art, PATTERNS, SWATCHES } from './art/art';
import './art/art.css';
import { play } from './play';

interface Props {
  /** "voice memo for <b>jun</b>" */
  kindLabel: string;
  partnerName: string;
  top: number;
  /** The chick carries this one: skip the fly-away and go straight back (the prototype's deliverNudge). */
  quick?: boolean;
  onBack: () => Promise<void>;
  /** Sends the egg. Resolve when it's saved; throw (reject) to keep the screen open. */
  onDeliver: (egg: { swatch: string; pattern: string; text: string }) => Promise<void>;
  /** After the fly-away animation. */
  onDelivered: () => Promise<void>;
  dom?: DOMProps;
}

const CSS = `
  .deco-root { position: absolute; inset: 0; background: var(--bg); overflow: hidden; }
  .spark-dot { position: absolute; }
  .deco-err { position: absolute; left: 20px; right: 20px; bottom: 96px; text-align: center; font: 500 13px/1.3 var(--f-body); color: var(--red); }
`;

export default function EggDecorator(props: Props) {
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
    const $$ = (s: string) => Array.from(el.querySelectorAll<HTMLElement>(s));
    el.style.setProperty('--top', `${p.top}px`);
    const deco = { swatch: 'butter', pattern: 'dots', text: `for ${p.partnerName}`.slice(0, 14), tool: 'color' };
    let busy = false;

    const renderDecoEgg = () => {
      $('#decoEgg').innerHTML = Art.eggSVG(deco);
    };
    const renderTrays = () => {
      $('#trayColors').innerHTML = SWATCHES.map((s) => `<button class="sw" data-sw="${s.id}" aria-label="${s.id}" aria-pressed="${s.id === deco.swatch}" style="background:${s.base}"></button>`).join('');
      $('#trayPatterns').innerHTML = PATTERNS.map((pt) => `<button class="pt" data-pt="${pt}" aria-label="${pt}" aria-pressed="${pt === deco.pattern}">${Art.eggSVG({ swatch: deco.swatch, pattern: pt, shine: 0 }, 'whole', '')}</button>`).join('');
    };
    const setTool = (t: string) => {
      deco.tool = t;
      $$('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
      $$('.tray').forEach((tr) => tr.classList.toggle('on', tr.dataset.tray === t));
      if (t === 'text') setTimeout(() => $<HTMLInputElement>('#decoText').focus({ preventScroll: true }), 50);
    };
    const bounceDeco = () =>
      play($('#decoEgg svg'), [{ transform: 'scale(1)' }, { transform: 'scale(1.06,.95)' }, { transform: 'scale(.98,1.02)' }, { transform: 'scale(1)' }], { duration: 420, keep: false });
    const relRect = (n: Element) => {
      const s = el.getBoundingClientRect();
      const r = n.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    };
    const burst = (x: number, y: number, n = 12) => {
      for (let i = 0; i < n; i++) {
        const d = document.createElement('i');
        d.className = 'spark-dot';
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 50 + Math.random() * 60;
        const sz = 4 + Math.random() * 6;
        Object.assign(d.style, { left: `${x}px`, top: `${y}px`, width: `${sz}px`, height: `${sz}px`, background: i % 3 ? '#F2AE3D' : '#fff' });
        el.append(d);
        play(
          d,
          [
            { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(1)`, opacity: 1, offset: 0.6 },
            { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 1.2}px), calc(-50% + ${Math.sin(a) * dist * 1.2 + 20}px)) scale(.4)`, opacity: 0 },
          ],
          { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', keep: false },
        ).then(() => d.remove());
      }
    };

    // setupDeco()
    $<HTMLInputElement>('#decoText').value = deco.text;
    $('#decoBar').innerHTML = p.kindLabel;
    $$('[data-back]').forEach((b) => (b.innerHTML = Art.I.back));
    $$('.tool').forEach((b) => (b.innerHTML = Art.I[b.dataset.tool ?? ''] ?? ''));
    $('#deliver').innerHTML = `<span>deliver</span>${Art.I.send}`;
    renderDecoEgg();
    renderTrays();
    setTool('color');

    $('.deco-tools').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tool]');
      if (b) setTool(b.dataset.tool ?? 'color');
    });
    $('#trayColors').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-sw]');
      if (!b) return;
      deco.swatch = b.dataset.sw ?? deco.swatch;
      renderDecoEgg();
      renderTrays();
      bounceDeco();
    });
    $('#trayPatterns').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pt]');
      if (!b) return;
      deco.pattern = b.dataset.pt ?? deco.pattern;
      renderDecoEgg();
      renderTrays();
      bounceDeco();
    });
    $('#decoText').addEventListener('input', (e) => {
      deco.text = (e.target as HTMLInputElement).value;
      renderDecoEgg();
    });
    $('[data-back]').addEventListener('click', () => void latest.current.onBack().catch(() => {}));

    // deliverEgg()
    $('#deliver').addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      const err = $('#decoErr');
      err.textContent = '';
      $<HTMLInputElement>('#decoText').blur();
      const egg = $('#decoEgg');
      egg.style.animation = 'none';
      const squash = play(egg, [{ transform: 'none' }, { transform: 'translateY(12px) scale(1.1,.86)', offset: 0.35 }, { transform: 'translateY(-16px) scale(.94,1.07)', offset: 0.7 }, { transform: 'none' }], { duration: 520, easing: 'ease-in-out', keep: false });
      try {
        await Promise.all([latest.current.onDeliver({ swatch: deco.swatch, pattern: deco.pattern, text: deco.text.trim() }), squash]);
      } catch (e) {
        err.textContent = e instanceof Error ? e.message.toLowerCase() : "couldn't send it, try again";
        busy = false;
        return;
      }
      if (latest.current.quick) {
        void latest.current.onDelivered().catch(() => {});
        return;
      }
      const trail = setInterval(() => {
        const r = relRect(egg);
        burst(r.x + r.w / 2, r.y + r.h * 0.8, 3);
      }, 70);
      await play(
        egg,
        [{ transform: 'none', opacity: 1 }, { transform: 'translate(24px,-120px) rotate(10deg) scale(.8)', opacity: 1, offset: 0.4 }, { transform: `translate(80px,-${el.clientHeight}px) rotate(38deg) scale(.3)`, opacity: 0 }],
        { duration: 950, easing: 'cubic-bezier(.5,0,.75,.3)' },
      );
      clearInterval(trail);
      void latest.current.onDelivered().catch(() => {});
    });
  }, []);

  return (
    <div ref={root} className="deco-root" id="v-deco">
      <style>{CSS}</style>
      <header className="bar">
        <button className="icon-btn" data-back aria-label="back" />
        <div className="bar-title" id="decoBar" />
      </header>
      <h2 className="display deco-title">decorate it!</h2>
      <div className="deco-stage">
        <div className="deco-egg" id="decoEgg" />
      </div>
      <div className="deco-tray">
        <div className="tray tray-text" data-tray="text">
          <label className="mono" htmlFor="decoText">
            write on your egg
          </label>
          <input id="decoText" maxLength={14} autoComplete="off" placeholder="hi friend" />
        </div>
        <div className="tray tray-colors" data-tray="color" id="trayColors" />
        <div className="tray tray-patterns" data-tray="pattern" id="trayPatterns" />
      </div>
      <p className="deco-err" id="decoErr" role="alert" />
      <div className="deco-tools">
        <button className="tool" data-tool="text" aria-label="text" />
        <button className="tool" data-tool="color" aria-label="color" />
        <button className="tool" data-tool="pattern" aria-label="pattern" />
        <button className="pill yolky" id="deliver" />
      </div>
    </div>
  );
}
