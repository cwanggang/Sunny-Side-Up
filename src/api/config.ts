import Constants from 'expo-constants';

// Runtime config from EXPO_PUBLIC_* env vars (see .env.example).
// Expo inlines these at build time only when accessed as `process.env.EXPO_PUBLIC_X` literally.

export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const DEMO_KEY = process.env.EXPO_PUBLIC_DEMO_KEY ?? '';

/** ENABLE_HEALTHKIT from app.config.ts (exposed as extra.healthkitEnabled). */
export const HEALTHKIT_ENABLED = Constants.expoConfig?.extra?.healthkitEnabled === true;
