import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useMediaUrl, useMyProfile, usePhotoPicker, useUpdateProfile, type Profile } from '@/api';
import { Body, Button, Screen, TextField } from '@/components';
import { colors, spacing } from '@/theme';

const BIRTHDAY = /^\d{4}-\d{2}-\d{2}$/;

function isValidBirthday(value: string): boolean {
  if (!BIRTHDAY.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) && d < new Date();
}

// A1.5 profile setup: name, photo, optional birthday. Also saves the phone's time zone,
// which the server uses to time Sunday shares and reminders.
export default function ProfileSetupScreen() {
  const profile = useMyProfile();
  if (profile.data) return <ProfileForm initial={profile.data} />;
  return (
    <Screen title="Your profile">
      {profile.error ? <Body error>Couldn&apos;t load your profile: {profile.error.message}</Body> : <Body muted>Loading…</Body>}
    </Screen>
  );
}

function ProfileForm({ initial }: { initial: Profile }) {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const update = useUpdateProfile();
  const pickPhoto = usePhotoPicker();
  const savedPhoto = useMediaUrl(initial.avatar_path);

  const [name, setName] = useState(initial.display_name);
  const [birthday, setBirthday] = useState(initial.birthday ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function choosePhoto() {
    try {
      const uri = await pickPhoto({ square: true });
      if (uri) setPhotoUri(uri);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    }
  }

  function save() {
    const trimmed = name.trim();
    const bday = birthday.trim();
    if (!trimmed) return setFormError('Please enter your name.');
    if (bday && !isValidBirthday(bday)) return setFormError('Birthday should look like 2004-03-14.');
    setFormError(null);
    update.mutate(
      {
        display_name: trimmed,
        birthday: bday || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        avatarUri: photoUri ?? undefined,
      },
      {
        onSuccess: () => {
          setPhotoUri(null);
          if (onboarding) router.replace('/circles');
          else router.back();
        },
      },
    );
  }

  const shownPhoto = photoUri ?? savedPhoto.data ?? null;

  return (
    <Screen title="Your profile">
      <View style={styles.photoRow}>
        {shownPhoto ? (
          <Image source={{ uri: shownPhoto }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoEmpty]} />
        )}
        <View style={styles.photoButton}>
          <Button variant="secondary" label={shownPhoto ? 'Change photo' : 'Add a photo'} onPress={choosePhoto} />
        </View>
      </View>

      <TextField label="Your name (what friends see)" value={name} onChangeText={setName} autoComplete="name" />
      <TextField
        label="Birthday (optional, YYYY-MM-DD)"
        value={birthday}
        onChangeText={setBirthday}
        placeholder="2004-03-14"
        keyboardType="numbers-and-punctuation"
        autoComplete="birthdate-full"
      />
      <Body muted>Your circle sees your birthday so they can celebrate it. You can leave it blank.</Body>

      {formError ? <Body error>{formError}</Body> : null}
      {update.error ? <Body error>Couldn&apos;t save: {update.error.message}</Body> : null}
      <Button
        label={onboarding ? 'Done' : 'Save'}
        onPress={save}
        loading={update.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  photo: { width: 88, height: 88, borderRadius: 44 },
  photoEmpty: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  photoButton: { flex: 1 },
});
