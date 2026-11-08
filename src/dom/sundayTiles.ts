// The prototype's sunny sunday tile, from sunday.js (`tileHTML`, `crackTile`, `fryTile`). Plain functions,
// shared by the single SundayTile DOM component and the home screen's grid.
//   N  no one to swap with yet          A  your egg to crack (tap → crack → B)
//   B  your person + "tap to respond"   C  they sent you an egg (tap → open)
//   D  still frying (tap → shake)       E  opened (tap → watch again)
import { Art } from './art/art';
import { faceId } from './faces';
import { play, sleep } from './play';

export type SundayTileState = 'N' | 'A' | 'B' | 'C' | 'D' | 'E';

export interface SundayTilePerson {
  id: string;
  name: string;
  photoUrl?: string | null;
}
export interface SundayTileEgg {
  swatch?: string;
  pattern?: string;
  text?: string | null;
}

export const domEgg = (e?: SundayTileEgg | null) => ({
  swatch: e?.swatch ?? 'shell',
  pattern: !e?.pattern || e.pattern === 'none' ? 'plain' : e.pattern,
  text: e?.text ?? '',
});

function friedTile(p: SundayTilePerson) {
  return `<svg class="fe" viewBox="0 0 150 150" aria-hidden="true" overflow="visible">${Art.albumen(75, 79, 49, { seed: p.name.length * 7 + 3, amp: 0.12, sx: 1.05 })}</svg>
    <div class="fe-face">${Art.faceSVG(faceId(p), 'blink')}</div><span class="fe-name">${Art.esc(p.name)}</span>`;
}

export function tileHTML(state: SundayTileState, groupName: string | null | undefined, p: SundayTilePerson | null, theirs?: SundayTileEgg | null, bare?: boolean) {
  if (bare) {
    const art = p && (state === 'B' || state === 'E') ? friedTile(p) : state === 'D' ? Art.pan() : Art.eggSVG({ swatch: 'shell', speckle: true });
    return `<article class="tile t${state}"><div class="tile-art">${art}</div></article>`;
  }
  const head = groupName ? `<h3 class="tile-name">${Art.esc(groupName)}</h3>` : '';
  const name = Art.esc(p?.name ?? 'your person');
  if (state === 'N' || !p) {
    return `<article class="tile tA">${head}
      <div class="tile-art">${Art.eggSVG({ swatch: 'shell', speckle: true }, 'whole', '')}</div>
      <p class="tile-cap">no one to swap with yet<small>share your coop code from the carton</small></p></article>`;
  }
  switch (state) {
    case 'A':
      return `<article class="tile tA">${head}
      <div class="tile-art">${Art.eggSVG({ swatch: 'shell', speckle: true }, 'whole', 'tA-egg')}
        <button class="tap" data-act="crack" aria-label="crack the egg to see your person"></button></div>
      <p class="tile-cap">tap to crack<small>who's your person?</small></p></article>`;
    case 'B':
      return `<article class="tile tB">${head}
      <div class="tile-art">${friedTile(p)}</div>
      <button class="shell-btn" data-act="respond">${Art.halfShell()}<span>tap to respond</span></button></article>`;
    case 'C':
      return `<article class="tile tC">${head}
      <div class="tile-art">${Art.eggSVG(domEgg(theirs))}
        <button class="tap" data-act="open" aria-label="open the egg ${name} sent you"></button></div>
      <p class="tile-cap">${name} sent you an egg!<small>tap to open</small></p></article>`;
    case 'D':
      return `<article class="tile tD">${head}
      <div class="tile-art">${Art.pan()}<button class="tap" data-act="fry" aria-label="${name} hasn't sent theirs yet"></button></div>
      <p class="tile-cap">still frying!<small>waiting on ${name}</small></p></article>`;
    default:
      return `<article class="tile tE">${head}
      <div class="tile-art">${friedTile(p)}<button class="tap" data-act="watch" aria-label="watch ${name}'s message again"></button></div>
      <p class="tile-cap">opened<small>tap to watch again</small></p></article>`;
  }
}

/** crackTile(): the egg wobbles, cracks, the halves tumble off and your person lands in the pan. */
export async function crackTile(tile: HTMLElement, p: SundayTilePerson) {
  const art = tile.querySelector<HTMLElement>('.tile-art')!;
  const egg = art.querySelector<SVGSVGElement>('.tA-egg')!;
  art.querySelector('.tap')?.remove();
  egg.style.animation = 'none';
  await play(egg, [{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(9deg)' }, { transform: 'rotate(-7deg)' }, { transform: 'rotate(4deg)' }, { transform: 'rotate(0)' }], { duration: 560, easing: 'ease-in-out', keep: false });
  egg.querySelectorAll('.crack').forEach((c, i) => play(c, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: i ? 180 : 260, delay: i ? 160 : 0, easing: 'ease-out' }));
  play(egg, [{ transform: 'none' }, { transform: 'translateY(3px) scale(1.03,.96)' }, { transform: 'none' }], { duration: 220, delay: 100, keep: false });
  await sleep(440);
  const halves = document.createElement('div');
  halves.className = 'halves';
  halves.innerHTML = Art.eggSVG({ swatch: 'shell', speckle: true }, 'top') + Art.eggSVG({ swatch: 'shell', speckle: true }, 'bottom');
  egg.remove();
  art.insertAdjacentHTML('beforeend', friedTile(p));
  art.append(halves);
  const [top, bot] = Array.from(halves.querySelectorAll('svg'));
  const fe = art.querySelector('.fe');
  const face = art.querySelector('.fe-face');
  const nm = art.querySelector('.fe-name');
  play(top, [{ transform: 'none', opacity: 1 }, { transform: 'translate(-12%,-42%) rotate(-30deg)', opacity: 1, offset: 0.45 }, { transform: 'translate(-34%,-18%) rotate(-70deg)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.25,.7,.4,1)', keep: false });
  play(bot, [{ transform: 'none', opacity: 1 }, { transform: 'translate(14%,16%) rotate(18deg)', opacity: 1, offset: 0.4 }, { transform: 'translate(32%,44%) rotate(40deg)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.25,.7,.4,1)', keep: false });
  play(fe, [{ transform: 'scale(.12)', opacity: 0 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.5 }, { transform: 'scale(.96)', offset: 0.78 }, { transform: 'scale(1)', opacity: 1 }], { duration: 760, delay: 100, easing: 'ease-out' });
  play(face, [{ transform: 'translateY(-90%) scale(.55)', opacity: 0 }, { transform: 'translateY(0) scale(1.18,.84)', opacity: 1, offset: 0.55 }, { transform: 'translateY(-7%) scale(.95,1.06)', offset: 0.76 }, { transform: 'none', opacity: 1 }], { duration: 820, delay: 260, easing: 'ease-out' });
  play(nm, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 760 });
  const cap = tile.querySelector<HTMLElement>('.tile-cap');
  if (cap) {
    play(cap, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, keep: false }).then(() => {
      cap.outerHTML = `<button class="shell-btn" data-act="respond">${Art.halfShell()}<span>tap to respond</span></button>`;
      play(tile.querySelector('.shell-btn'), [{ opacity: 0, transform: 'translateY(18px) rotate(-6deg)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: 450, easing: 'cubic-bezier(.34,1.5,.64,1)', keep: false });
    });
  }
  await sleep(1400);
  halves.remove();
}

/** fryTile(): the pan shakes. */
export function fryTile(tile: HTMLElement) {
  tile.classList.remove('shake');
  void tile.offsetWidth;
  tile.classList.add('shake');
  setTimeout(() => tile.classList.remove('shake'), 800);
}

/** replaceTile()'s pop when a tile changes state. */
export const popTile = (tile: Element | null) =>
  play(tile, [{ transform: 'scale(.86)', opacity: 0.4 }, { transform: 'scale(1.05)', opacity: 1, offset: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 650, easing: 'ease-out', keep: false });
