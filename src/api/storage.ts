// Uploads to and signed URLs from the private `media` bucket (plan.md §4.1 storage).
import { MEDIA_BUCKET } from '@shared/api';
import { useQueries, useQuery } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { useMemo } from 'react';

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

/** A local file as a data: URL, so a DOM component can show a photo that hasn't been uploaded yet. */
export function localImageDataUrl(localUri: string): Promise<string> {
  return new File(localUri).base64().then((b) => `data:image/jpeg;base64,${b}`);
}

/** Signed URLs for several media paths at once (path → url; missing until loaded). Shares useMediaUrl's cache. */
export function useMediaUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const results = useQueries({
    queries: unique.map((path) => ({
      queryKey: mediaUrlKey(path),
      staleTime: (SIGNED_URL_SECONDS - 10 * 60) * 1000,
      gcTime: (SIGNED_URL_SECONDS - 5 * 60) * 1000,
      queryFn: async () => {
        const { data, error } = await getSupabase().storage.from(MEDIA_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
        if (error) throw toError(error);
        return data.signedUrl;
      },
    })),
  });
  const out: Record<string, string> = {};
  unique.forEach((p, i) => {
    const url = results[i]?.data;
    if (url) out[p] = url;
  });
  return out;
}

/** useMediaUrls, keeping the same object while nothing changed (so memoized DOM props stay put). */
export function useMediaUrlMap(paths: (string | null | undefined)[]): Record<string, string> {
  const urls = useMediaUrls(paths);
  const key = JSON.stringify(urls);
  return useMemo(() => JSON.parse(key) as Record<string, string>, [key]);
}
