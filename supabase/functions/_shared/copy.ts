// B2.2: push wording for each interaction kind ("Maya sent you an egg 🥚").
// Texts show the message body in the push, like any messaging app. Bodies are never analyzed.

export type InteractionKind = 'egg' | 'photo' | 'voice' | 'text';

const MAX_BODY = 140;
const clip = (s: string) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1)}…` : s);

export function interactionCopy(args: {
  kind: InteractionKind;
  senderName: string;
  circleName: string;
  directed: boolean;
  body?: string | null;
}): { title: string; body: string } {
  const who = args.senderName.trim() || 'Someone';
  const title = args.circleName;
  switch (args.kind) {
    case 'egg':
      return { title, body: args.directed ? `${who} sent you an egg 🥚` : `${who} sent everyone an egg 🥚` };
    case 'photo':
      return { title, body: args.directed ? `${who} sent you a photo 📷` : `${who} shared a photo 📷` };
    case 'voice':
      return { title, body: args.directed ? `${who} sent you a voice memo 🎙️` : `${who} shared a voice memo 🎙️` };
    case 'text': {
      const text = (args.body ?? '').trim();
      return { title, body: text ? `${who}: ${clip(text)}` : `${who} sent you a message` };
    }
  }
}
