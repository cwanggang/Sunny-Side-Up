import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useBirthdays, useCircleMembers, useCreateMoment, useMoments, useSession } from '@/api';
import { Body, Button, Heading, ListItem, Screen, TextField } from '@/components';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const pretty = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const inDays = (n: number) => (n === 0 ? 'today 🎂' : n === 1 ? 'tomorrow' : `in ${n} days`);

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// A3.5 birthdays and moments: upcoming birthdays, upcoming moments, and add one of my own moments.
export default function BirthdaysScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const birthdays = useBirthdays(id);
  const moments = useMoments(id);
  const members = useCircleMembers(id);
  const create = useCreateMoment();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const nameOf = (userId: string) =>
    userId === session?.user.id ? 'You' : (members.data?.find((m) => m.userId === userId)?.displayName ?? 'Friend');

  function addMoment() {
    const day = date.trim();
    if (!DATE.test(day) || Number.isNaN(Date.parse(day))) return setFormError('Date should look like 2026-11-10.');
    setFormError(null);
    create.mutate(
      { circleId: id, title, occursOn: day },
      {
        onSuccess: () => {
          setTitle('');
          setDate('');
        },
      },
    );
  }

  const refreshing = birthdays.isRefetching || moments.isRefetching;

  return (
    <Screen
      title="Birthdays & moments"
      refreshing={refreshing}
      onRefresh={() => {
        void birthdays.refetch();
        void moments.refetch();
      }}
    >
      <Heading>Birthdays</Heading>
      {birthdays.error ? <Body error>{birthdays.error.message}</Body> : null}
      {birthdays.data?.length === 0 ? <Body muted>No birthdays added yet. Add yours in your profile.</Body> : null}
      {birthdays.data?.map((b) => (
        <ListItem key={b.userId} title={nameOf(b.userId)} subtitle={`${pretty(b.nextOn)} · ${inDays(b.daysUntil)}`} />
      ))}

      <Heading>Coming up</Heading>
      {moments.error ? <Body error>{moments.error.message}</Body> : null}
      {moments.data?.length === 0 ? <Body muted>Nothing coming up. Got something big this week?</Body> : null}
      {moments.data?.map((m) => (
        <ListItem key={m.id} title={`${nameOf(m.user_id)}: ${m.title}`} subtitle={pretty(m.occurs_on)} />
      ))}

      <Heading>Add a moment</Heading>
      <Body muted>Something coming up for you, like an interview or a big game. Your circle gets a reminder that morning to cheer you on.</Body>
      <TextField label="What's happening?" value={title} onChangeText={setTitle} placeholder="Job interview" maxLength={80} />
      <TextField
        label="Date (YYYY-MM-DD)"
        value={date}
        onChangeText={setDate}
        placeholder={todayLocal()}
        keyboardType="numbers-and-punctuation"
      />
      {formError ? <Body error>{formError}</Body> : null}
      {create.error ? <Body error>{create.error.message}</Body> : null}
      <Button label="Add moment" onPress={addMoment} disabled={!title.trim() || !date.trim()} loading={create.isPending} />
    </Screen>
  );
}
