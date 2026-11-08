import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { eggStyleOf, useCircleMembers, useMediaUrl, useSession, useSundayEgg } from '@/api';
import SundayTile from '@/dom/SundayTile';
import type { SundayTileEgg, SundayTileState } from '@/dom/sundayTiles';

const artDom = { scrollEnabled: false, style: { backgroundColor: 'transparent' } } as const;

export type { SundayTileState };

interface Props {
  /** Width of the tile; the egg art is square at this width. */
  width: number;
  state: SundayTileState;
  groupName?: string | null;
  partner: { id: string; name: string; avatarPath?: string | null } | null;
  theirs?: SundayTileEgg | null;
  bare?: boolean;
  onCracked?: () => void;
  onRespond?: () => void;
  onOpen?: () => void;
  onWatch?: () => void;
}

/** The prototype's sunny sunday tile (crack it, your person, their egg, the frying pan, opened). */
export function SundayTileView({ width, state, groupName, partner, theirs, bare, onCracked, onRespond, onOpen, onWatch }: Props) {
  const photo = useMediaUrl(partner?.avatarPath ?? null);
  const person = useMemo(
    () => (partner ? { id: partner.id, name: partner.name, photoUrl: photo.data ?? null } : null),
    [partner?.id, partner?.name, photo.data], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const egg = useMemo(() => theirs ?? null, [theirs?.swatch, theirs?.pattern, theirs?.text]); // eslint-disable-line react-hooks/exhaustive-deps
  // art (square) + caption or the "tap to respond" shell, + the coop name if shown
  const height = width + (bare ? 0 : 62) + (groupName && !bare ? 32 : 0);
  return (
    <View style={{ width, height }}>
      <SundayTile
        state={state}
        groupName={bare ? null : groupName}
        partner={person}
        theirs={egg}
        bare={bare}
        onCracked={onCracked ? async () => onCracked() : undefined}
        onRespond={onRespond ? async () => onRespond() : undefined}
        onOpen={onOpen ? async () => onOpen() : undefined}
        onWatch={onWatch ? async () => onWatch() : undefined}
        dom={artDom}
      />
    </View>
  );
}

// Which tiles have been cracked / opened this app run (UI-only state, like the prototype's).
const cracked = new Set<string>();
const opened = new Set<string>();
export const sundayUi = {
  isCracked: (key: string) => cracked.has(key),
  markCracked: (key: string) => void cracked.add(key),
  isOpened: (shareId: string) => opened.has(shareId),
  markOpened: (shareId: string) => void opened.add(shareId),
};

/** Everything a sunny sunday tile needs for one coop: its state, your person, their egg, actions. */
export function useSundayTile(circleId: string) {
  const { session } = useSession();
  const egg = useSundayEgg(circleId);
  const members = useCircleMembers(circleId);
  const e = egg.data ?? null;
  const nameOf = (userId: string | null) =>
    userId === session?.user.id ? 'you' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'your person').toLowerCase();
  const personOf = (userId: string | null) => {
    if (!userId) return null;
    const m = members.data?.find((x) => x.userId === userId);
    return { id: userId, name: nameOf(userId), avatarPath: m?.avatarPath ?? null };
  };
  const crackKey = e ? `${circleId}:${e.periodKey}` : '';
  let state: SundayTileState = 'N';
  if (e) {
    if (!e.iSent) state = sundayUi.isCracked(crackKey) ? 'B' : 'A';
    else if (!e.theirs) state = 'D';
    else state = sundayUi.isOpened(e.theirs.id) ? 'E' : 'C';
  }
  const partner = e ? personOf(state === 'A' || state === 'B' ? e.sendTo : (e.fromId ?? e.sendTo)) : null;
  const theirs = e?.theirs ? { ...eggStyleOf(e.theirs), text: e.theirs.body } : null;
  return {
    query: egg,
    egg: e,
    state,
    partner,
    theirs,
    nameOf,
    actions: {
      onCracked: () => sundayUi.markCracked(crackKey),
      onRespond: () => router.push(`/circle/${circleId}/respond`),
      onOpen: () => router.push(`/circle/${circleId}/reveal`),
      onWatch: () => router.push(`/circle/${circleId}/reveal?again=1`),
    },
  };
}
