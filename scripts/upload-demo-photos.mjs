// B5.1: upload the reusable demo photos to the demo circle's folder ({demo circle}/demo-photo-N.ext).
// demo_reseed() turns every one of these files into a backdated photo post from a friend, and
// keeps the files across reseeds.
//
//   cd scripts && npm run upload-demo-photos
//   npm run upload-demo-photos -- --as maya@sunnyside.test --password sunnyside-test
//
// Photos: put real .jpg/.png files in scripts/demo-photos/ (sorted by name; up to 6 used).
// Without that folder, simple generated "sunset / latte / park" placeholder images are uploaded.
// You must sign in as a CURRENT member of the demo circle (default: the maya test account, which
// is a member after a rehearsal reseed with the test accounts). Needs scripts/.env.
import { createClient } from '@supabase/supabase-js';
import { deflateSync, crc32 } from 'node:zlib';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
if (!URL || !ANON) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY in scripts/.env');
  process.exit(2);
}
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const EMAIL = arg('as', 'maya@sunnyside.test');
const PASSWORD = arg('password', 'sunnyside-test');
const DEMO = '00000000-0000-4000-9000-0000000000d0';
const MAX = 6;

// ---------- tiny PNG writer for placeholders ----------
function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++) raw.set(pixel(x / w, y / h), row + 1 + x * 3);
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
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const PLACEHOLDERS = [
  // sunset: orange-to-purple sky, yellow sun, dark ground
  (u, v) => (v > 0.75 ? [40, 30, 50] : Math.hypot(u - 0.5, v - 0.62) < 0.12 ? [255, 214, 102] : mix([255, 140, 70], [110, 60, 140], v / 0.75)),
  // latte from above: cream circle on a wooden table
  (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5); return d < 0.28 ? mix([236, 214, 180], [190, 140, 95], d / 0.28) : d < 0.33 ? [250, 250, 245] : mix([150, 100, 60], [120, 80, 45], v); },
  // park: blue sky, green hills
  (u, v) => (v < 0.55 + 0.08 * Math.sin(u * 6) ? mix([140, 200, 255], [210, 235, 255], v) : mix([90, 170, 80], [50, 120, 50], v)),
  // night city: dark blue with warm window dots
  (u, v) => ((Math.floor(u * 24) + Math.floor(v * 24)) % 7 === 0 && v > 0.4 ? [255, 210, 120] : mix([20, 30, 70], [10, 10, 30], v)),
];

// ---------- collect photos ----------
const dir = new globalThis.URL('./demo-photos/', import.meta.url);
let photos = [];
if (existsSync(dir)) {
  photos = readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .slice(0, MAX)
    .map((f) => ({
      bytes: readFileSync(join(dir.pathname.replace(/^\/([A-Za-z]:)/, '$1'), f)),
      ext: extname(f).slice(1).toLowerCase().replace('jpeg', 'jpg'),
      label: f,
    }));
}
if (photos.length === 0) {
  photos = PLACEHOLDERS.map((p, i) => ({ bytes: png(720, 720, p), ext: 'png', label: `placeholder ${i + 1}` }));
}

// ---------- upload ----------
const c = createClient(URL, ANON, { auth: { persistSession: false } });
const { error: authErr } = await c.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (authErr) throw new Error(`sign in ${EMAIL}: ${authErr.message}`);

const { data: existing } = await c.storage.from('media').list(DEMO, { search: 'demo-photo-' });
const stale = (existing ?? []).map((o) => `${DEMO}/${o.name}`);
if (stale.length) await c.storage.from('media').remove(stale); // only removes files this account uploaded

let n = 0;
for (const [i, p] of photos.entries()) {
  const path = `${DEMO}/demo-photo-${i + 1}.${p.ext}`;
  const { error } = await c.storage.from('media').upload(path, p.bytes, {
    contentType: p.ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) console.error(`FAIL ${p.label}: ${error.message}`);
  else { n++; console.log(`uploaded ${p.label} -> ${path}`); }
}
console.log(`\n${n} demo photos ready. They appear as posts after the next demo reseed.`);
