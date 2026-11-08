// Design tokens (A5.1, from the v0.3 low-fi prototype). Every component and screen styles from
// here, so the look changes in one place. Token names from the baseline are kept (background,
// surface, text, primary, ...) so existing screens pick up the design without code changes.

export const palette = {
  bg: '#D5DABE', // sage page background
  bg2: '#E5E8D5', // lighter sage (inputs, inactive)
  card: '#FFFFFF',
  ink: '#1F2945', // navy text
  ink2: '#4E576D',
  ink3: '#7A8194',
  line: '#C3C9AB',
  hair: '#ECEEE4',
  yolk: '#F2AE3D',
  yolkDeep: '#D98F1C',
  yolkHi: '#FFE7A8',
  coral: '#E9775A',
  pan: '#2E3443',
  white: '#FFFFFF',
} as const;

export const colors = {
  background: palette.bg,
  surface: palette.card,
  surfaceAlt: palette.bg2,
  text: palette.ink,
  textSecondary: palette.ink2,
  textMuted: palette.ink3,
  border: palette.line,
  hairline: palette.hair,
  primary: palette.yolk,
  primaryDeep: palette.yolkDeep,
  primarySoft: palette.yolkHi,
  primaryText: palette.ink,
  accent: palette.coral,
  danger: '#C2412D',
  eggWhite: palette.white,
  yolk: palette.yolk,
} as const;

/** Egg decoration swatches (shares.egg_style.swatch). */
export const eggSwatches = {
  shell: '#F3E6D0',
  blush: '#F6C9C0',
  mint: '#C6E5D2',
  butter: '#FBE3A2',
  sky: '#C9DDF0',
  lilac: '#DDD2F2',
} as const;
export type EggSwatch = keyof typeof eggSwatches;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

// iOS ships Avenir Next, the design's fallback for "Sen" (no font package or re-install needed).
export const fonts = {
  body: 'Avenir Next',
} as const;

export const type = {
  display: { fontFamily: fonts.body, fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontFamily: fonts.body, fontSize: 24, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontFamily: fonts.body, fontSize: 19, fontWeight: '700' },
  body: { fontFamily: fonts.body, fontSize: 16, fontWeight: '500' },
  caption: { fontFamily: fonts.body, fontSize: 13, fontWeight: '500' },
  /** Small label like "up next", "this week's prompt". */
  label: { fontFamily: fonts.body, fontSize: 11.5, fontWeight: '600', letterSpacing: 0.4 },
} as const;

export const shadow = {
  card: {
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
} as const;
