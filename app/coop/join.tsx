import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useJoinCoop } from '@/api';
import { Body, Button, Card, Egg, Screen, TextField } from '@/components';
import { colors, spacing, type } from '@/theme';

// Design v0.4 "type the coop code" (Developer B). Codes look like ABC-123 (older codes work too).
export default function JoinCoopScreen() {
  const join = useJoinCoop();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function go() {
    const raw = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.length < 6) return setErr('codes have 3 letters and 3 numbers');
    setErr(null);
    join.mutate({ code: raw }, { onSuccess: (c) => router.replace(`/circle/${c.id}/coop`) });
  }

  return (
    <Screen title="join a coop">
      <Card>
        <View style={styles.center}>
          <Egg size={80} swatch="shell" pattern="dots" />
          <Text style={styles.big}>type the coop code</Text>
        </View>
        <TextField
          label="coop code"
          value={code}
          onChangeText={setCode}
          placeholder="ABC-123"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          onSubmitEditing={go}
        />
        {err ? <Body error>{err}</Body> : null}
        {join.error ? <Body error>{/not found/i.test(join.error.message) ? "that code didn't match a coop" : join.error.message}</Body> : null}
        <Button label="enter" onPress={go} loading={join.isPending} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.sm },
  big: { ...type.title, color: colors.text },
});
