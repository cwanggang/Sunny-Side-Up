import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { pickPhotos, useAddPhotos, useAlbumCounts, useCoop, useEvents, useGallery, useMediaUrl } from '@/api';
import { Body, Screen } from '@/components';
import { EggButton, Section } from '@/components/Coop';
import { Masonry } from '@/components/Gallery';
import { colors, radii, shadow, spacing, type } from '@/theme';

// Design v0.4 coop gallery (Developer B): event albums on top, then every photo in a portfolio grid.
export default function GalleryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const coop = useCoop(id);
  const gallery = useGallery(id);
  const events = useEvents(id);
  const albums = useAlbumCounts(id);
  const add = useAddPhotos();

  const loose = (gallery.data ?? []).filter((p) => !p.event_id);
  const withAlbums = (events.data ?? []).filter((e) => e.gallery_enabled && albums.data?.has(e.id));

  return (
    <Screen title={coop ? `${coop.name} · gallery` : 'gallery'} refreshing={gallery.isRefetching} onRefresh={() => void gallery.refetch()}>
      {withAlbums.length ? (
        <>
          <Section title="event albums" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albums}>
            {withAlbums.map((e) => {
              const a = albums.data!.get(e.id)!;
              return <Album key={e.id} title={e.title} count={a.count} cover={a.cover} onPress={() => router.push(`/event/${e.id}?tab=gallery`)} />;
            })}
          </ScrollView>
        </>
      ) : null}

      <Section title="all photos" right={<Text style={styles.count}>{loose.length} photos</Text>} />
      {gallery.error ? <Body error>{gallery.error.message}</Body> : null}
      {add.error ? <Body error>{add.error.message}</Body> : null}
      {loose.length ? <Masonry photos={loose} /> : <Body muted>no photos yet. tap the egg below to add some from your phone.</Body>}

      <EggButton
        label={add.isPending ? 'adding…' : 'add photos'}
        onPress={async () => {
          const picked = await pickPhotos();
          if (picked.length) add.mutate({ circleId: id, photos: picked });
        }}
      />
    </Screen>
  );
}

function Album({ title, count, cover, onPress }: { title: string; count: number; cover: string; onPress: () => void }) {
  const url = useMediaUrl(cover);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.album}>
      <View style={styles.aCover}>{url.data ? <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
      <Text style={styles.aTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.count}>
        {count} {count === 1 ? 'post' : 'posts'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  albums: { gap: spacing.md, paddingVertical: spacing.xs },
  album: { width: 140, gap: 2 },
  aCover: { width: 140, height: 140, borderRadius: radii.lg, backgroundColor: colors.surfaceAlt, overflow: 'hidden', ...shadow.card },
  aTitle: { ...type.body, fontWeight: '700', color: colors.text },
  count: { ...type.caption, color: colors.textMuted },
});
