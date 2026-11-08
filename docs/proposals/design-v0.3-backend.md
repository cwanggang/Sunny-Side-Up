# Proposal: backend changes for the v0.3 design (low-fi prototype)

Status: **agreed and applied to hosted** (2026-11-07): migration `20261108000500_design_v03.sql`,
`rhythm-scheduler` redeployed, `shared/` regenerated. `scripts/rls-test` covers it (74 checks).
Author: Developer B.

## How the design maps to what already exists

| Design (prototype v0.3) | Backend today | Change needed |
| --- | --- | --- |
| **my groups** list (incl. a 1:1 group like "@val") | `circles` (a 2-person circle works as 1:1) | none |
| **"it's your day"**: one person per group per day posts today's photo | `spotlight_days` already rotates one person per circle per day; scheduler notifies them at 09:00 local | copy only: "it's your day! today's prompt: …" |
| **today's prompt** ("your shoes, right now") | none | `daily_prompt(day)` SQL function (same prompt for everyone that day) |
| **today's photo** on top of the group stack, "stays until tomorrow's rotation" | `shares` with `kind = 'spotlight'`, `period_key = 'YYYY-MM-DD'` | add `egg_style` (decoration); app shows only today's spotlight share on top |
| **decorate the egg / write on your egg** | `shares.body` holds text | add `shares.egg_style jsonb` (`{ swatch, pattern }`) |
| **sunny sunday: crack the egg to see "your person"** | Sunday share is a whole-circle post | new `sunday_pairs` table; scheduler pairs people each Sunday |
| **respond with video or voice memo** | voice m4a allowed; video is **not** allowed by the `media` bucket | add `video/mp4`, `video/quicktime` to the bucket; raise size limit to 50 MB |
| **"record your message first to see what you received"** | n/a | RLS: you can read your partner's Sunday egg only after you've sent yours |
| **"still frying! waiting on mia"** | n/a | derived: I posted, partner hasn't (app reads `sunday_pairs` + my own share) |
| **up next** event card ("dumpling night, 7pm at maya's") + "calendar coming soon" | `moments` (title, date) and AI `hangout-ideas` | optional: `moments.where_text`. RSVP ("3 going") is out of scope, matching the design's "coming soon" |
| **settings → notifications** (daily photo reminder, sunny sunday reminder, when friends post) | none | 3 booleans on `consents`; the notify helper skips users who turned a type off |
| settings → camera (front camera, mirror selfies) | n/a | device-only (app local storage), no backend |
| settings → privacy "who sees my photos: only my groups", "photos last: until next rotation" | already true (RLS: circle members only) | none; copy only |

Nudges, drift, birthdays, hangout ideas: unchanged. The design doesn't draw them yet; they keep the
baseline screens until it does.

## Proposed contract changes (`shared/` + migration)

### 1. `sunday_pairs` (new table)

```
sunday_pairs(circle_id, period_key text  -- '2026-W45'
            , giver_id, receiver_id, created_at)
primary key (circle_id, period_key, giver_id)
```

- Filled by `rhythm-scheduler` when the Sunday window opens. Even groups: mutual pairs.
  Odd groups: one 3-person ring (A→B→C→A), so everyone sends one egg and gets one.
- RLS: select where `auth.uid()` is `giver_id` or `receiver_id`. No inserts from clients.
- **Quiet-drift hook (server only):** when someone is quiet, the scheduler pairs them with a
  friend who is active that week, the same "never visible" bias the spotlight rotation already uses.
  Nothing in the row or the notification says why. (Privacy rules §9.4/§9.5 hold: no reason
  stored, no label.)

### 2. `shares` columns

- `recipient_id uuid null`: set on Sunday eggs (= my `receiver_id`); null for the daily photo.
- `egg_style jsonb null`: `{ "swatch": "blush", "pattern": "dots" }`; the text on the egg stays in `body`.
- **RLS change:** a share with `recipient_id` set is visible to its author, and to the recipient
  **only once the recipient has posted their own Sunday share for that circle and week**.
  Media follows the row (`can_read_media` uses the same check).

### 3. `consents` columns (notification settings)

`notify_daily_photo`, `notify_sunday`, `notify_friend_posts`: boolean, default true.

### 4. New notifications (existing `notifications` table, no new types)

| When | Who | Copy (example) | `type` |
| --- | --- | --- | --- |
| 09:00 local on your spotlight day | you | "it's your day! today's prompt: your shoes, right now" | `spotlight` |
| someone posts the daily photo | rest of the group (if `notify_friend_posts`) | "Jun's photo is up in roomies" | `share_open` |
| Sunday window opens | everyone (if `notify_sunday`) | "sunny sunday! crack your egg to see who you're sending to" | `share_open` |
| your Sunday partner sends their egg | the receiver | "Jun sent you an egg 🥚 send yours to open it" | `share_open` |

### 5. `daily_prompt(day date) returns text`

Stable SQL function over a fixed list, so the prompt is the same for everyone on a given day and the
app doesn't hard-code it. (Sunday prompts take the partner's first name: "what made you think of Jun this week?")

### Client hooks this implies (Developer A, `@/api`)

- `useTodayPhoto(circleId)`: today's spotlight person, today's prompt, today's photo share (if posted).
- `usePostTodayPhoto()`: upload photo, insert a `spotlight` share with `egg_style` + `body`.
- `useSundayEgg(circleId)`: my partner, my egg (if sent), their egg (visible only after I've sent mine),
  and a derived state: `uncracked | respond | open | frying | opened`.
- `useSendSundayEgg()`: upload video/voice, insert a `sunday` share with `recipient_id` + `egg_style`.
- `useConsent()` gains the 3 notification booleans.

## Ownership note

All screen and hook work above is in `app/` and `src/`, which Developer A owns. Developer B builds
the migration, scheduler, triggers, RLS tests, and `shared/` regen after agreement. The only screen
handoff to B is Phase 5.2 (Sunday, spotlight, birthdays, hangouts, nudges, settings restyle), which
starts after A5.1 (theme tokens) is merged.

Design tokens from the prototype, for A5.1:

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| bg | `#D5DABE` | ink | `#1F2945` |
| bg-2 | `#E5E8D5` | ink-2 | `#4E576D` |
| card | `#FFFFFF` | ink-3 | `#7A8194` |
| yolk | `#F2AE3D` | line | `#C3C9AB` |
| yolk-deep | `#D98F1C` | hair | `#ECEEE4` |
| yolk-hi | `#FFE7A8` | coral | `#E9775A` |
| font | "Sen" (Google Font), fallback Avenir Next | copy style | all lowercase |
