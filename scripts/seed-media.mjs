// B2.4: sample photos for the test circle. Uploads small generated PNGs as the seed users
// (same path + RLS rules as the app) and posts them as photo interactions.
//
//   cd scripts && npm run seed-media
//
// Re-runnable: skips photos that already exist. Needs scripts/.env (see .env.example).
// Voice memos aren't seeded (no m4a encoder here); record one from the app instead.
import { createClient } from '@supabase/supabase-js';
import { deflateSync, crc32 } from 'node:zlib';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in scripts/.env');
  process.exit(2);
}
const SUNNY = '00000000-0000-4000-9000-000000000001';
const SAM = '00000000-0000-4000-8000-000000000002';

/** Solid-colour PNG with a lighter diagonal stripe, so thumbnails are distinguishable. */
function png(w, h, [r, g, b]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const stripe = Math.abs(x - y) < w / 8;
      const i = row + 1 + x * 3;
      raw[i] = stripe ? Math.min(255, r + 70) : r;
      raw[i + 1] = stripe ? Math.min(255, g + 70) : g;
      raw[i + 2] = stripe ? Math.min(255, b + 70) : b;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const PHOTOS = [
  { id: '00000000-0000-4000-c000-000000000001', by: 'priya', color: [244, 162, 97], to: null },
  { id: '00000000-0000-4000-c000-000000000002', by: 'jordan', color: [42, 157, 143], to: null },
  { id: '00000000-0000-4000-c000-000000000003', by: 'maya', color: [233, 196, 106], to: SAM },
];

for (const p of PHOTOS) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: auth, error: authErr } = await c.auth.signInWithPassword({
    email: `${p.by}@sunnyside.test`,
    password: 'sunnyside-test',
  });
  if (authErr) throw new Error(`sign in ${p.by}: ${authErr.message}`);

  const { data: existing } = await c.from('interactions').select('id').eq('id', p.id);
  if (existing?.length) {
    console.log(`skip ${p.by}'s photo (exists)`);
    continue;
  }

  const path = `${SUNNY}/${p.id}.png`;
  const up = await c.storage.from('media').upload(path, png(480, 480, p.color), {
    contentType: 'image/png',
    upsert: false,
  });
  if (up.error && !/exists/i.test(up.error.message)) throw new Error(`upload: ${up.error.message}`);

  const ins = await c.from('interactions').insert({
    id: p.id,
    circle_id: SUNNY,
    sender_id: auth.user.id,
    recipient_id: p.to,
    kind: 'photo',
    media_path: path,
  });
  if (ins.error) throw new Error(`insert: ${ins.error.message}`);
  console.log(`added ${p.by}'s photo${p.to ? ' (to Sam only)' : ''}`);
}
