// A0.1: the one Supabase client. Only code under src/api imports this file.
import 'react-native-url-polyfill/auto';

import type { Database } from '@shared/database.types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

// expo-secure-store warns above ~2 KB per value, and a Supabase session (access +
// refresh token + user) can exceed that. Store each value in chunks plus a count.
const CHUNK_SIZE = 1800;
const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function removeItem(key: string): Promise<void> {
  const count = Number(await SecureStore.getItemAsync(countKey(key)));
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
  await SecureStore.deleteItemAsync(countKey(key));
}

const chunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(countKey(key));
    if (count === null) return null;
    const parts = await Promise.all(
      Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    return parts.some((p) => p === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await removeItem(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(countKey(key), String(count));
  },
  removeItem,
};

let client: SupabaseClient<Database> | null = null;

/** Lazily created so mock mode (EXPO_PUBLIC_USE_MOCKS=true) works without Supabase env vars. */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy .env.example to .env.local and fill them in, or set EXPO_PUBLIC_USE_MOCKS=true.',
    );
  }
  const created = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: chunkedSecureStore,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Supabase's React Native guidance: only refresh tokens while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') created.auth.startAutoRefresh();
    else created.auth.stopAutoRefresh();
  });
  client = created;
  return created;
}
