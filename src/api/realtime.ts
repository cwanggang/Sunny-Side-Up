// supabase.channel(name) hands back the existing channel when that name is already in use, and adding
// callbacks to a subscribed channel throws ("cannot add `postgres_changes` callbacks ... after
// `subscribe()`"). A stack keeps the screens underneath mounted, so two screens can easily listen to the
// same thing at once: every hook instance gets its own channel name.
let seq = 0;

export const channelName = (base: string) => `${base}:${++seq}`;
