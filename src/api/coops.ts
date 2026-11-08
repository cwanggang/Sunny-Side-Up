// Design v0.4 hooks (Developer B): coops, profiles, gallery, daily. Backend: migration
// 20261108000900_design_v04.sql. Screens import these through @/api only.
import type { FactIdeasResponse } from '@shared/api';
import type { Database } from '@shared/database.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useUserId } from './auth';
import { getSupabase } from './client';
import { USE_MOCKS } from './config';
import { localDate } from './dates';
import { check, unwrap } from './errors';
import { newId } from './ids';
import { avatarPath, mediaUrlKey, uploadFile } from './storage';
import type { Mutation, Query } from './surface';

type Fn = Database['public']['Functions'];
type Tables = Database['public']['Tables'];

export type CoopSummary = Fn['coop_overview']['Returns'][number];
export type DailyDay = Fn['circle_daily']['Returns'][number];
export type GalleryPhoto = Tables['photos']['Row'];
export type FullProfile = Tables['profiles']['Row'];

export interface EggLook {
  swatch: string;
  pattern: string;
}
export interface Fact {
  k: string;
  v: string;
}
/** A person as friends see them (circle_profiles / event_profiles). */
export interface Person {
  id: string;
  name: string;
  username: string;
  avatarPath: string | null;
  egg: EggLook;
  facts: Fact[];
  birthday: string | null;
}

export const coopsKey = ['coops'] as const;
const peopleKey = ['people'] as const;
const myProfileKey = (id: string | null) => ['my-full-profile', id] as const;

/** "RMS482" -> "RMS-482" (older 8-character codes are shown as they are). */
export const formatCoopCode = (code: string) => (/^[A-Z]{3}\d{3}$/.test(code) ? `${code.slice(0, 3)}-${code.slice(3)}` : code);

export function inviteMessage(coop: { name: string; invite_code: string }): string {
  const code = coop.invite_code;
  return `come join "${coop.name}" on sunny side up 🍳\n\ntap: sunnysideup://join/${code}\n\nor open the app, add a coop, and type ${formatCoopCode(code)}`;
}

export function eggOf(json: unknown): EggLook {
  const e = json as Partial<EggLook> | null;
  return { swatch: typeof e?.swatch === 'string' ? e.swatch : 'butter', pattern: typeof e?.pattern === 'string' ? e.pattern : 'dots' };
}
export function factsOf(json: unknown): Fact[] {
  return Array.isArray(json)
    ? json.filter((f): f is Fact => !!f && typeof f.k === 'string' && typeof f.v === 'string')
    : [];
}

// ---------- coops ----------

export function useCoops(): Query<CoopSummary[]> {
  const userId = useUserId();
  return useQuery<CoopSummary[], Error>({
    queryKey: [...coopsKey, userId],
    enabled: !!userId && !USE_MOCKS,
    queryFn: async () => (unwrap(await getSupabase().rpc('coop_overview', { p_today: localDate() })) ?? []) as CoopSummary[],
  });
}

export function useCoop(circleId: string): CoopSummary | undefined {
  return useCoops().data?.find((c) => c.id === circleId);
}

export interface CreateCoopInput {
  name: string;
  description?: string;
  coverUri?: string | null;
}

/** "hatch!": creates the coop, then uploads its cover photo. Returns the new coop. */
export function useCreateCoop(): Mutation<CreateCoopInput, Tables['circles']['Row']> {
  const queryClient = useQueryClient();
  return useMutation<Tables['circles']['Row'], Error, CreateCoopInput>({
    mutationFn: async ({ name, description, coverUri }) => {
      const supabase = getSupabase();
      const circle = unwrap(await supabase.rpc('create_circle', { name, description: description || undefined })) as Tables['circles']['Row'];
      if (coverUri) {
        const path = `${circle.id}/cover-${newId()}.jpg`;
        await uploadFile(path, coverUri, 'image/jpeg');
        check(await supabase.from('circles').update({ cover_path: path }).eq('id', circle.id));
        circle.cover_path = path;
      }
      return circle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coopsKey });
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

/** Changes the coop's photo (the pencil on the home card). */
export function useSetCoopCover(): Mutation<{ circleId: string; uri: string }> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { circleId: string; uri: string }>({
    mutationFn: async ({ circleId, uri }) => {
      const path = `${circleId}/cover-${newId()}.jpg`;
      await uploadFile(path, uri, 'image/jpeg');
      check(await getSupabase().from('circles').update({ cover_path: path }).eq('id', circleId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coopsKey });
    },
  });
}

export function useJoinCoop(): Mutation<{ code: string }, Tables['circles']['Row']> {
  const queryClient = useQueryClient();
  return useMutation<Tables['circles']['Row'], Error, { code: string }>({
    mutationFn: async ({ code }) =>
      unwrap(await getSupabase().rpc('join_circle', { invite_code: code })) as Tables['circles']['Row'],
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coopsKey });
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

export function useLeaveCoop(): Mutation<{ circleId: string }> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { circleId: string }>({
    mutationFn: async ({ circleId }) => check(await getSupabase().rpc('leave_circle', { circle_id: circleId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coopsKey });
      queryClient.invalidateQueries({ queryKey: ['circles'] });
    },
  });
}

// ---------- people (everyone in my coops) ----------

/** Everyone in all my coops, with the coops they're in. Doubles as "contacts" for events. */
export function usePeople(): Query<{ people: Map<string, Person>; coopsOf: Map<string, string[]> }> {
  const userId = useUserId();
  return useQuery({
    queryKey: [...peopleKey, userId],
    enabled: !!userId && !USE_MOCKS,
    queryFn: async () => {
      const rows = unwrap(await getSupabase().from('circle_profiles').select('*'));
      const people = new Map<string, Person>();
      const coopsOf = new Map<string, string[]>();
      for (const r of rows) {
        if (!r.id) continue;
        if (!people.has(r.id)) {
          people.set(r.id, {
            id: r.id,
            name: r.display_name || r.username || 'friend',
            username: r.username ?? 'friend',
            avatarPath: r.avatar_path,
            egg: eggOf(r.egg_style),
            facts: factsOf(r.facts),
            birthday: r.birthday,
          });
        }
        if (r.circle_id) coopsOf.set(r.id, [...(coopsOf.get(r.id) ?? []), r.circle_id]);
      }
      return { people, coopsOf };
    },
  });
}

/** Members of one coop, me first, then by join date. */
export function useCoopPeople(circleId: string): Query<Person[]> {
  const userId = useUserId();
  return useQuery({
    queryKey: [...peopleKey, 'coop', circleId],
    enabled: !!circleId && !USE_MOCKS,
    queryFn: async () => {
      const rows = unwrap(await getSupabase().from('circle_profiles').select('*').eq('circle_id', circleId).order('joined_at'));
      const list = rows.filter((r) => !!r.id).map((r) => ({
        id: r.id!,
        name: r.display_name || r.username || 'friend',
        username: r.username ?? 'friend',
        avatarPath: r.avatar_path,
        egg: eggOf(r.egg_style),
        facts: factsOf(r.facts),
        birthday: r.birthday,
      }));
      return [...list.filter((p) => p.id === userId), ...list.filter((p) => p.id !== userId)];
    },
  });
}

// ---------- my profile ----------

export function useMyFullProfile(): Query<FullProfile> {
  const userId = useUserId();
  return useQuery<FullProfile, Error>({
    queryKey: myProfileKey(userId),
    enabled: !!userId && !USE_MOCKS,
    queryFn: async () => unwrap(await getSupabase().from('profiles').select('*').eq('id', userId!).single()),
  });
}

export interface SaveProfileInput {
  username?: string;
  display_name?: string;
  birthday?: string | null;
  facts?: Fact[];
  egg?: EggLook;
  photoUri?: string | null;
}

export function useSaveProfile(): Mutation<SaveProfileInput, FullProfile> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<FullProfile, Error, SaveProfileInput>({
    mutationFn: async ({ username, display_name, birthday, facts, egg, photoUri }) => {
      if (!userId) throw new Error('Not signed in');
      const patch: Tables['profiles']['Update'] = {};
      if (username !== undefined) patch.username = username.toLowerCase().replace(/[^a-z0-9._]/g, '');
      if (display_name !== undefined) patch.display_name = display_name;
      if (birthday !== undefined) patch.birthday = birthday || null;
      if (facts !== undefined) patch.facts = facts.map((f) => ({ k: f.k, v: f.v }));
      if (egg !== undefined) patch.egg_style = { ...egg };
      if (photoUri) {
        const path = avatarPath(userId);
        await uploadFile(path, photoUri, 'image/jpeg');
        patch.avatar_path = path;
      }
      const res = await getSupabase().from('profiles').update(patch).eq('id', userId).select('*').single();
      if (res.error?.code === '23505') throw new Error('that username is taken');
      if (res.error?.code === '23514') throw new Error('usernames use a-z, 0-9, . and _ (2 to 18)');
      return unwrap(res);
    },
    onSuccess: (p, { photoUri }) => {
      queryClient.setQueryData(myProfileKey(userId), p);
      if (photoUri) queryClient.invalidateQueries({ queryKey: mediaUrlKey(p.avatar_path) });
      queryClient.invalidateQueries({ queryKey: peopleKey });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['circle-members'] });
    },
  });
}

/** "suggest categories": Claude (or a built-in list) proposes fact categories I don't have yet. */
export function useFactIdeas(): Mutation<{ have: string[] }, FactIdeasResponse> {
  return useMutation<FactIdeasResponse, Error, { have: string[] }>({
    mutationFn: async ({ have }) => {
      const { data, error } = await getSupabase().functions.invoke<FactIdeasResponse>('fact-ideas', { body: { have } });
      if (error || !data) throw new Error(error?.message ?? 'no ideas right now');
      return data;
    },
  });
}

// ---------- daily ----------

export function useDaily(circleId: string): Query<DailyDay[]> {
  return useQuery<DailyDay[], Error>({
    queryKey: ['daily', circleId],
    enabled: !!circleId && !USE_MOCKS,
    queryFn: async () =>
      (unwrap(await getSupabase().rpc('circle_daily', { p_circle_id: circleId, p_today: localDate() })) ?? []) as DailyDay[],
  });
}

// ---------- gallery + photo picking ----------

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Several photos from the library (with sizes, for the masonry grid). Empty if cancelled. */
export async function pickPhotos(max = 12): Promise<PickedPhoto[]> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 0.6,
    exif: false,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, width: a.width || 1000, height: a.height || 1000 }));
}

export function useGallery(circleId: string): Query<GalleryPhoto[]> {
  return useQuery<GalleryPhoto[], Error>({
    queryKey: ['gallery', circleId],
    enabled: !!circleId && !USE_MOCKS,
    queryFn: async () =>
      unwrap(await getSupabase().from('photos').select('*').eq('circle_id', circleId).order('created_at', { ascending: false })),
  });
}

/** Uploads photos to the coop gallery, or to an event album (eventId). Returns how many were added. */
export function useAddPhotos(): Mutation<{ circleId: string; eventId?: string | null; photos: PickedPhoto[] }, number> {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation<number, Error, { circleId: string; eventId?: string | null; photos: PickedPhoto[] }>({
    mutationFn: async ({ circleId, eventId, photos }) => {
      if (!userId) throw new Error('Not signed in');
      let n = 0;
      for (const p of photos) {
        const id = newId();
        const path = eventId ? `events/${eventId}/${id}.jpg` : `${circleId}/${id}.jpg`;
        await uploadFile(path, p.uri, 'image/jpeg');
        check(
          await getSupabase().from('photos').insert({
            id, circle_id: circleId, event_id: eventId ?? null, author_id: userId, media_path: path,
            width: Math.round(p.width), height: Math.round(p.height),
          }),
        );
        n++;
      }
      return n;
    },
    onSuccess: (_, { circleId, eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['gallery', circleId] });
      if (eventId) queryClient.invalidateQueries({ queryKey: ['event-photos', eventId] });
    },
  });
}
