import { useState } from 'react';
import { Animated, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signInWithEmail, signUpWithEmail } from '@/api';
import { Button, TextField } from '@/components';
import { FriedEgg } from '@/components/Egg';
import { colors, palette, radii, shadow, spacing, type } from '@/theme';

// Design v0.5 sign-in (A5.2, Developer B): the splash egg and "tap to come in", then email +
// password in an egg-white card (P0.8: no emails are sent). The auth gate in app/_layout.tsx
// moves you into the app on success.
export default function SignInScreen() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rise] = useState(() => new Animated.Value(0));

  const isSignUp = mode === 'signUp';
  const canSubmit = email.trim().length > 3 && password.length >= 6;

  function comeIn() {
    setOpen(true);
    Animated.spring(rise, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await (isSignUp ? signUpWithEmail : signInWithEmail)(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable accessibilityRole="button" accessibilityLabel="tap to come in" onPress={comeIn} disabled={open} style={styles.splash}>
            <FriedEgg size={open ? 130 : 220} />
            <Text style={[styles.word, open && { fontSize: 34 }]}>sunny side up</Text>
            {!open ? <Text style={styles.hint}>tap to come in</Text> : null}
          </Pressable>

          {open ? (
            <Animated.View
              style={[
                styles.card,
                { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }] },
              ]}
            >
              <Text style={styles.cardTitle}>{isSignUp ? 'make your account' : 'welcome back'}</Text>
              <TextField
                label="email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder="you@example.com"
              />
              <TextField
                label={isSignUp ? 'password (6+ characters)' : 'password'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                textContentType={isSignUp ? 'newPassword' : 'password'}
                onSubmitEditing={() => canSubmit && submit()}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label={isSignUp ? 'crack in' : 'come in'} onPress={submit} disabled={!canSubmit} loading={busy} />
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMode(isSignUp ? 'signIn' : 'signUp');
                  setError(null);
                }}
                style={styles.switch}
              >
                <Text style={styles.switchText}>{isSignUp ? 'i already have an account' : 'new here? make an account'}</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.xl },
  splash: { alignItems: 'center', gap: spacing.md },
  word: { ...type.display, fontSize: 44, color: colors.text, textAlign: 'center' },
  hint: { ...type.label, color: colors.textSecondary, marginTop: spacing.lg },
  card: { gap: spacing.md, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: colors.eggWhite, borderWidth: 2, borderColor: palette.ink, ...shadow.card },
  cardTitle: { ...type.title, color: colors.text, textAlign: 'center' },
  error: { ...type.body, color: colors.danger },
  switch: { alignItems: 'center', paddingVertical: spacing.sm },
  switchText: { ...type.caption, fontWeight: '700', color: colors.textSecondary, textDecorationLine: 'underline' },
});
