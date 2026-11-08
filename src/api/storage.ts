// Uploads to and signed URLs from the private `media` bucket (plan.md §4.1 storage).
import { MEDIA_BUCKET } from '@shared/api';
import { useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';

import { getSupabase } from './client';
import { toError } from './errors';
import type { Query } from './surface';

/**
 * Profile photo path. The storage policy (B0.3) lets the owner write `avatars/{user_id}/*`
 * and circle-mates read it. Proposed by Developer B; to be recorded in plan §4.1 as a contract change.
 */
export const avatarPath = (userId: string) => `avatars/${userId}/photo.jpg`;

/** Uploads a local file (file:// URI) to `path`, replacing anything already there. */
export async function uploadFile(path: string, localUri: string, contentType: string): Promise<void> {
  const bytes = await new File(localUri).arrayBuffer();
  const { error } = await getSupabase().storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (error) throw toError(error);
}

const SIGNED_URL_SECONDS = 60 * 60;

export const mediaUrlKey = (path: string | null) => ['media-url', path] as const;

/** Signed URL for a media path, cached for most of its lifetime. */
export function useMediaUrl(path: string | null): Query<string> {
  return useQuery<string, Error>({
    queryKey: mediaUrlKey(path),
    enabled: !!path,
    staleTime: (SIGNED_URL_SECONDS - 10 * 60) * 1000,
    gcTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().storage.from(MEDIA_BUCKET).createSignedUrl(path!, SIGNED_URL_SECONDS);
      if (error) throw toError(error);
      return data.signedUrl;
    },
  });
}
