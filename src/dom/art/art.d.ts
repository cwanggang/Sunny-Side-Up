// Types for the prototype's art module (art.js, copied verbatim). Every function returns SVG/HTML text.

export type Swatch = 'butter' | 'blush' | 'sky' | 'mint' | 'lilac' | 'peach' | 'shell' | 'cocoa';
export type Pattern = 'plain' | 'dots' | 'stripes' | 'zigzag' | 'checks' | 'hearts' | 'sparkles';

export interface EggOptions {
  swatch?: Swatch | string;
  pattern?: Pattern | string;
  /** Text written on the egg. */
  text?: string | null;
  /** Brown speckles (the uncracked Sunday egg). */
  speckle?: boolean;
  ty?: number;
  /** Shine stroke opacity (0 hides it). */
  shine?: number;
}

export interface FriedEggOptions {
  w: number;
  h: number;
  r: number;
  cx?: number;
  cy?: number;
  seed?: number;
  amp?: number;
  sx?: number;
  sy?: number;
  yx?: number;
  yy?: number;
  yr?: number;
  /** A PEOPLE key (or an id registered with setPhoto) drawn in place of the yolk. */
  face?: string | null;
  cls?: string;
  yolkCls?: string;
}

export interface AlbumenOptions {
  seed?: number;
  amp?: number;
  sx?: number;
  sy?: number;
  n?: number;
}

export interface ArtModule {
  eggSVG(opts?: EggOptions, part?: 'whole' | 'top' | 'bottom', cls?: string): string;
  friedEgg(o: FriedEggOptions): string;
  miniEgg(cls?: string): string;
  albumen(cx: number, cy: number, r: number, o?: AlbumenOptions, cls?: string): string;
  yolk(x: number, y: number, r: number, hi?: boolean): string;
  faceSVG(id: string, cls?: string): string;
  setPhoto(id: string, url: string | null): void;
  halfShell(): string;
  pan(): string;
  gift(): string;
  flameEgg(cls?: string): string;
  /** A person (PEOPLE key) talking in front of a backdrop ('kitchen', 'brunch', 'hike', 'beach', 'lilac'). */
  talkScene(id: string, back?: string, cls?: string): string;
  /** A drawn photo backdrop ('window', 'latte', 'sunset', 'kitchen', 'hike', 'beach', 'lilac', 'brunch'). */
  scene(name: string): string;
  faceG(id: string, x: number, y: number, r: number): string;
  fitR(cx: number, cy: number, pts: number[][], o: AlbumenOptions, pad?: number): number;
  blobPts(cx: number, cy: number, r: number, o: AlbumenOptions): number[][];
  smoothPath(pts: number[][]): string;
  rng(seed: number): () => number;
  openPath(pts: number[][]): string;
  f1(v: number): number;
  uid(prefix: string): string;
  EGG: string;
  esc(t: unknown): string;
  I: Record<string, string>;
}

export const Art: ArtModule;
export const FLAT: { white: string; yolk: string; yolkHi: string; ink: string; line: string };
export const PATTERNS: Pattern[];
export const PEOPLE: Record<string, { name: string; c: string; eyes: string; mouth: string; extra?: string }>;
export const SWATCHES: { id: Swatch; base: string; acc: string; ink: string }[];
export function OL(c?: string, w?: number): string;
