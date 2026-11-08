// React Query provider for the whole app. Wrap the root layout in <ApiProvider>.
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

/** One client for the app's lifetime; auth.ts clears it on sign-out. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export function ApiProvider({ children }: { children: ReactNode }) {
  // React Native has no window focus events; refetch stale queries when the app returns to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
    return () => sub.remove();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
