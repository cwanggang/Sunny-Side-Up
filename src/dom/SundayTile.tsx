'use dom';

// A5: one sunny sunday tile (the drawing and animations are in sundayTiles.ts, also used by home). It
// stays mounted while its state changes, so animations finish in place and the native side never has to
// replace it mid-animation.
import type { DOMProps } from 'expo/dom';
import { useEffect, useRef } from 'react';

import './art/art.css';
import { crackTile, fryTile, popTile, tileHTML, type SundayTileEgg, type SundayTilePerson, type SundayTileState } from './sundayTiles';

interface Props {
  state: SundayTileState;
  /** Coop name shown above the egg (the prototype's `.tile-name`). Omit to hide. */
  groupName?: string | null;
  /** Just the art: no caption, button or tap target (e.g. the header of the respond screen). */
  bare?: boolean;
  partner: SundayTilePerson | null;
  /** The egg they sent you (C / E). */
  theirs?: SundayTileEgg | null;
  onCracked?: () => Promise<void>;
  onRespond?: () => Promise<void>;
  onOpen?: () => Promise<void>;
  onWatch?: () => Promise<void>;
  onFry?: () => Promise<void>;
  dom?: DOMProps;
}

const CSS = `
  .holder { position: absolute; inset: 0; display: flex; align-items: flex-start; justify-content: center; }
  .holder .tile { width: 100%; }
`;

export default function SundayTile(props: Props) {
  const { state, groupName, partner, theirs, bare } = props;
  const holder = useRef<HTMLDivElement>(null);
  const shown = useRef<{ state: SundayTileState; key: string } | null>(null);
  const busy = useRef(false);
  const latest = useRef(props);

  useEffect(() => {
    latest.current = props;
  });

  // Render (and `replaceTile` pop) whenever the state changes; quietly re-render for new data.
  useEffect(() => {
    const h = holder.current;
    if (!h || busy.current) return;
    const key = JSON.stringify([state, groupName, partner, theirs, bare]);
    if (shown.current?.key === key) return;
    const changed = shown.current !== null && shown.current.state !== state;
    h.innerHTML = tileHTML(state, groupName, partner, theirs, bare);
    shown.current = { state, key };
    if (changed) popTile(h.querySelector('.tile'));
  }, [state, groupName, partner, theirs, bare]);

  async function crack() {
    const tile = holder.current?.querySelector<HTMLElement>('.tile');
    const p = latest.current.partner;
    if (!tile || !p || busy.current) return;
    busy.current = true;
    // The tile will show state B; record it so the native B state doesn't re-render or pop it.
    const now = latest.current;
    shown.current = { state: 'B', key: JSON.stringify(['B', now.groupName, now.partner, now.theirs, now.bare]) };
    await crackTile(tile, p);
    busy.current = false;
    void latest.current.onCracked?.().catch(() => {});
  }

  function onClick(e: React.MouseEvent) {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || busy.current) return;
    const p = latest.current;
    switch (b.dataset.act) {
      case 'crack':
        return void crack();
      case 'fry': {
        const tile = holder.current?.querySelector<HTMLElement>('.tile');
        if (tile) fryTile(tile);
        return void p.onFry?.().catch(() => {});
      }
      case 'respond':
        return void p.onRespond?.().catch(() => {});
      case 'open':
        return void p.onOpen?.().catch(() => {});
      case 'watch':
        return void p.onWatch?.().catch(() => {});
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <div ref={holder} className="holder" onClick={onClick} />
    </>
  );
}
