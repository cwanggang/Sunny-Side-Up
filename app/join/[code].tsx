import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import { rememberInviteCode, useJoinCircle, useSession } from '@/api';
import { Body, Button, Screen } from '@/components';

// A1.4: opened by an invite link, sunnysideup://join/<code>.
// Signed in: join and go to the circle. Signed out: remember the code, sign in, then come back here.
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useSession();
  const join = useJoinCircle();
  const started = useRef(false);

  useEffect(() => {
    if (!session || !code || started.current) return;
    started.current = true;
    join.mutate({ invite_code: code }, { onSuccess: (circle) => router.replace(`/circle/${circle.id}`) });
  }, [session, code, join]);

  if (!session) {
    if (code) rememberInviteCode(code);
    return <Redirect href="/sign-in" />;
  }

  return (
    <Screen title="Joining circle">
      {join.error ? (
        <>
          <Body error>Couldn&apos;t join with code {code}: {join.error.message}</Body>
          <Button label="Go to my circles" onPress={() => router.replace('/circles')} />
        </>
      ) : (
        <Body muted>Joining with code {code}…</Body>
      )}
    </Screen>
  );
}
