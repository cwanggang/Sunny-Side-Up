// A1.2: my profile and my consent settings (both self-only by RLS; rows created at signup by B1.1).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { unwrap } from './errors';
import { syncSignalsWithConsent } from './signals';
import { avatarPath, mediaUrlKey, uploadFile } from './storage';
import type { Mutation, Query } from './surface';
import type { Consent, ConsentUpdate, Profile, ProfileUpdate } from './types';

export const profileKey = (userId: string | null) => ['profile', userId] as const;
export const consentKey = (userId: string | null) => ['consent', userId] as const;

const PROFILE_COLUMNS = 'id, display_name, avatar_path, birthday, timezone, created_at';

export function useMyProfile(): Query<Profile> {
  const userId = useUserId();
  return useQuery<Profile, Error>({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () =>
      unwrap(await getSupabase().from('profiles').select(PROFILE_COLUMNS).eq('id', userId!).single()),
  });
}

export function useUpdateProfile(): Mutation<ProfileUpdate & { avatarUri?: string }, Profile> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, ProfileUpdate & { avatarUri?: string }>({
    mutationFn: async ({ avatarUri, ...patch }) => {
      if (!userId) throw new Error('Not signed in');
      if (avatarUri) {
        const path = avatarPath(userId);
        await uploadFile(path, avatarUri, 'image/jpeg');
        patch.avatar_path = path;
      }
      return unwrap(
        await getSupabase().from('profiles').update(patch).eq('id', userId).select(PROFILE_COLUMNS).single(),
      );
    },
    onSuccess: (profile, { avatarUri }) => {
      queryClient.setQueryData(profileKey(userId), profile);
      // Same path, new photo: drop the cached signed URL so it's fetched fresh.
      if (avatarUri) queryClient.invalidateQueries({ queryKey: mediaUrlKey(profile.avatar_path) });
      // My name/photo shows up in member lists.
      queryClient.invalidateQueries({ queryKey: ['circle-members'] });
    },
  });
}

export function useConsent(): Query<Consent> {
  const userId = useUserId();
  return useQuery<Consent, Error>({
    queryKey: consentKey(userId),
    enabled: !!userId,
    queryFn: async () => unwrap(await getSupabase().from('consents').select('*').eq('user_id', userId!).single()),
  });
}

export function useUpdateConsent(): Mutation<ConsentUpdate, Consent> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<Consent, Error, ConsentUpdate>({
    mutationFn: async (patch) => {
      if (!userId) throw new Error('Not signed in');
      return unwrap(await getSupabase().from('consents').update(patch).eq('user_id', userId).select('*').single());
    },
    onSuccess: (consent) => {
      queryClient.setQueryData(consentKey(userId), consent);
      // Start or stop on-phone collection to match (and forget location data if it was switched off).
      void syncSignalsWithConsent(consent)
        .catch((e) => console.warn('signal sync failed', e))
        .finally(() => queryClient.invalidateQueries({ queryKey: ['signal-status'] }));
    },
  });
}
