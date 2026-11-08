// The prototype's animation helpers (app.js `play` / `sleep` / `T`), copied as-is for DOM components.
// They use the browser's Web Animations API, which the iOS web view supports.

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const T = (ms: number) => (REDUCED ? 1 : ms);
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, T(ms)));

export interface PlayOptions {
  duration?: number;
  delay?: number;
  easing?: string;
  iterations?: number;
  /** Keep the final frame's styles after the animation (default true). */
  keep?: boolean;
}

const NOT_STYLES = new Set(['offset', 'easing', 'composite']);

/**
 * Writes the last keyframe onto the element's inline style, so the end state stays after the
 * animation is cancelled. The prototype used `commitStyles()`, which can throw in the iOS web view
 * (and sometimes in desktop browsers); the animation was then cancelled anyway and the element fell
 * back to its CSS default. That made splash letters, the Sunday yolk and the reaction emojis vanish.
 */
function keepLastFrame(el: Element, kf: Keyframe[]) {
  const last = kf[kf.length - 1];
  if (!last) return;
  const style = (el as HTMLElement).style as unknown as Record<string, string>;
  for (const [k, v] of Object.entries(last)) {
    if (NOT_STYLES.has(k) || v === null || v === undefined) continue;
    style[k] = String(v);
  }
}

export function play(el: Element | null | undefined, kf: Keyframe[], o: PlayOptions = {}): Promise<void> {
  if (!el) return Promise.resolve();
  const keep = o.keep !== false;
  const a = el.animate(kf, {
    duration: T(o.duration ?? 400),
    delay: T(o.delay ?? 0),
    easing: o.easing ?? 'cubic-bezier(.22,1,.36,1)',
    fill: 'both',
    iterations: o.iterations ?? 1,
  });
  return a.finished
    .then(() => {
      if (keep) keepLastFrame(el, kf);
      a.cancel();
    })
    .catch(() => {
      // cancelled by someone else: still leave the element in its end state
      if (keep) keepLastFrame(el, kf);
    });
}
