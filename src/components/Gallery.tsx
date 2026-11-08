// Design v0.4 gallery pieces (Developer B): masonry grid, photo viewer, month calendar.
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useMediaUrl } from '@/api';
import { colors, palette, radii, spacing, type, weight } from '@/theme';

export interface GridPhoto {
  id: string;
  media_path: string | null;
  width?: number | null;
  height?: number | null;
  caption?: string;
}

function Tile({ photo, onPress }: { photo: GridPhoto; onPress: () => void }) {
  const url = useMediaUrl(photo.media_path);
  const ratio = photo.width && photo.height ? photo.width / photo.height : 1;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={photo.caption ?? 'photo'} onPress={onPress} style={[styles.tile, { aspectRatio: ratio }]}>
      {url.data ? <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
    </Pressable>
  );
}

/** Two-column portfolio grid (keeps each photo's shape). Tapping opens the viewer. */
export function Masonry({ photos }: { photos: GridPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const cols: { p: GridPhoto; i: number }[][] = [[], []];
  const heights = [0, 0];
  photos.forEach((p, i) => {
    const h = p.width && p.height ? p.height / p.width : 1;
    const c = heights[0] <= heights[1] ? 0 : 1;
    cols[c].push({ p, i });
    heights[c] += h;
  });
  return (
    <>
      <View style={styles.masonry}>
        {cols.map((col, c) => (
          <View key={c} style={styles.col}>
            {col.map(({ p, i }) => (
              <Tile key={p.id} photo={p} onPress={() => setOpen(i)} />
            ))}
          </View>
        ))}
      </View>
      <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />
    </>
  );
}

export function Lightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: GridPhoto[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const p = index === null ? null : photos[index];
  const url = useMediaUrl(p?.media_path ?? null);
  return (
    <Modal visible={index !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lb}>
        <View style={styles.lbTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="close" onPress={onClose} style={styles.lbBtn}>
            <Text style={styles.lbBtnText}>✕</Text>
          </Pressable>
          <Text style={styles.lbCap}>
            {p?.caption ?? ''}
            {photos.length > 1 && index !== null ? `  ${index + 1} of ${photos.length}` : ''}
          </Text>
          <View style={{ width: 42 }} />
        </View>
        <View style={styles.lbImg}>{url.data ? <Image source={{ uri: url.data }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}</View>
        {photos.length > 1 && index !== null ? (
          <View style={styles.lbNav}>
            <Pressable accessibilityRole="button" accessibilityLabel="previous photo" onPress={() => onIndex((index - 1 + photos.length) % photos.length)} style={styles.lbBtn}>
              <Text style={styles.lbBtnText}>‹</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="next photo" onPress={() => onIndex((index + 1) % photos.length)} style={styles.lbBtn}>
              <Text style={styles.lbBtnText}>›</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DOW = ['s', 'm', 't', 'w', 't', 'f', 's'];
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Month grid with a dot on days that have events. */
export function MonthCalendar({
  month,
  onMonth,
  marked,
  selected,
  onSelect,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  marked: Set<string>;
  selected: string | null;
  onSelect: (day: string | null) => void;
}) {
  const y = month.getFullYear();
  const mo = month.getMonth();
  const first = new Date(y, mo, 1).getDay();
  const days = new Date(y, mo + 1, 0).getDate();
  const today = ymd(new Date());
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <View style={styles.cal}>
      <View style={styles.calHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="previous month" onPress={() => onMonth(new Date(y, mo - 1, 1))} style={styles.calNav}>
          <Text style={styles.calNavText}>‹</Text>
        </Pressable>
        <Text style={styles.calTitle}>
          {MONTHS[mo]} {y}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="next month" onPress={() => onMonth(new Date(y, mo + 1, 1))} style={styles.calNav}>
          <Text style={styles.calNavText}>›</Text>
        </Pressable>
      </View>
      <View style={styles.grid}>
        {DOW.map((d, i) => (
          <Text key={`d${i}`} style={styles.dow}>
            {d}
          </Text>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <View key={`e${i}`} style={styles.cell} />;
          const key = ymd(new Date(y, mo, d));
          const sel = key === selected;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${MONTHS[mo]} ${d}${marked.has(key) ? ', has events' : ''}`}
              onPress={() => onSelect(sel ? null : key)}
              style={[styles.cell, key === today && styles.today, sel && styles.sel]}
            >
              <Text style={[styles.dayNum, key < today && styles.past, sel && styles.selText]}>{d}</Text>
              {marked.has(key) ? <View style={[styles.dot, sel && { backgroundColor: colors.primaryText }]} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  masonry: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1, gap: spacing.sm },
  tile: { width: '100%', borderRadius: radii.md, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  lb: { flex: 1, backgroundColor: 'rgba(23,26,20,0.96)', paddingTop: 54, paddingBottom: 40 },
  lbTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg },
  lbCap: { ...type.caption, color: palette.white },
  lbBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lbBtnText: { ...type.heading, color: palette.white },
  lbImg: { flex: 1, margin: spacing.lg },
  lbNav: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  cal: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calTitle: { ...type.heading, color: colors.text },
  calNav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calNavText: { ...type.title, color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', ...type.label, color: colors.textMuted, paddingVertical: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  today: { borderWidth: 1.5, borderColor: colors.text },
  sel: { backgroundColor: colors.primary },
  dayNum: { ...type.body, color: colors.text },
  past: { color: colors.textMuted },
  selText: { ...weight('700') },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primaryDeep, position: 'absolute', bottom: 5 },
});
