// Mock auth (A1.1): starts signed in; sign out / sign in toggle a local flag so the
// auth gate and sign-in screen can be exercised with EXPO_PUBLIC_USE_MOCKS=true.
import type { Session } from '@/api/types';
import { useSyncExternalStore } from 'react';

export const MOCK_USER_ID = 'u-caden';

const session = { user: { id: MOCK_USER_ID, email: 'caden190wang@gmail.com' }, access_token: 'mock' } as unknown as Session;

let signedIn = true;
let isNewAccount = false;
const listeners = new Set<() => void>();
const setSignedIn = (value: boolean, isNew = false) => {
  signedIn = value;
  isNewAccount = isNew;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 250));

export function useSession() {
  const isIn = useSyncExternalStore(subscribe, () => signedIn);
  return { session: isIn ? session : null, loading: false, isNewAccount };
}

export async function signUpWithEmail(): Promise<void> {
  await wait();
  setSignedIn(true, true);
}

export async function signInWithEmail(): Promise<void> {
  await wait();
  setSignedIn(true);
}

export async function signOut(): Promise<void> {
  await wait();
  setSignedIn(false);
}
