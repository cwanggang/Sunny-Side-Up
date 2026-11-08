import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { signInWithEmail, signUpWithEmail } from '@/api';
import { Button, Screen, TextField } from '@/components';
import { colors, type } from '@/theme';

// Baseline sign-in (A1.1 needs it to test auth; A1.5 finishes the screen).
// On success the auth gate in app/_layout.tsx moves you into the app.
export default function SignInScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'signUp';
  const canSubmit = email.trim().length > 3 && password.length >= 6;

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
    <Screen title={isSignUp ? 'Create account' : 'Sign in'}>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={isSignUp ? 'Password (6+ characters)' : 'Password'}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        textContentType={isSignUp ? 'newPassword' : 'password'}
        onSubmitEditing={() => canSubmit && submit()}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button label={isSignUp ? 'Create account' : 'Sign in'} onPress={submit} disabled={!canSubmit} loading={busy} />
      <Button
        variant="secondary"
        label={isSignUp ? 'I already have an account' : 'Create an account'}
        onPress={() => {
          setMode(isSignUp ? 'signIn' : 'signUp');
          setError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { ...type.body, color: colors.danger },
});
