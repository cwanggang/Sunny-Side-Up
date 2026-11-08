'use dom';

// A5: the prototype's loading egg ("1: splash" in app.js), ported line for line: the egg white
// grows in, the yolk pops with a little overshoot, its glint draws on, the letters of
// "sunny side up" rise one by one, then "tap to come in". Leaves on tap or after 4.3s.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import { Art } from './art/art';
import './art/art.css';
import { play, sleep, T } from './play';

const CSS = `
  .splash { position: absolute; inset: 0; background: var(--bg); display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 30px; cursor: pointer; }
  .mono { font: 400 12.5px/1.35 var(--f-body); color: var(--ink-2); }
`;

export default function SplashEgg({ onDone }: { onDone: () => Promise<void>; dom?: DOMProps }) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLParagraphElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function leave() {
    if (done.current) return;
    done.current = true;
    if (timer.current) clearTimeout(timer.current);
    [art.current, word.current].forEach((el) =>
      play(el, [{ transform: 'none', opacity: 1 }, { transform: 'scale(.94)', opacity: 0 }], {
        duration: 420,
        easing: 'cubic-bezier(.5,0,.75,0)',
        keep: false,
      }),
    );
    await sleep(250);
    await onDone();
  }

  function intro() {
    // drawSplash()
    const cx = 140;
    const cy = 107;
    if (!svg.current || !word.current) return;
    svg.current.innerHTML =
      Art.albumen(cx, cy, 88, { seed: 4, amp: 0.1, sx: 1.3, sy: 0.94, n: 16 }).replace('<path', '<path id="splashWhite"') +
      `<g id="splashYolk">${Art.yolk(cx + 24, cy - 4, 40)}</g>`;

    // playSplash()
    const white = svg.current.querySelector<SVGPathElement>('#splashWhite');
    const yolk = svg.current.querySelector<SVGGElement>('#splashYolk');
    const glint = svg.current.querySelector<SVGPathElement>('#splashYolk path');
    word.current.innerHTML = 'sunny side up'
      .split('')
      .map((c) => `<span>${c === ' ' ? '&nbsp;' : c}</span>`)
      .join('');
    if (hint.current) hint.current.style.opacity = '0';
    if (white) white.style.opacity = '0';
    if (yolk) yolk.style.transform = 'scale(0)';

    play(white, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 800 });
    play(yolk, [{ transform: 'scale(0)' }, { transform: 'scale(1.06)', offset: 0.65 }, { transform: 'scale(1)' }], {
      duration: 620,
      delay: 380,
      easing: 'ease-out',
    });
    if (glint) {
      const gl = glint.getTotalLength();
      glint.style.strokeDasharray = String(gl);
      play(glint, [{ strokeDashoffset: gl }, { strokeDashoffset: 0 }], { duration: 420, delay: 950 });
    }
    word.current.querySelectorAll('span').forEach((el, i) =>
      play(el, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], {
        duration: 600,
        delay: 1000 + i * 45,
      }),
    );
    play(hint.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 2400 });
    timer.current = setTimeout(() => void leave(), T(4300));
  }


  useEffect(() => {
    let cancelled = false;
    // Lexend comes from Google Fonts; if the letters started rising in the fallback font they would
    // jump when Lexend swaps in. Wait for it (at most 0.9s), then run the prototype's intro.
    const fontReady = Promise.race([
      document.fonts ? document.fonts.load('600 25px Lexend').then(() => undefined) : Promise.resolve(),
      new Promise<void>((r) => setTimeout(r, 900)),
    ]).catch(() => undefined);
    if (word.current) word.current.style.visibility = 'hidden';
    void fontReady.then(() => {
      if (cancelled) return;
      if (word.current) word.current.style.visibility = '';
      intro();
    });
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
    // leave() only reads refs; run the intro once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="splash" role="button" aria-label="sunny side up, tap to come in" onClick={() => void leave()}>
      <style>{CSS}</style>
      <div ref={art} className="splash-art">
        <svg ref={svg} viewBox="0 0 280 214" aria-hidden="true" />
      </div>
      <div ref={word} className="splash-word" />
      <p ref={hint} className="splash-hint mono">
        tap to come in
      </p>
    </div>
  );
}
