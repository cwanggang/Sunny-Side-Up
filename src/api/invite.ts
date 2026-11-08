// A1.4 invite links. Expo Router opens sunnysideup://join/<code> as the app/join/[code] route,
// which joins right away when signed in. Signed out, that screen remembers the code here and
// sends you to sign-in; useInviteLinkHandler (mounted in the root layout) resumes the join after sign-in.
import { router } from 'expo-router';
import { useEffect } from 'react';

let rememberedCode: string | null = null;

export function rememberInviteCode(code: string): void {
  rememberedCode = code;
}

/** Built from either useSession (real or mock), so both modes share the remembered code. */
export function makeInviteLinkHandler(useSession: () => { session: unknown }) {
  return function useInviteLinkHandler(): void {
    const { session } = useSession();
    useEffect(() => {
      if (!session || !rememberedCode) return;
      const code = rememberedCode;
      rememberedCode = null;
      // Let the auth gate's own redirect settle first.
      const t = setTimeout(() => router.replace(`/join/${code}`), 0);
      return () => clearTimeout(t);
    }, [session]);
  };
}
