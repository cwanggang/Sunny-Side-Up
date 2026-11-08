'use dom';

// A5: shows one drawing from the prototype's art module, exactly as the prototype draws it
// (decorated eggs, fried eggs, the pan, the gift ...), including its idle CSS animations.
import type { DOMProps } from 'expo/dom';

import './art/art.css';

const CSS = `
  .art-fill { position: absolute; inset: 0; display: grid; place-items: center; }
  .art-fill > svg { width: 100%; height: 100%; display: block; overflow: visible; }
`;

export default function ArtView({ html, onPress }: { html: string; onPress?: () => Promise<void>; dom?: DOMProps }) {
  return (
    <>
      <style>{CSS}</style>
      <div className="art-fill" onClick={onPress ? () => void onPress() : undefined} dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
