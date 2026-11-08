// Design tokens (A5.1), copied from the v0.5 interactive prototype's CSS (:root variables, fonts,
// radii, easing). Every component and screen styles from here, so the look changes in one place.
// Token names from earlier versions are kept (background, surface, text, primary, shadow.card ...)
// so existing screens pick up the design without code changes.
//
// The prototype is flat: no drop shadows, cards and inputs have a 1px `line` border, buttons are
// 50px pills (navy "solid", white "ghost", yellow "yolky"), switches are yolk when on.

export const palette = {
  bg: '#F7F5EF', // off-white paper (page background)
  bg2: '#ECEAE4', // slightly darker paper (inactive, inputs)
  grey: '#E6E4DE', // switch track off, photo placeholder
  card: '#FFFFFF',
  line: '#E2DED3', // 1px borders
  hair: '#EEEBE3', // dividers between rows
  eggLine: '#4D5263', // the one thin outline every egg is drawn with
  mustard: '#9C720E',
  red: '#D4553F',
  yolk: '#F2AE3D',
  yolkHi: '#FFE7A8',
  yolkDeep: '#D98F1C',
  beige: '#EDE4D3',
  ink: '#1F2945', // navy text, solid buttons
  ink2: '#4E576D',
  ink3: '#7A8194',
  coral: '#E9775A',
  pan: '#2E3443', // frying pan (illustrations)
  white: '#FFFFFF',
} as const;

export const colors = {
  background: palette.bg,
  surface: palette.card,
  surfaceAlt: palette.bg2,
  grey: palette.grey,
  text: palette.ink,
  textSecondary: palette.ink2,
  textMuted: palette.ink3,
  border: palette.line,
  hairline: palette.hair,
  eggLine: palette.eggLine,
  primary: palette.yolk,
  primaryDeep: palette.yolkDeep,
  primarySoft: palette.yolkHi,
  /** Text on a yolk background. */
  primaryText: palette.ink,
  /** The prototype's main button: navy with white text. */
  solid: palette.ink,
  solidText: palette.white,
  accent: palette.coral,
  danger: palette.red,
  eggWhite: palette.white,
  yolk: palette.yolk,
} as const;

/** Egg decoration swatches (shares.egg_style.swatch): the egg's base color. */
export const eggSwatches = {
  butter: '#FFE6A0',
  blush: '#FFD3DB',
  sky: '#D0E6FA',
  mint: '#CDEEDB',
  lilac: '#E5DBFB',
  peach: '#FFDCC4',
  shell: '#FBF6EC',
  cocoa: '#C98A5E',
} as const;
export type EggSwatch = keyof typeof eggSwatches;
/** Pattern color drawn on top of each swatch. */
export const eggAccents: Record<EggSwatch, string> = {
  butter: '#F0AE33',
  blush: '#EA7690',
  sky: '#5797D8',
  mint: '#47A877',
  lilac: '#8F72DD',
  peach: '#EE8546',
  shell: '#C49E73',
  cocoa: '#F6DDBD',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22, // the prototype's page gutter
  xxl: 32,
} as const;

export const radii = {
  sm: 10, // photos
  md: 14, // inputs, small buttons
  lg: 18, // cards, settings groups
  xl: 22,
  pill: 999,
} as const;

// ---------- type ----------
// Lexend, loaded in app/_layout.tsx. On iOS every weight is its own font, so weights are
// chosen by family name: use `weight('600')` (or a `type.*` token), never `fontWeight`.
export const fonts = {
  regular: 'Lexend_400Regular',
  medium: 'Lexend_500Medium',
  semibold: 'Lexend_600SemiBold',
  bold: 'Lexend_700Bold',
  /** Kept for older code: same as regular. */
  body: 'Lexend_400Regular',
} as const;

type Weight = '300' | '400' | '500' | '600' | '700' | '800' | '900' | 'normal' | 'bold';

/** `{ fontFamily }` for a weight. The prototype tops out at 600, so 700+ maps to semibold too. */
export function weight(w: Weight): { fontFamily: string } {
  if (w === '500') return { fontFamily: fonts.medium };
  if (w === '300' || w === '400' || w === 'normal') return { fontFamily: fonts.regular };
  return { fontFamily: fonts.semibold };
}

export const type = {
  /** Big page titles ("my coops"). */
  display: { fontFamily: fonts.medium, fontSize: 34, lineHeight: 36, letterSpacing: -0.7 },
  title: { fontFamily: fonts.semibold, fontSize: 23, lineHeight: 27 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 17 },
  /** Small section label ("notifications", "this week's prompt"). */
  label: { fontFamily: fonts.semibold, fontSize: 12.5, lineHeight: 15 },
  /** Button text. */
  button: { fontFamily: fonts.semibold, fontSize: 16 },
} as const;

// ---------- surfaces ----------
// The prototype has no drop shadows: a card is white with a 1px line border. `shadow.card` keeps
// its old name so every card in the app picks this up.
export const shadow = {
  card: { borderWidth: 1, borderColor: palette.line },
  /** Selected/active outline (2px yolk). */
  selected: { borderWidth: 2, borderColor: palette.yolk },
} as const;

// ---------- motion (for Reanimated / Animated) ----------
// cubic-bezier control points from the prototype's CSS.
export const easing = {
  spring: [0.34, 1.56, 0.64, 1],
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;
