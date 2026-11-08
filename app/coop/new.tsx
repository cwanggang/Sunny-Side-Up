import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { formatCoopCode, inviteMessage, usePhotoPicker, useCreateCoop } from '@/api';
import { Body, Button, Card, Egg, PhotoThumb, Screen, TextField } from '@/components';
import { colors, radii, spacing, type } from '@/theme';

// Design v0.4 "new coop" (Developer B): photo, name, description, then hatch! -> the coop code + invite.
export default function NewCoopScreen() {
  const pick = usePhotoPicker();
  const create = useCreateCoop();
  const [cover, setCover] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hatched = create.data;

  if (hatched) {
    return (
      <Screen title="hatched!">
        <Card>
          <View style={styles.center}>
            <Egg size={90} swatch="butter" pattern="dots" />
            <Text style={styles.big}>{hatched.name} is hatched!</Text>
            <Text style={styles.label}>coop code</Text>
            <Text style={styles.code}>{formatCoopCode(hatched.invite_code)}</Text>
            <Button label="share invite" onPress={() => void Share.share({ message: inviteMessage(hatched) })} />
            <Button variant="secondary" label="done" onPress={() => router.replace(`/circle/${hatched.id}/coop`)} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title="new coop">
      <View style={styles.center}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="add a coop photo"
          onPress={async () => {
            try {
              const uri = await pick();
              if (uri) setCover(uri);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            }
          }}
          style={styles.pic}
        >
          {cover ? <PhotoThumb uri={cover} size={120} /> : <Text style={styles.plus}>+</Text>}
        </Pressable>
        <Text style={styles.label}>add a coop photo</Text>
      </View>
      <TextField label="coop name" value={name} onChangeText={setName} maxLength={24} placeholder="enter text here" />
      <TextField label="description" value={desc} onChangeText={setDesc} maxLength={120} multiline placeholder="what's this coop about?" />
      {error ? <Body error>{error}</Body> : null}
      {create.error ? <Body error>couldn&apos;t hatch it: {create.error.message}</Body> : null}
      <Button
        label="hatch!"
        disabled={!name.trim()}
        loading={create.isPending}
        onPress={() => create.mutate({ name: name.trim(), description: desc.trim(), coverUri: cover })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  pic: { width: 120, height: 120, borderRadius: radii.xl, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  plus: { ...type.display, color: colors.textMuted },
  label: { ...type.label, color: colors.textSecondary },
  big: { ...type.title, color: colors.text, textAlign: 'center' },
  code: { ...type.display, letterSpacing: 2, color: colors.text },
});
