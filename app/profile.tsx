import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { eggOf, factsOf, useFactIdeas, useMyFullProfile, usePhotoPicker, useSaveProfile, useSession, type Fact, type FullProfile } from '@/api';
import { Body, Button, Chip, Egg, EggStylePicker, Screen, TextField } from '@/components';
import { Avatar, EggButton, Section } from '@/components/Coop';
import { colors, palette, radii, shadow, spacing, type } from '@/theme';

// Design v0.4 "your profile" (Developer B): photo, @username, name, birthday, "about me" facts
// (with Claude-suggested categories), and the egg friends see in their cartons.
export default function ProfileScreen() {
  const profile = useMyFullProfile();
  if (!profile.data) {
    return (
      <Screen title="your profile">
        {profile.error ? <Body error>{profile.error.message}</Body> : <Body muted>loading…</Body>}
      </Screen>
    );
  }
  return <ProfileForm key={profile.data.id} p={profile.data} />;
}

function ProfileForm({ p }: { p: FullProfile }) {
  const { session } = useSession();
  const myId = session?.user.id ?? '';
  const save = useSaveProfile();
  const pick = usePhotoPicker();

  const [username, setUsername] = useState(p.username);
  const [name, setName] = useState(p.display_name);
  const [bday, setBday] = useState(p.birthday ?? '');
  const [facts, setFacts] = useState<Fact[]>(() => factsOf(p.facts));
  const [egg, setEgg] = useState(() => eggOf(p.egg_style));
  const [photo, setPhoto] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'fact' | 'egg' | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    (username !== p.username ||
      name !== p.display_name ||
      bday !== (p.birthday ?? '') ||
      JSON.stringify(facts) !== JSON.stringify(factsOf(p.facts)) ||
      JSON.stringify(egg) !== JSON.stringify(eggOf(p.egg_style)) ||
      !!photo);

  function doSave() {
    if (bday && !/^\d{4}-\d{2}-\d{2}$/.test(bday)) return;
    save.mutate(
      { username, display_name: name, birthday: bday || null, facts, egg, photoUri: photo },
      {
        onSuccess: () => {
          setPhoto(null);
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        },
      },
    );
  }

  return (
    <Screen title="your profile">
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="change your profile picture"
          onPress={async () => {
            const uri = await pick().catch(() => null);
            if (uri) setPhoto(uri);
          }}
        >
          <Avatar person={{ avatarPath: photo ? null : p.avatar_path, egg, username }} size={96} />
          <Text style={styles.edit}>{photo ? 'new photo ✓' : 'change photo'}</Text>
        </Pressable>
        <View style={styles.handle}>
          <Text style={styles.at}>@</Text>
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            maxLength={18}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.handleInput}
            accessibilityLabel="username"
          />
        </View>
      </View>

      <TextField label="name" value={name} onChangeText={setName} maxLength={30} />
      <TextField label="birthday (yyyy-mm-dd)" value={bday} onChangeText={setBday} keyboardType="numbers-and-punctuation" placeholder="2001-11-18" />

      <Section title="about me" />
      {facts.length === 0 ? <Body muted>nothing yet</Body> : null}
      {facts.map((f, i) => (
        <View key={`${f.k}-${i}`} style={styles.fact}>
          <Text style={styles.factK}>{f.k}</Text>
          <TextInput
            value={f.v}
            onChangeText={(v) => setFacts((l) => l.map((x, j) => (j === i ? { ...x, v } : x)))}
            maxLength={60}
            style={styles.factV}
            accessibilityLabel={f.k}
          />
          <Pressable accessibilityRole="button" accessibilityLabel={`remove ${f.k}`} onPress={() => setFacts((l) => l.filter((_, j) => j !== i))} hitSlop={8}>
            <Text style={styles.x}>✕</Text>
          </Pressable>
        </View>
      ))}
      <Button variant="secondary" label="+ add a fact" onPress={() => setSheet('fact')} disabled={facts.length >= 12} />

      {save.error ? <Body error>{save.error.message}</Body> : null}
      <Button label={saved ? 'saved ✓' : 'save'} onPress={doSave} disabled={!dirty} loading={save.isPending} />

      <Text style={styles.note}>friends see all of this when they crack your egg in a carton.</Text>
      <Button variant="secondary" label="see what they see" onPress={() => router.push(`/member/${myId}`)} />

      <EggButton label="customize egg" icon="🥚" onPress={() => setSheet('egg')} />

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.scrim} onPress={() => setSheet(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {sheet === 'egg' ? (
              <>
                <Text style={styles.sheetTitle}>customize your egg</Text>
                <Text style={styles.note}>this is the egg that sits in your friends&apos; cartons.</Text>
                <View style={styles.center}>
                  <Egg size={110} swatch={egg.swatch} pattern={egg.pattern} text={username} />
                </View>
                <EggStylePicker swatch={egg.swatch} pattern={egg.pattern} onChange={setEgg} />
                <Button label="done" onPress={() => setSheet(null)} />
              </>
            ) : sheet === 'fact' ? (
              <AddFact
                have={facts.map((f) => f.k)}
                onAdd={(f) => {
                  setFacts((l) => [...l, f]);
                  setSheet(null);
                }}
                onCancel={() => setSheet(null)}
              />
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

/** Write your own category, or ask Claude for ideas (falls back to a built-in list). */
function AddFact({ have, onAdd, onCancel }: { have: string[]; onAdd: (f: Fact) => void; onCancel: () => void }) {
  const ideas = useFactIdeas();
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  return (
    <>
      <Text style={styles.sheetTitle}>add a fact</Text>
      <TextField label="category" value={k} onChangeText={setK} maxLength={30} placeholder="e.g. comfort food" autoCapitalize="none" />
      <TextField label="your answer" value={v} onChangeText={setV} maxLength={60} placeholder="type your answer" />
      <Chip label={ideas.isPending ? 'thinking…' : ideas.data ? '✨ more ideas' : '✨ suggest categories'} onPress={() => ideas.mutate({ have })} disabled={ideas.isPending} />
      {ideas.data ? (
        <>
          <View style={styles.chips}>
            {ideas.data.ideas.map((x) => (
              <Chip key={x} label={x} selected={x === k} onPress={() => setK(x)} />
            ))}
          </View>
          <Text style={styles.note}>{ideas.data.source === 'claude' ? 'ideas from claude. tap one to use it.' : 'tap one to use it.'}</Text>
        </>
      ) : null}
      {ideas.error ? <Body error>{ideas.error.message}</Body> : null}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button variant="secondary" label="cancel" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="add" disabled={!k.trim() || !v.trim()} onPress={() => onAdd({ k: k.trim().toLowerCase(), v: v.trim() })} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: spacing.sm },
  edit: { ...type.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  handle: { flexDirection: 'row', alignItems: 'center' },
  at: { ...type.title, color: colors.textMuted },
  handleInput: { ...type.title, color: colors.text, minWidth: 80 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: colors.surface, ...shadow.card },
  factK: { ...type.label, color: colors.textSecondary, width: 110 },
  factV: { flex: 1, ...type.body, color: colors.text },
  x: { ...type.body, color: colors.textMuted },
  note: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.xxl, borderTopWidth: 1, borderColor: palette.line },
  sheetTitle: { ...type.title, color: colors.text },
  center: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
});
