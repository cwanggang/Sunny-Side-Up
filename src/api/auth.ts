// A1.1: email + password auth against Supabase ("Confirm email" is off, plan P0.8),
// session restore on launch, and one shared session store for useSession().
import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';

import { getSupabase } from './client';
import { queryClient } from './provider';

export interface SessionState {
  session: Session | null;
  loading: boolean;
  /** True right after signUpWithEmail in this app run, so the app can show onboarding (A1.5). */
  isNewAccount: boolean;
}

let state: SessionState = { session: null, loading: true, isNewAccount: false };
let justSignedUp = false;
const listeners = new Set<() => void>();
let started = false;

function setState(next: SessionState) {
  state = next;
  listeners.forEach((l) => l());
}

/** Subscribes to Supabase auth once. INITIAL_SESSION restores the stored session on launch. */
function start() {
  if (started) return;
  started = true;
  try {
    getSupabase().auth.onAuthStateChange((event, session) => {
      // A different (or no) user must never see the previous user's cached data.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        justSignedUp = false;
      }
      setState({ session, loading: false, isNewAccount: justSignedUp });
    });
  } catch (e) {
    // Missing env vars: show the sign-in screen; signing in will surface the error.
    console.warn(e);
    setState({ session: null, loading: false, isNewAccount: false });
  }
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** The signed-in user's id, or null. For hooks inside src/api. */
export function useUserId(): string | null {
  return useSession().session?.user.id ?? null;
}

const clean = (email: string) => email.trim().toLowerCase();

export async function signUpWithEmail(email: string, password: string): Promise<void> {
  // Set before the call: SIGNED_IN fires inside signUp, before it resolves.
  justSignedUp = true;
  const { data, error } = await getSupabase().auth.signUp({ email: clean(email), password });
  if (error || !data.session) justSignedUp = false;
  if (error) throw error;
  if (!data.session) {
    // Happens only if "Confirm email" is on in Supabase Auth, or the email is already registered.
    throw new Error('No session returned. If you already have an account, sign in instead.');
  }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  justSignedUp = false;
  const { error } = await getSupabase().auth.signInWithPassword({ email: clean(email), password });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
}
