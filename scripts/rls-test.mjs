// B1.5: RLS test against the hosted project, signing in as the seed users (supabase/seed.sql)
// with the public anon key, exactly like the app does.
//
//   cd scripts && npm install && npm run rls-test
//
// Needs scripts/.env with SUPABASE_URL and SUPABASE_ANON_KEY (see .env.example).
// Creates a few interactions/files and deletes them again at the end.
import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in scripts/.env');
  process.exit(2);
}

const PASSWORD = 'sunnyside-test';
const ID = {
  maya: '00000000-0000-4000-8000-000000000001',
  sam: '00000000-0000-4000-8000-000000000002',
  jordan: '00000000-0000-4000-8000-000000000003',
  riley: '00000000-0000-4000-8000-000000000005',
};
const SUNNY = '00000000-0000-4000-9000-000000000001';
const RILEYS = '00000000-0000-4000-9000-000000000002';

const client = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(name) {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email: `${name}@sunnyside.test`, password: PASSWORD });
  if (error) throw new Error(`sign in ${name}: ${error.message} (did you run supabase/seed.sql?)`);
  return c;
}

let pass = 0;
let fail = 0;
function check(label, ok, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `  -> ${detail}` : ''}`);
}
const denied = (res) => !!res.error || (Array.isArray(res.data) && res.data.length === 0);

const [maya, sam, jordan, riley] = await Promise.all(['maya', 'sam', 'jordan', 'riley'].map(signIn));
const anon = client();
const cleanup = [];

try {
  // ---- circles & membership ----
  let r = await maya.from('circles').select('id');
  check("Maya sees her circle(s), not Riley's", r.data?.some((c) => c.id === SUNNY) && !r.data.some((c) => c.id === RILEYS), JSON.stringify(r));
  r = await maya.from('circles').select('id').eq('id', RILEYS);
  check("Maya can't read Riley's circle", denied(r));
  r = await riley.from('circle_members').select('user_id').eq('circle_id', SUNNY);
  check("Riley can't list Sunny circle members", denied(r));
  r = await anon.from('circles').select('id');
  check('Signed-out client sees no circles', denied(r));
  r = await maya.from('circle_members').insert({ circle_id: RILEYS, user_id: ID.maya });
  check("Maya can't add herself to a circle directly", !!r.error);
  r = await maya.from('circles').update({ invite_code: 'HACKED00' }).eq('id', SUNNY);
  check("Maya can't change the invite code", !!r.error);

  // ---- profiles ----
  r = await maya.from('circle_profiles').select('*').eq('circle_id', SUNNY);
  check('circle_profiles shows 4 members', r.data?.length === 4, JSON.stringify(r.error ?? r.data?.length));
  check('circle_profiles has only safe fields', r.data && Object.keys(r.data[0] ?? {}).sort().join() === 'avatar_path,birthday,circle_id,display_name,id,joined_at,role');
  r = await riley.from('circle_profiles').select('id').eq('circle_id', SUNNY);
  check("Riley can't see Sunny members' profiles", denied(r));
  r = await maya.from('profiles').select('id');
  check('profiles base table: only self', r.data?.length === 1 && r.data[0].id === ID.maya);
  r = await maya.from('profiles').update({ id: ID.sam }).eq('id', ID.maya);
  check("Can't change own profile id", !!r.error);

  // ---- signals and server-only tables ----
  r = await maya.from('daily_signals').select('*');
  check("Maya can't read Sam's daily_signals", denied(r));
  r = await sam.from('daily_signals').select('*');
  check('Sam reads his own daily_signals', r.data?.length >= 1, JSON.stringify(r.error));
  for (const t of ['drift_scores', 'engagement_daily']) {
    r = await sam.from(t).select('*');
    check(`${t} hidden from clients`, denied(r));
  }

  // ---- nudges ----
  r = await maya.from('my_nudges').select('*');
  check('Maya sees her seeded nudge', r.data?.some((n) => n.id === '00000000-0000-4000-a000-000000000001'), JSON.stringify(r.error ?? r.data));
  check('my_nudges has no reason_kind', r.data && !('reason_kind' in (r.data[0] ?? {})));
  r = await maya.from('nudges').select('reason_kind');
  check('reason_kind never selectable', !!r.error);
  r = await sam.from('my_nudges').select('*').eq('about_user_id', ID.sam);
  check('Sam never sees nudges about himself', denied(r));
  r = await maya.from('my_nudges').update({ message: 'edited' }).eq('id', '00000000-0000-4000-a000-000000000001');
  check("Maya can't edit nudge text", !!r.error);

  // ---- interactions (P0.13) ----
  r = await maya.from('interactions').insert({ circle_id: SUNNY, sender_id: ID.maya, kind: 'egg' }).select('id').single();
  check('Maya sends egg to circle', !r.error, r.error?.message);
  const eggId = r.data?.id;
  if (eggId) cleanup.push(() => maya.from('interactions').delete().eq('id', eggId));

  r = await maya.from('interactions')
    .insert({ circle_id: SUNNY, sender_id: ID.maya, recipient_id: ID.sam, kind: 'text', body: 'hi Sam' })
    .select('id').single();
  check('Maya sends directed text to Sam', !r.error, r.error?.message);
  const dmId = r.data?.id;
  if (dmId) cleanup.push(() => maya.from('interactions').delete().eq('id', dmId));

  r = await jordan.from('interactions').select('id').eq('id', eggId);
  check('Jordan sees circle egg', r.data?.length === 1);
  r = await sam.from('interactions').select('id').eq('id', dmId);
  check('Sam sees directed text', r.data?.length === 1);
  r = await jordan.from('interactions').select('id').eq('id', dmId);
  check("Jordan can't see directed text", denied(r));
  r = await riley.from('interactions').select('id').eq('circle_id', SUNNY);
  check("Riley can't see Sunny feed", denied(r));
  r = await riley.from('interactions').insert({ circle_id: SUNNY, sender_id: ID.riley, kind: 'egg' });
  check("Riley can't post into Sunny circle", !!r.error);
  r = await maya.from('interactions').insert({ circle_id: SUNNY, sender_id: ID.sam, kind: 'egg' });
  check("Maya can't post as Sam", !!r.error);

  r = await jordan.from('reactions').insert({ interaction_id: dmId, user_id: ID.jordan, emoji: '👀' });
  check("Jordan can't react to directed text", !!r.error);
  r = await sam.from('reactions').insert({ interaction_id: dmId, user_id: ID.sam, emoji: '❤️' });
  check('Sam reacts to directed text', !r.error, r.error?.message);

  // ---- notifications (free-Apple-ID pivot) ----
  r = await sam.from('notifications').select('id, type, body').eq('target_id', dmId);
  check('Sam got a notification for the directed text', r.data?.length === 1 && r.data[0].type === 'interaction', JSON.stringify(r.error ?? r.data));
  r = await jordan.from('notifications').select('id').eq('target_id', dmId);
  check('Jordan got no notification for it', denied(r));
  r = await jordan.from('notifications').select('id').eq('target_id', eggId);
  check('Jordan got one for the circle egg', r.data?.length === 1);
  r = await maya.from('notifications').select('id').eq('target_id', eggId);
  check('Sender (Maya) got none for her own egg', denied(r));
  r = await riley.from('notifications').select('id');
  check("Riley can't read others' notifications", denied(r));
  r = await jordan.from('notifications').update({ read_at: new Date().toISOString() }).eq('target_id', eggId).select('id');
  check('Jordan marks his notification read', r.data?.length === 1, JSON.stringify(r.error));
  r = await jordan.from('notifications').update({ body: 'edited' }).eq('target_id', eggId);
  check("Jordan can't edit notification text", !!r.error);
  r = await maya.from('notifications').insert({ user_id: ID.sam, type: 'nudge', circle_id: SUNNY, title: 'x', body: 'fake nudge' });
  check("Maya can't create a notification", !!r.error);
  r = await maya.rpc('create_notifications', { p_rows: [] });
  check('create_notifications not callable by clients', !!r.error);

  // ---- storage ----
  const photoId = crypto.randomUUID();
  const path = `${SUNNY}/${photoId}.jpg`;
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  r = await maya.storage.from('media').upload(path, bytes, { contentType: 'image/jpeg' });
  check('Maya uploads photo to her circle folder', !r.error, r.error?.message);
  cleanup.push(() => maya.storage.from('media').remove([path]));
  r = await riley.storage.from('media').upload(`${SUNNY}/${crypto.randomUUID()}.jpg`, bytes, { contentType: 'image/jpeg' });
  check("Riley can't upload into Sunny folder", !!r.error);

  r = await maya.from('interactions')
    .insert({ id: photoId, circle_id: SUNNY, sender_id: ID.maya, recipient_id: ID.sam, kind: 'photo', media_path: path })
    .select('id').single();
  check('Maya sends directed photo to Sam', !r.error, r.error?.message);
  cleanup.unshift(() => maya.from('interactions').delete().eq('id', photoId));

  r = await sam.storage.from('media').download(path);
  check('Sam can download the photo', !r.error, r.error?.message);
  r = await jordan.storage.from('media').download(path);
  check("Jordan can't download Sam's photo", !!r.error);
  r = await jordan.from('interactions').insert({ circle_id: SUNNY, sender_id: ID.jordan, kind: 'photo', media_path: path });
  check("Jordan can't reuse Maya's media path", !!r.error);

  // ---- RPCs ----
  r = await jordan.rpc('join_circle', { invite_code: 'riley-tst' });
  check('Jordan joins with code (messy formatting ok)', !r.error && r.data?.id === RILEYS, r.error?.message);
  r = await jordan.rpc('leave_circle', { circle_id: RILEYS });
  check('Jordan leaves again', !r.error, r.error?.message);
  r = await riley.from('circle_members').select('role').eq('circle_id', RILEYS).eq('user_id', ID.riley).single();
  check('Riley still owner', r.data?.role === 'owner');
  r = await maya.rpc('join_circle', { invite_code: 'NOPE0000' });
  check('Bad invite code errors', !!r.error);
  r = await maya.rpc('is_member_of', { p_circle_id: RILEYS, p_user_id: ID.riley });
  check('Helper functions not exposed over the API', !!r.error);
} finally {
  for (const fn of cleanup) await fn();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
