import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { pickPhotos, useAddPhotos, useAlbumCounts, useCoop, useCoopPeople, useDaily, useEvents, useGallery, useMediaUrlMap, useSession } from '@/api';
import { afterReply } from '@/dom/defer';
import GalleryPage from '@/dom/GalleryPage';
import { colors } from '@/theme';

/** A coop's gallery or daily page. */
export function GalleryScreen({ circleId, page }: { circleId: string; page: 'gallery' | 'daily' }) {
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const coop = useCoop(circleId);
  const peopleQ = useCoopPeople(circleId);
  const galleryQ = useGallery(circleId);
  const dailyQ = useDaily(circleId);
  const albumsQ = useAlbumCounts(circleId);
  const eventsQ = useEvents(circleId);
  const add = useAddPhotos();

  const albumRows = useMemo(() => [...(albumsQ.data?.entries() ?? [])], [albumsQ.data]);
  const urls = useMediaUrlMap([
    ...(peopleQ.data ?? []).map((p) => p.avatarPath),
    ...(galleryQ.data ?? []).map((p) => p.media_path),
    ...(dailyQ.data ?? []).map((d) => d.media_path),
    ...albumRows.map(([, a]) => a.cover),
  ]);

  const people = useMemo(
    () => Object.fromEntries((peopleQ.data ?? []).map((p) => [p.id, { id: p.id, username: p.username, photoUrl: p.avatarPath ? (urls[p.avatarPath] ?? null) : null }])),
    [peopleQ.data, urls],
  );
  const photos = useMemo(
    () => (galleryQ.data ?? []).filter((p) => !p.event_id).map((p) => ({ url: urls[p.media_path] ?? null, ar: p.width && p.height ? p.width / p.height : 1, by: p.author_id })),
    [galleryQ.data, urls],
  );
  const albums = useMemo(
    () =>
      albumRows.map(([id, a]) => ({
        id,
        title: eventsQ.data?.find((e) => e.id === id)?.title ?? 'event',
        coverUrl: urls[a.cover] ?? null,
        count: a.count,
      })),
    [albumRows, eventsQ.data, urls],
  );
  const daily = useMemo(
    () =>
      (dailyQ.data ?? []).map((d) => ({
        day: d.day,
        by: d.user_id,
        posted: d.posted,
        url: d.media_path ? (urls[d.media_path] ?? null) : null,
        time: d.posted_at ? new Date(d.posted_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).toLowerCase() : '',
        prompt: d.prompt,
      })),
    [dailyQ.data, urls],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GalleryPage
        top={insets.top}
        page={page}
        coopName={coop?.name ?? ''}
        me={myId}
        people={people}
        photos={photos}
        albums={albums}
        daily={daily}
        streak={coop?.streak ?? 0}
        onBack={async () => afterReply(() => router.back())}
        onAlbum={async (id) => router.push(`/event/${id}?tab=gallery`)}
        onAddPhotos={async () => {
          const picked = await pickPhotos(12);
          if (!picked.length) return null;
          const n = await add.mutateAsync({ circleId, photos: picked });
          return `added ${n} ${n === 1 ? 'photo' : 'photos'}`;
        }}
        onAddToday={async () => router.push(`/camera?circleId=${circleId}`)}
        dom={{ scrollEnabled: false, contentInsetAdjustmentBehavior: 'never', style: { flex: 1, backgroundColor: colors.background } }}
      />
    </View>
  );
}
