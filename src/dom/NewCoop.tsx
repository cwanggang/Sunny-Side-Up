'use dom';

// A5: making a coop, from the prototype's coop.js (`openCoopForm`, `hatchCoop`, `crackedCardSVG`): a photo,
// a name, a description, then "hatch!": the egg pops in, wobbles, cracks, and the halves fly off to reveal
// the cracked card with the coop code and its qr code.
import type { DOMProps } from 'expo/dom';
import qrcode from 'qrcode-generator';
import { useEffect, useRef } from 'react';

import { Art, FLAT } from './art/art';
import './art/art.css';
import { play, sleep } from './play';
import { call, confettiBurst, esc, hdr, I, setTop, toast, TOAST_HTML } from './ui';

interface Props {
  top: number;
  onBack: () => Promise<void>;
  /** Opens the photo picker; resolves to a preview (data: URL) or null. */
  onPickPhoto: () => Promise<string | null>;
  /** Creates the coop. Resolves to its code; rejects if it couldn't be made. */
  onHatch: (name: string, description: string) => Promise<{ code: string; invite: string }>;
  onShare: () => Promise<void>;
  onDone: () => Promise<void>;
  dom?: DOMProps;
}

function qrSVG(text: string) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="qr code for the coop invite"><path d="${d}" fill="${FLAT.ink}"/></svg>`;
}
function crackedCardSVG() {
  const top = [10, 44, 33, 26, 56, 46, 80, 24, 103, 44, 127, 24, 150, 46, 173, 24, 197, 44, 220, 24, 244, 46, 267, 26, 290, 44];
  const bot = [290, 428, 267, 446, 244, 424, 220, 446, 197, 426, 173, 446, 150, 424, 127, 446, 103, 426, 80, 446, 56, 424, 33, 444, 10, 428];
  const pts = (a: number[]) => a.reduce((s, v, i) => s + (i % 2 ? `,${v} ` : `L${v}`), '');
  return `<svg viewBox="0 0 300 470" aria-hidden="true"><path d="M${pts(top).slice(1)}C302,160 302,330 ${pts(bot).slice(1)}C-2,330 -2,160 10,44Z" fill="#fff" stroke="${FLAT.line}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export default function NewCoop(props: Props) {
  const root = useRef<HTMLElement>(null);
  const latest = useRef(props);
  const busy = useRef(false);
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    if (root.current) setTop(root.current, props.top);
  }, [props.top]);

  async function hatch() {
    const r = root.current!;
    if (busy.current) return;
    const nameEl = r.querySelector<HTMLInputElement>('#coopName')!;
    const name = nameEl.value.trim();
    if (!name) {
      nameEl.focus();
      return toast(r, 'give your coop a name first');
    }
    busy.current = true;
    nameEl.blur();
    let made: { code: string; invite: string };
    try {
      made = await latest.current.onHatch(name, r.querySelector<HTMLTextAreaElement>('#coopDesc')!.value.trim());
    } catch (e) {
      busy.current = false;
      return toast(r, e instanceof Error ? e.message.toLowerCase() : "couldn't hatch that coop, try again", 3200);
    }
    const ov = r.querySelector<HTMLElement>('#hatchOv')!;
    ov.innerHTML = `<div class="hatch-egg" id="hEgg">${Art.eggSVG({ swatch: 'shell', speckle: true })}</div>
    <div class="hatch-card" id="hCard">${crackedCardSVG()}<div class="hatch-in">
      <h2>${esc(name)} is hatched!</h2><span class="code-lbl">coop code</span><span class="code">${esc(made.code)}</span>
      <div class="qr">${qrSVG(made.invite)}</div>
      <button class="copy-btn" id="hCopy">${I.send}share invite</button>
      <button class="pill solid small" id="hDone">done</button></div></div>`;
    ov.hidden = false;
    const egg = ov.querySelector<HTMLElement>('#hEgg')!;
    await play(egg, [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.7 }, { transform: 'none', opacity: 1 }], { duration: 420, keep: false });
    await play(egg, [{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(-5deg)' }, { transform: 'rotate(0)' }], { duration: 520, keep: false });
    egg.querySelectorAll('.crack').forEach((c, i) => play(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: i ? 180 : 260, delay: i ? 140 : 0, easing: 'ease-out' }));
    await sleep(420);
    egg.innerHTML = Art.eggSVG({ swatch: 'shell', speckle: true }, 'top') + Art.eggSVG({ swatch: 'shell', speckle: true }, 'bottom');
    const [t, b] = Array.from(egg.querySelectorAll('svg'));
    play(t, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-30px,-260px) rotate(-30deg)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.3,.6,.5,1)', keep: false });
    play(b, [{ transform: 'none', opacity: 1 }, { transform: 'translate(20px,260px) rotate(16deg)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.5,0,.8,.6)', keep: false });
    await play(ov.querySelector('#hCard'), [{ opacity: 0, transform: 'scale(.4,.3)' }, { opacity: 1, transform: 'scale(1.03)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 120, easing: 'cubic-bezier(.22,1,.36,1)' });
    egg.remove();
    confettiBurst(r, 40);
    ov.querySelector('#hCopy')!.addEventListener('click', () => call(latest.current.onShare));
    ov.querySelector('#hDone')!.addEventListener('click', () => call(latest.current.onDone));
  }

  async function onClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    const r = root.current!;
    if (t.closest('[data-back]')) return call(latest.current.onBack);
    if (t.closest('#hatchBtn')) return void hatch();
    if (t.closest('#coopPic')) {
      const url = await latest.current.onPickPhoto().catch(() => null);
      if (url) r.querySelector('#coopPic')!.innerHTML = `<img src="${esc(url)}" alt="your coop photo">`;
    }
  }

  return (
    <section ref={root} className="view on scr" id="v-coop" onClick={(e) => void onClick(e)} style={{ overflow: 'hidden' }}>
      <div dangerouslySetInnerHTML={{ __html: hdr('new coop') }} style={{ display: 'contents' }} />
      <div className="scroll">
        <div className="coop-form">
          <button className="coop-pic" id="coopPic" aria-label="add a coop photo" dangerouslySetInnerHTML={{ __html: I.plus }} />
          <span className="coop-pic-cap">add a coop photo</span>
          <label className="field">
            <span>coop name</span>
            <input id="coopName" maxLength={24} placeholder="enter text here" autoComplete="off" />
          </label>
          <label className="field">
            <span>description</span>
            <textarea id="coopDesc" rows={3} maxLength={120} placeholder="what's this coop about?" />
          </label>
          <button className="hatch-btn" id="hatchBtn">
            hatch!
          </button>
        </div>
      </div>
      <div className="hatch-ov" id="hatchOv" hidden />
      <div dangerouslySetInnerHTML={{ __html: TOAST_HTML }} style={{ display: 'contents' }} />
    </section>
  );
}
