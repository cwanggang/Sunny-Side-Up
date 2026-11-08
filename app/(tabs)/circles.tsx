import { router } from 'expo-router';
import { useState } from 'react';

import { useCreateCircle, useJoinCircle, useMyCircles } from '@/api';
import { Body, Button, Heading, ListItem, Screen, TextField } from '@/components';

// A1.5: my circles; create one; join by code.
export default function CirclesScreen() {
  const circles = useMyCircles();
  const create = useCreateCircle();
  const join = useJoinCircle();

  const [name, setName] = useState('');
  const [homeArea, setHomeArea] = useState('');
  const [code, setCode] = useState('');

  function onCreate() {
    create.mutate(
      { name: name.trim(), home_area: homeArea.trim() || null },
      {
        onSuccess: (circle) => {
          setName('');
          setHomeArea('');
          router.push(`/circle/${circle.id}`);
        },
      },
    );
  }

  function onJoin() {
    join.mutate(
      { invite_code: code.trim() },
      {
        onSuccess: (circle) => {
          setCode('');
          router.push(`/circle/${circle.id}`);
        },
      },
    );
  }

  return (
    <Screen title="Circles">
      {circles.isPending ? <Body muted>Loading…</Body> : null}
      {circles.error ? <Body error>Couldn&apos;t load circles: {circles.error.message}</Body> : null}
      {circles.data?.length === 0 ? <Body muted>You&apos;re not in a circle yet. Create one or join with a code.</Body> : null}
      {circles.data?.map((c) => (
        <ListItem
          key={c.id}
          title={c.name}
          subtitle={c.home_area ?? undefined}
          onPress={() => router.push(`/circle/${c.id}`)}
        />
      ))}

      <Heading>Join with a code</Heading>
      <TextField
        label="Invite code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABC123"
      />
      {join.error ? <Body error>{join.error.message}</Body> : null}
      <Button label="Join circle" onPress={onJoin} disabled={!code.trim()} loading={join.isPending} />

      <Heading>Start a circle</Heading>
      <TextField label="Circle name" value={name} onChangeText={setName} placeholder="Sunny Crew" />
      <TextField
        label="Home area (optional, used for hangout ideas)"
        value={homeArea}
        onChangeText={setHomeArea}
        placeholder="Durham, NC"
      />
      {create.error ? <Body error>{create.error.message}</Body> : null}
      <Button label="Create circle" onPress={onCreate} disabled={!name.trim()} loading={create.isPending} />
    </Screen>
  );
}
