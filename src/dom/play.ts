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

export function play(el: Element | null | undefined, kf: Keyframe[], o: PlayOptions = {}): Promise<void> {
  if (!el) return Promise.resolve();
  const a = el.animate(kf, {
    duration: T(o.duration ?? 400),
    delay: T(o.delay ?? 0),
    easing: o.easing ?? 'cubic-bezier(.22,1,.36,1)',
    fill: 'both',
    iterations: o.iterations ?? 1,
  });
  return a.finished
    .then(() => {
      if (o.keep !== false) {
        try {
          a.commitStyles();
        } catch {
          /* not rendered */
        }
      }
      a.cancel();
    })
    .catch(() => {});
}
