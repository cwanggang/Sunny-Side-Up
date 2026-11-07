// Design tokens. Plain defaults until Phase 5 (A5.1 replaces these values with the designs).
// All styling in components and screens reads from here so the design pass is one swap.

export const colors = {
  background: '#FFFFFF',
  surface: '#F4F4F5',
  text: '#111111',
  textMuted: '#6B6B6B',
  border: '#E2E2E2',
  primary: '#1F6FEB',
  primaryText: '#FFFFFF',
  danger: '#C62828',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radii = {
  sm: 6,
  md: 10,
} as const;

export const type = {
  title: { fontSize: 22, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;
