import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Share } from 'react-native';

import { useCircle, useCircleMembers, useInviteLink, useLeaveCircle, useSession } from '@/api';
import { Body, Button, Heading, ListItem, Screen } from '@/components';

const sections = [
  { title: 'Feed', path: 'feed' },
  { title: 'Send something', path: 'compose' },
  { title: 'Sunday share', path: 'sunday' },
  { title: 'Spotlight', path: 'spotlight' },
  { title: 'Birthdays & moments', path: 'birthdays' },
  { title: 'Hangout ideas', path: 'hangouts' },
] as const;

// A1.5 circle detail: members, invite share sheet, home area, and links into the circle.
export default function CircleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const circle = useCircle(id);
  const members = useCircleMembers(id);
  const invite = useInviteLink(id);
  const leave = useLeaveCircle();

  function confirmLeave() {
    Alert.alert('Leave this circle?', 'You can rejoin later with an invite code.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leave.mutate({ circleId: id }, { onSuccess: () => router.replace('/circles') }),
      },
    ]);
  }

  return (
    <Screen title={circle.data?.name ?? 'Circle'}>
      {circle.error ? <Body error>Couldn&apos;t load this circle: {circle.error.message}</Body> : null}
      {circle.data ? <Body muted>Home area: {circle.data.home_area ?? 'not set'}</Body> : null}

      {sections.map((s) => (
        <ListItem key={s.path} title={s.title} onPress={() => router.push(`/circle/${id}/${s.path}`)} />
      ))}

      <Heading>Invite friends</Heading>
      {invite ? (
        <>
          <Body>
            Invite code: <Body muted>{invite.code}</Body>
          </Body>
          <Button label="Share invite" onPress={() => Share.share({ message: invite.message })} />
        </>
      ) : null}

      <Heading>Members{members.data ? ` (${members.data.length})` : ''}</Heading>
      {members.error ? <Body error>{members.error.message}</Body> : null}
      {members.data?.map((m) => (
        <ListItem
          key={m.userId}
          title={m.userId === session?.user.id ? `${m.displayName} (you)` : m.displayName}
          subtitle={m.role === 'owner' ? 'Owner' : undefined}
        />
      ))}

      {leave.error ? <Body error>{leave.error.message}</Body> : null}
      <Button variant="danger" label="Leave circle" onPress={confirmLeave} loading={leave.isPending} />
    </Screen>
  );
}
