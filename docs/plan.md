# Sunny Side Up: Build Plan

This file is the source of truth for **who builds what, in what order, and where**. Claude Code: read this whole file before starting any task. If `docs/architecture.md` or `docs/concept.md` disagree with this file on ownership, folders, or phases, **this file wins**.

- **Product:** a friend-circle app that keeps groups close (eggs, photos, voice memos, Sunday shares, spotlight days, birthdays, shout-outs). It also quietly notices when someone goes quiet and nudges a friend to reach out, without saying why.
- **Platform:** iOS first. Expo (React Native + TypeScript) development build, Supabase backend, an LLM for nudge wording and hangout ideas, and Entrinsik Informer for analytics.
- **Event:** Triangle AI Hackathon, 36 hours of build time. Times below are relative (H+0 = hacking starts). Adjust to the real clock.

---

## 0. How to use this file (instructions for Claude Code)

1. **Establish the developer's role before doing anything.** At the start of every Claude session the developer states **"I am Developer A"** or **"I am Developer B"** (or it is already written in their git-ignored `CLAUDE.local.md`). If the role is not known, ask for it and do no work until it is. Then work **only in the folders that role owns** (sections 1 and 2). If a task needs a change outside those folders, stop and say so. Do not edit the other developer's files.
2. **Work task by task** using the IDs (`A1.3`, `B2.1`, ...). Check a task's "Depends on" and the dependency map (section 6) before starting it. When a task is done, tick its box in the **progress tracker (section 10)**, ticking only your own role's list, and commit with the task ID in the message (for example `A1.3: circle hooks + invite link`).
3. **The contract lives in `/shared`.** Never change `/shared` without both developers agreeing. If a change is needed, write it up as a proposal, then make the change in its own commit, separate from feature work: `contract: add moments.title`.
4. **Screens get data only from `@/api`.** Screens and components never import `supabase-js`, native modules, or `/supabase` directly. This keeps data logic out of the UI, so the final design pass (Phase 5) can restyle every screen without touching how data works.
5. **Baseline UI only until Phase 5.** Screens are plain and functional: system fonts, default spacing, simple lists and buttons. No custom styling, animation, or icon work until the designs arrive. Any styling that does exist goes through `src/theme/` so it can be swapped in one place.
6. **Privacy rules are hard requirements** (section 9). If a task would break one, stop and flag it.

---

## 1. The team

| Who | Owns | Main job |
| --- | --- | --- |
| **Developer A**: mobile app | `app/`, `src/` (all of it), `assets/`, `app.config.ts`, `eas.json`, `package.json` | The whole iPhone app: navigation, baseline screens, the typed data layer (`@/api`), auth, realtime, media capture and upload, push registration, invite deep links, location and HealthKit, background tasks, the native build. |
| **Developer B**: backend, AI, analytics | `supabase/`, `analytics/`, `scripts/` | Database, security rules, storage, server functions, scheduled jobs, push sending, drift detection, nudge engine, LLM calls, Informer, demo seed data and demo controls. |
| **Both** (by agreement only) | `shared/`, `docs/` | The contract between app and backend. |
| **Designers** (not in the repo) | Design files (Figma, drawings, screenshots) | Draw every screen in section 4.4. Hand over designs by **H+24** for the Phase 5 design pass. |

Developer A and Developer B never edit the same folders, so merges to `main` should be conflict-free except in `shared/`, which changes only by agreement.

---

## 2. Repository layout and ownership

```
/
├─ app/                      DEV A     Expo Router screens (baseline UI until Phase 5)
│  ├─ (auth)/                          sign-in, consent
│  ├─ (tabs)/                          circles, feed, rhythm, settings
│  └─ (dev)/                 DEV A     hidden demo-control screen (buttons call B's demo endpoints)
├─ src/
│  ├─ api/                   DEV A     supabase client + typed hooks; index.ts is the ONLY data import for screens
│  ├─ native/                DEV A     wrappers: location, health, notifications, camera, audio, linking
│  ├─ signals/               DEV A     on-device daily-number pipeline + background tasks
│  ├─ mocks/                 DEV A     mock versions of hooks, for building screens before B's endpoints exist
│  ├─ components/            DEV A     plain shared components (Button, Screen, ListItem, MediaThumb, ...)
│  └─ theme/                 DEV A     tokens (colors, type, spacing); defaults until Phase 5
├─ assets/                   DEV A
├─ shared/                   BOTH      contract (section 4)
│  ├─ database.types.ts      generated from Supabase (B regenerates, never hand-edited)
│  ├─ types.ts               app-level types (enums, view models)
│  └─ api.ts                 inputs/outputs for RPCs and Edge Functions
├─ supabase/                 DEV B
│  ├─ migrations/            SQL, one file per change, timestamped
│  ├─ functions/             Edge Functions (Deno)
│  │  └─ _shared/            push sender, LLM client, auth helpers
│  ├─ seed.sql               demo users, circles, two weeks of history
│  └─ config.toml
├─ analytics/                DEV B     Informer setup notes, analytics SQL views, screenshots
├─ scripts/                  DEV B     RLS tests, demo triggers
├─ docs/
│  ├─ concept.md             concept & brainstorm doc (background only)
│  ├─ architecture.md        architecture doc (background only)
│  └─ plan.md                this file
├─ CLAUDE.md                 BOTH      Claude Code instructions (role protocol, rules)
├─ CLAUDE.local.md           each dev, git-ignored: "I am Developer A/B"
├─ app.config.ts             DEV A
├─ eas.json                  DEV A
└─ package.json              DEV A
```

**Path aliases:** `@/` → `src/` and `@shared/` → `shared/`. Screens import like `import { useFeed } from '@/api'`; `src/api` imports contract types like `import type { Database } from '@shared/database.types'`.

**Routes live in the root `app/` folder, not `src/app/`.** Expo Router uses `src/app/` instead of `app/` if it exists, so never create `src/app/`.

---

## 3. Before hacking starts (everyone)

### 3.1 Accounts and keys (do first; some take time)

- [x] **P0.1** Paid Apple Developer account (needed for push notifications, the HealthKit entitlement, and EAS internal-distribution dev builds on real devices). **Enrollment approval can take 24 to 48 hours, so check its status first.** Register every team phone's UDID (`eas device:create`). If it isn't approved in time, see the fallback in section 11.
- [ ] **P0.2** Expo account + EAS CLI logged in (`npm i -g eas-cli`, `eas login`).
- [ ] **P0.3** Supabase project created. Save the project URL, anon key, service role key (B only, never in the app), and the **session pooler** connection string for Informer (the direct connection string is IPv6-only and many external tools can't reach it).
- [ ] **P0.4** Anthropic API key (B only, stored as a Supabase secret).
- [ ] **P0.5** Entrinsik Informer access (trial or sponsor-provided). Confirm it can connect to an external Postgres database.
- [ ] **P0.6** At least one Mac with Xcode for local iOS builds, as a backup if EAS build queues are slow.
- [ ] **P0.7** GitHub repo with `main` protected (no direct pushes), plus `docs/` with concept.md, architecture.md, and this plan.

### 3.2 Decisions to lock (10 minutes, all together)

- [x] **P0.8** Sign-in method: **Sign in with Apple + email and password**, with **"Confirm email" turned off** in Supabase Auth so no emails are ever sent (no SMTP setup, no rate limits, and fake test accounts are instant). *Contract change, see §4.*
- [ ] **P0.9** Drift score: **rule-based** against each person's own baseline (recommended for 36 hours).
- [ ] **P0.10** Hangout ideas use a **circle "home area"** typed by a member (for example "Durham, NC"), not anyone's live location.
- [ ] **P0.11** Branch names: `a/<phase>` and `b/<phase>`.
- [ ] **P0.12** Give the designers the screen list (section 4.4) so the designs cover every screen, and agree on the H+24 handoff.
- [x] **P0.13** Visibility of directed interactions: when `recipient_id` is set (an egg, photo, voice memo, or text to one person), **only the sender and the recipient** can see it. Whole-circle interactions (`recipient_id` null) are visible to all members. *Contract change, see §4.*
- [x] **P0.14** Demo cast (real phone accounts, all in one demo circle). The drift seed (B4.8) backfills history for these accounts, looked up by email:

  | Person | Email | Demo role |
  | --- | --- | --- |
  | Ella Ha | ella7.ha@gmail.com | **Quiet member** (engagement drops over the last 3 days) |
  | Valerie Wu | val311297@gmail.com | **Nudge recipient** ("haven't caught up with Ella lately") |
  | Caden Wang | caden190wang@gmail.com | Circle member |
  | Johnathon Wu | gamecoder04@gmail.com | Circle member |

  Each person signs up in the app with this email and a password (Phase 1) before B4.8 runs. For the demo, the nudge engine must pick Valerie for Ella (B4.8 seeds the rotation, or `?demo=true` targets her).

### 3.3 Scaffold (Developer A, ~60 min, H+0 to H+1)

The point of this step is to **install every native module once, up front**. Each new native module needs a fresh development build (10 to 20 minutes), so add them all now even if they aren't used yet.

- [ ] **S1** Create the Expo app (TypeScript + Expo Router) **in the repo root, not a subfolder.** `create-expo-app` refuses a non-empty folder, so generate it in a temporary folder outside the repo and move its contents into the root, merging its `.gitignore` with the existing one and keeping `docs/`, `CLAUDE.md`. Delete the template's example screens and components; make sure routes are in root `app/` (not `src/app/`). Add the `@/` and `@shared/` aliases in `tsconfig.json`.
- [ ] **S2** Install everything the app will need (native and JS):
  - Data: `@supabase/supabase-js`, `@tanstack/react-query`, `expo-secure-store`, `react-native-url-polyfill`, `zod`
  - Auth: `expo-apple-authentication`
  - Push and links: `expo-notifications`, `expo-device`, `expo-linking`
  - Media: `expo-camera`, `expo-image-picker`, `expo-audio`, `expo-image`, `expo-file-system`
  - Signals: `expo-location`, `expo-task-manager`, `expo-background-task`, and a HealthKit library (`@kingstinct/react-native-healthkit` or `react-native-health`; use whichever builds cleanly with the current Expo SDK)
  - Dev: `expo-dev-client`
- [ ] **S3** `app.config.ts`: bundle ID, scheme `sunnysideup` (for invite links), config plugins for every native module above, iOS permission strings (camera, microphone, photo library, location when-in-use and always, Health read), background modes (`location`, `remote-notification`, `fetch`), and the HealthKit entitlement.
- [ ] **S4** `eas.json` with a `development` profile. Run `eas build --profile development --platform ios` and install it on every phone.
- [ ] **S5** Folder skeleton from section 2 with placeholder `index.ts` files.
- [ ] **S6** `.env.example` with `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_USE_MOCKS`, `EXPO_PUBLIC_DEMO_KEY` (only gates demo controls, so it's acceptable in the bundle for a hackathon).

In parallel, Developer B does **B0.1–B0.4** (Phase 0).

### 3.4 Rules that keep merges painless

- **One owner per folder** (section 2).
- **Small, frequent merges to `main`**, at least every 2 to 3 hours per person, plus the scheduled merge points.
- **Generated types:** only Developer B runs `supabase gen types` → `shared/database.types.ts`, always in its own commit. Developer A pulls `main` right after.
- **Native changes are rare and announced.** Only Developer A adds native packages or edits `app.config.ts`, and tells B when a new dev build is needed on the shared test phones.

---

## 4. The contract (agree before Phase 1)

This section defines `/shared`. Developer B writes the SQL to match it; Developer A writes hooks and screens to match it.

**Contract change log**

| Date | Change | Affects |
| --- | --- | --- |
| 2026-11-07 | **contract:** email sign-in changed from one-time code to email + password ("Confirm email" off, no emails sent). `sendEmailCode` / `verifyEmailCode` replaced by `signUpWithEmail` / `signInWithEmail`. Sign in with Apple unchanged. | P0.8, A1.1, B1.1, §4.3 Auth, §4.4 sign-in |
| 2026-11-07 | **contract:** directed interactions (`recipient_id` set) are visible only to sender and recipient; reactions and media follow the parent interaction's visibility. `useFeed(circleId)` therefore returns whole-circle items plus the viewer's own directed items. | P0.13, §4.1 `interactions` / `reactions` / storage, B0.3, A2.1 |

### 4.1 Database tables (public schema)

| Table | Columns | Who can read (RLS) |
| --- | --- | --- |
| `profiles` | `id` (= auth user id), `display_name`, `avatar_path`, `birthday` (date, nullable), `timezone`, `expo_push_token`, `created_at` | Base table: self only (RLS is per row, not per column, so a member policy here would leak `expo_push_token`). Circle members read other profiles only through the `circle_profiles` view |
| `consents` | `user_id`, `location` (bool), `health` (bool), `auto_nudges` (bool, default true), `paused_until` (timestamptz, nullable), `updated_at` | Self only |
| `circles` | `id`, `name`, `home_area` (text), `invite_code` (unique), `created_by`, `created_at` | Members |
| `circle_members` | `circle_id`, `user_id`, `role` (`owner` or `member`), `joined_at` | Members of that circle |
| `interactions` | `id`, `circle_id`, `sender_id`, `recipient_id` (nullable = whole circle), `kind` (`egg`, `photo`, `voice`, `text`), `media_path`, `body`, `created_at` | If `recipient_id` is null: members of that circle. If set: **only `sender_id` and `recipient_id`** (P0.13) |
| `reactions` | `interaction_id`, `user_id`, `emoji`, `created_at` | Whoever can see the parent interaction |
| `shares` | `id`, `circle_id`, `author_id`, `kind` (`sunday` or `spotlight`), `period_key` (for example `2026-W45` or `2026-11-07`), `body`, `media_path`, `created_at` | Members of that circle |
| `spotlight_days` | `circle_id`, `day` (date), `user_id` | Members of that circle |
| `moments` | `id`, `circle_id`, `user_id`, `title`, `occurs_on` (date), `created_at` | Members of that circle; created only by the user themselves |
| `app_events` | `id`, `user_id`, `kind` (`app_open`), `at` | Self only (insert) |
| `daily_signals` | `user_id`, `day`, `hours_away_from_home`, `places_visited`, `sleep_hours`, `steps`, `uploaded_at` | Self only |
| `engagement_daily` | `user_id`, `circle_id`, `day`, `sent`, `received`, `opens` | Nobody (service role only) |
| `drift_scores` | `user_id`, `circle_id`, `day`, `score`, `is_quiet` (bool) | Nobody (service role only) |
| `nudges` | `id`, `circle_id`, `recipient_id` (friend who gets it), `about_user_id` (person to reach out to), `reason_kind` (`drift`, `cover`, `birthday`, `moment`, `spotlight`), `message`, `sent_at`, `acted_at` | Nobody directly. Recipients read the `my_nudges` view, which **hides `reason_kind`** |

**Views:** `circle_profiles` (safe profile fields for circle members), `my_nudges` (`id`, `circle_id`, `about_user_id`, `message`, `sent_at`, `acted_at` where `recipient_id = auth.uid()`).

**Realtime:** `interactions` and `reactions` are added to the `supabase_realtime` publication (B0.2), or `useFeed` gets no live updates.

**Storage buckets:** `media` (private). Path: `{circle_id}/{interaction_or_share_id}.{ext}`. Policy: write only for members of `circle_id`; read only for users who can see the matching `interactions` or `shares` row (so media in a directed interaction is readable only by sender and recipient, per P0.13).

### 4.2 Server API (RPCs and Edge Functions)

| Name | Type | Input | Output | Caller |
| --- | --- | --- | --- | --- |
| `create_circle` | RPC | `name`, `home_area` | circle row | App |
| `join_circle` | RPC | `invite_code` | circle row | App |
| `leave_circle` | RPC | `circle_id` | ok | App |
| `register_push_token` | RPC | `token` | ok | App |
| `hangout-ideas` | Edge Function | `circle_id` | `{ ideas: { title, why, where }[] }` | App |
| `delete-account` | Edge Function | none | ok | App |
| `on-interaction` | Edge Function (database webhook on `interactions` insert) | row | sends pushes | Database |
| `rhythm-scheduler` | Edge Function (cron, hourly; `?now=<iso>` to force) | none | opens Sunday share, rotates spotlight, birthday and moment reminders | Cron or demo screen |
| `nightly-drift` | Edge Function (cron, nightly) | none | fills `engagement_daily` and `drift_scores` | Cron |
| `nudge-engine` | Edge Function (cron, after drift; `?demo=true` runs drift + nudge now) | none | inserts `nudges`, sends pushes | Cron or demo screen |
| `demo-reseed` | Edge Function | none | resets demo data to the B4.8 seed | Demo screen |

**Demo controls are protected.** `?now=`, `?demo=true`, and `demo-reseed` only work when the request carries the `x-demo-key` header matching the `DEMO_KEY` secret. The app reads it from `EXPO_PUBLIC_DEMO_KEY` and only the `(dev)` screen sends it.

**Push payload shape** (all pushes): `{ type: 'interaction' | 'nudge' | 'share_open' | 'spotlight' | 'birthday' | 'moment', circle_id, target_id? }`. The app routes on `type`.

### 4.3 Client hook surface (`@/api`, built by Developer A)

Screens import only these. Each starts as a mock (`src/mocks`) when B's endpoint isn't ready yet, and switches to real at the merge point.

| Area | Hooks and functions |
| --- | --- |
| Auth | `useSession()`, `signInWithApple()`, `signUpWithEmail(email, password)`, `signInWithEmail(email, password)`, `signOut()` |
| Profile | `useMyProfile()`, `useUpdateProfile()` |
| Consent and privacy | `useConsent()`, `useUpdateConsent()`, `usePause()`, `useWhatTheAppSaw()` (own `daily_signals`), `useDeleteAccount()` |
| Circles | `useMyCircles()`, `useCircle(id)`, `useCircleMembers(id)`, `useCreateCircle()`, `useJoinCircle()`, `useInviteLink(circleId)`, `useLeaveCircle()` |
| Feed | `useFeed(circleId)` (realtime), `useSendEgg()`, `useSendText()`, `useSendPhoto()`, `useSendVoice()`, `useReact()` |
| Media | `usePhotoPicker()`, `useCameraCapture()`, `useVoiceRecorder()` (`start`, `stop`, `durationMs`, `uri`), `useMediaUrl(path)` (signed URL) |
| Rhythm | `useSundayShare(circleId)`, `usePostShare()`, `useSpotlight(circleId)` (today's person + this week's schedule) |
| Closeness | `useBirthdays(circleId)`, `useMoments(circleId)`, `useCreateMoment()` |
| Nudges | `useMyNudges()`, `useMarkNudgeActed()` |
| Hangouts | `useHangoutIdeas(circleId)` |
| Device | `usePushRegistration()` (call once after sign-in), `useNotificationRouting()` (push tap → screen), `useInviteLinkHandler()` (deep link → join) |
| Signals | `useSignalStatus()` (permissions + last upload), `requestSignalPermissions()`, `setHomeLocation()` |

### 4.4 Screen inventory (baseline UI now, designers draw these)

| Route | Screen | Built in |
| --- | --- | --- |
| `(auth)/sign-in` | Sign in with Apple, or email + password (sign in, or toggle to create an account) | Phase 1 |
| `(auth)/consent` | Every signal in plain language, a toggle for each, auto-nudge agreement, 988 link | Phase 1 |
| `(auth)/profile-setup` | Name, photo, birthday (optional) | Phase 1 |
| `(tabs)/circles` | My circles; create; join by code | Phase 1 |
| `circle/[id]` | Members, invite link/share sheet, home area | Phase 1 |
| `circle/[id]/feed` | Live feed of eggs, texts, photos, voice memos; reactions | Phase 2 |
| `circle/[id]/compose` | Send an egg, text, photo, or voice memo to one person or everyone | Phase 2 |
| `circle/[id]/sunday` | This week's Sunday share: prompt, post, everyone's posts | Phase 3 |
| `circle/[id]/spotlight` | Today's spotlight person + this week's schedule | Phase 3 |
| `circle/[id]/birthdays` | Upcoming birthdays and moments; add a moment ("interview Tuesday") | Phase 3 |
| `circle/[id]/hangouts` | AI hangout ideas | Phase 3 |
| `(tabs)/nudges` | Nudges I've received ("reach out to Sam"), with quick actions | Phase 4 |
| `(tabs)/settings` | Signal toggles, pause, set home, what the app saw, delete account | Phase 4 |
| `(dev)/demo` | Hidden: run scheduler, run drift + nudge, reseed | Phase 4 |

---

## 5. Phases: Developer A and Developer B side by side

Each phase ends at a **merge point**: both branches merge to `main`, the dev build runs on two phones, and the listed check passes. Don't start the next phase's dependent tasks until the merge point passes.

Within each phase, Developer A usually builds the hooks first and the baseline screens second. If B's endpoint isn't merged yet, A builds against the mock and swaps it in at the merge point.

### Phase 0: Foundation (H+0 to H+2)

| Developer A: mobile app | Developer B: backend |
| --- | --- |
| **S1–S6** scaffold (section 3.3) | **B0.1** `supabase init`, link the project, enable `pg_cron` and `pg_net`. (The local stack `supabase start` needs Docker; without Docker, work directly against the hosted project with `supabase db push`.) |
| **A0.1** `src/api/client.ts`: Supabase client with `expo-secure-store` session storage and URL polyfill | **B0.2** Migration `0001_core.sql`: **all** tables, enums, and views from section 4.1 (create the whole schema now, even for later phases) |
| **A0.2** React Query provider + `@/api/index.ts` export surface (stubs for every hook in 4.3) + `EXPO_PUBLIC_USE_MOCKS` switch | **B0.3** RLS policies for every table, the `media` bucket and its policies. Membership checks go through a `SECURITY DEFINER` helper such as `is_circle_member(circle_id)`; a `circle_members` policy that queries `circle_members` directly causes infinite recursion |
| **A0.3** Navigation skeleton: every route in 4.4 as an empty screen; plain `Screen`, `Button`, `ListItem` components; default `theme` tokens | **B0.4** `supabase gen types` → `shared/database.types.ts`; write `shared/api.ts` from section 4.2 |

**Merge point M0:** the app boots on a phone and you can tap through every empty screen; `shared/` is committed; the database exists with RLS.

### Phase 1: Accounts and circles (H+2 to H+7)

| Developer A | Developer B |
| --- | --- |
| **A1.1** Auth hooks: Apple sign-in, `signUpWithEmail` and `signInWithEmail` (email + password); session restore on launch; auth gate in the root layout. *Depends on: A0.1* | **B1.1** Auth providers configured: Apple, and Email with **"Confirm email" off** (sign-up returns a session immediately, no emails sent); trigger that creates `profiles` and `consents` rows on signup. *Depends on: B0.2* |
| **A1.2** Profile and consent hooks. *Depends on: A1.1, B1.1* | **B1.2** RPCs `create_circle`, `join_circle`, `leave_circle` (invite code generation, membership checks). *Depends on: B0.3* |
| **A1.3** Circle hooks + `useInviteLink`: the share message contains `sunnysideup://join/<code>` **and the plain invite code**, because Messages may not make a custom-scheme link tappable; join-by-code is the fallback (no https domain needed). *Depends on: B1.2 (mock until then)* | **B1.3** RPC `register_push_token`; `functions/_shared/push.ts` (Expo Push API sender, batches, drops invalid tokens) |
| **A1.4** `usePushRegistration` (permission → Expo push token → `register_push_token`) and `useInviteLinkHandler`. *Depends on: B1.3* | **B1.4** `seed.sql` v1: 4 demo users, 1 circle |
| **A1.5** Baseline screens: sign-in, consent, profile setup, circles list, create/join, circle detail with invite share sheet | **B1.5** `scripts/rls-test`: user X cannot read circle Y, others' signals, scores, or raw nudges |

**Merge point M1:** on two phones, sign in → accept consent → create a circle → open the invite link on phone 2 → join → both see the member list. Both phones have push tokens stored.

### Phase 2: Tiny interactions (H+7 to H+13)

| Developer A | Developer B |
| --- | --- |
| **A2.1** `useFeed(circleId)` with a realtime subscription on `interactions` and `reactions`. *Depends on: M1* | **B2.1** `on-interaction` Edge Function + database webhook: push to the recipient (or the whole circle), skipping the sender. *Depends on: B1.3* |
| **A2.2** `useSendEgg`, `useSendText`, `useReact` | **B2.2** Push copy for each kind ("Maya sent you an egg 🥚"). Respect `consents.paused_until` |
| **A2.3** Media: `usePhotoPicker`, `useCameraCapture`, image compression, upload to `media/{circle_id}/...`, then the `interactions` insert. *Depends on: B0.3 bucket* | **B2.3** Storage cleanup: delete media when an interaction or account is deleted |
| **A2.4** `useVoiceRecorder` (`expo-audio`, 60-second cap, m4a) + upload + `useSendVoice`; `useMediaUrl` with signed-URL caching | **B2.4** `seed.sql` v2: a week of interactions with sample media |
| **A2.5** `useNotificationRouting` (push tap → feed or item) | **B2.5** `app_events` insert policy; RPC or trigger to log `app_open` |
| **A2.6** Baseline screens: feed (photo thumbnails, voice playback, reactions), compose | |

**Merge point M2:** phone 1 sends an egg, a photo, and a voice memo → phone 2 gets a push → tapping it opens the feed, which shows all three live.

### Phase 3: Rhythm and closeness (H+13 to H+18)

| Developer A | Developer B |
| --- | --- |
| **A3.1** `useSundayShare`, `usePostShare` (text, photo, or voice, reusing A2.3 and A2.4). *Depends on: M2* | **B3.1** `rhythm-scheduler` (hourly cron): opens the Sunday share window and pushes a "share your week" prompt in each user's timezone |
| **A3.2** `useSpotlight` (today's person + week view) | **B3.2** Spotlight rotation: fills `spotlight_days` a week ahead and pushes "Today's spotlight: Jordan". Quiet members get rotated in a little sooner (never visibly) |
| **A3.3** `useBirthdays`, `useMoments`, `useCreateMoment` | **B3.3** Birthday reminders (day before + day of) and moment shout-outs (morning of `occurs_on`) |
| **A3.4** `useHangoutIdeas`; report `app_open` on foreground (throttled to once per 30 minutes) | **B3.4** `hangout-ideas` Edge Function: LLM call with circle size, `home_area`, and the day of the week; returns 3 ideas as JSON (validated with zod) |
| **A3.5** Baseline screens: Sunday share, spotlight, birthdays and moments, hangout ideas | **B3.5** `functions/_shared/llm.ts`: Anthropic client, model from env, timeout + fallback text if the call fails |

**Merge point M3:** forcing the scheduler (`?now=...`) produces a Sunday share prompt, a spotlight push, and a birthday push on both phones; hangout ideas load in the app.

### Phase 4: Quiet drift (H+18 to H+26)

| Developer A | Developer B |
| --- | --- |
| **A4.1** `requestSignalPermissions` (location when-in-use → always; HealthKit read for sleep + steps), gated by `consents`. *Depends on: A1.2* | **B4.1** `nightly-drift`: build `engagement_daily` from `interactions`, `reactions`, `shares`, and `app_events` |
| **A4.2** `setHomeLocation` + a background geofence around home (`expo-location` + `expo-task-manager`) logging enter and exit times **on the phone only** | **B4.2** Drift score: for each user and circle, compare the last 3 days with their own 14-day baseline (engagement drop, plus `daily_signals` drops if present) → `drift_scores.is_quiet` |
| **A4.3** Significant location changes → count distinct places per day **on the phone** (coordinates rounded and kept locally, never uploaded) | **B4.3** `nudge-engine`: for each quiet user, pick a friend (rotating; skip anyone nudged in the last 48 hours), word the nudge with the LLM, insert into `nudges`, send the push. Add **cover nudges**: random friendly nudges about non-quiet members at a similar rate |
| **A4.4** HealthKit: last night's sleep hours + yesterday's steps | **B4.4** `my_nudges` view verified to hide `reason_kind`; `?demo=true` runs drift + nudge immediately for the seeded circle |
| **A4.5** `src/signals/daily.ts`: compute yesterday's row and upsert it into `daily_signals` once a day (background task + on app open as a fallback) | **B4.5** **Informer:** read-only Postgres role that can see only the `analytics` schema; views of aggregated, de-identified engagement (no names, no media, no message bodies); a dashboard of circle engagement over time plus an alert when a circle's engagement drops |
| **A4.6** `useWhatTheAppSaw`, `usePause`, `useDeleteAccount`, `useMyNudges`, `useMarkNudgeActed` | **B4.6** `delete-account` Edge Function: removes the user's rows, media, and auth user |
| **A4.7** Baseline screens: nudges, settings (toggles, pause, set home, what the app saw, delete), `(dev)/demo` buttons | **B4.7** Demo endpoints for the `(dev)/demo` screen: force scheduler, drift + nudge, `demo-reseed`, all gated by `x-demo-key` |
| | **B4.8** `seed.sql` v3 / `scripts/seed-demo`: **17+ days** of backdated history for the **real demo accounts** (P0.14) in one circle, with the quiet member's engagement dropping over the last 3 days. Needed for M4: the drift score compares 3 days with a 14-day baseline, and pushes only reach real phones, not fake seed users |

**Merge point M4:** with seeded history, one member goes quiet → tap "run drift + nudge" on the demo screen → a friend's phone gets a natural "haven't caught up with Sam lately" push; the quiet member's own phone shows nothing about it. The Informer dashboard shows the engagement dip.

**Load-balancing valve:** Developer A's Phase 4 is the heaviest. If A is behind at H+22, B takes A4.7's demo screen by agreement (a one-time ownership handoff of `app/(dev)/`, announced in chat).

### Phase 5: Design pass and demo (H+26 to H+34, both)

Designers hand over the final screens at H+24. Because all data logic lives in `@/api`, this phase changes only `src/theme/`, `src/components/`, `assets/`, and the JSX and styles inside `app/` screens.

To avoid conflicts while both developers are styling, split by folder:

| Step | Developer A | Developer B |
| --- | --- | --- |
| **5.1** (H+26 to H+28) | **A5.1** Turn the designs into `src/theme/` tokens (colors, fonts, spacing, radii) and restyle `src/components/`. Merge to `main` before 5.2 | **B5.1** Seed polish: realistic names, photos, and Sunday-share text on top of the B4.8 history |
| **5.2** (H+28 to H+33) | **A5.2** Restyle `(auth)/` and `(tabs)/circles`, `circle/[id]`, feed, compose | **B5.2** Restyle `circle/[id]/sunday`, `spotlight`, `birthdays`, `hangouts`, `(tabs)/nudges`, `(tabs)/settings` (a one-time handoff of these screen files to B for this phase only) |
| **5.3** (H+33 to H+34) | **A5.3** Final development build on demo phones; hide `(dev)` routes unless a dev flag is set | **B5.3** Informer demo dashboard polished; screenshots in `analytics/` |

**Merge point M5 (feature freeze at H+34):** the full demo runs twice in a row on two phones without a restart. Then only demo fixes until submission.

**Last 2 hours (H+34 to H+36):** demo script, Devpost write-up, pitch, backup screen recording of the demo.

---

## 6. Dependency map (what blocks what)

| Task | Blocked until | Why |
| --- | --- | --- |
| A1.2 profile and consent hooks | B1.1 | Rows must be created on signup |
| A1.3 circle hooks (real) | B1.2 | RPCs must exist (mock until then) |
| A1.4 push registration | B1.3 | RPC to store the token |
| A2.3 / A2.4 media upload | B0.3 | Bucket + policies |
| B2.1 interaction pushes | A1.4 | Needs real tokens to test |
| A3.4 hangout ideas (real) | B3.4 + B3.5 | Edge Function + LLM client |
| B4.2 drift score using signals | A4.5 | `daily_signals` rows (engagement-only scoring works without them) |
| B4.3 nudge engine | B4.2 + B3.5 + B1.3 | Scores, LLM wording, push sender |
| A4.7 demo screen (real) | B4.7 | Demo endpoints |
| M4 demo | B4.8 drift seed | Drift needs 17+ days of history on the real demo accounts; nobody has that from real use |
| Phase 5.2 | 5.1 theme merged + designs delivered | Screens restyle on top of the shared tokens and components |
| Every regeneration of `shared/database.types.ts` | Developer B commit | Single source of generated types |

---

## 7. Commands cheat sheet

```bash
# App (Developer A)
npx expo start --dev-client                # run against the installed dev build
EXPO_PUBLIC_USE_MOCKS=true npx expo start --dev-client   # bash/macOS. On Windows PowerShell, put EXPO_PUBLIC_USE_MOCKS=true in .env.local instead
eas build --profile development --platform ios   # only when a native module or app.config.ts changes

# Backend (Developer B)
supabase start                              # local stack
supabase migration new <name>
supabase db push                            # apply migrations to the hosted project
supabase gen types typescript --linked > shared/database.types.ts
supabase functions serve                    # local Edge Functions
supabase functions deploy <name>
supabase secrets set ANTHROPIC_API_KEY=... LLM_MODEL=...
```

---

## 8. Definition of done (every task)

- Works on a real iPhone dev build, not just the simulator.
- Typed end to end: no `any` at the `@/api` boundary.
- If a hook has a mock, the mock is updated in the same commit.
- No secrets in the app bundle (only `EXPO_PUBLIC_SUPABASE_URL` and the anon key).
- Task box ticked in your own list in section 10, commit message starts with the task ID.

---

## 9. Privacy rules (hard requirements)

1. **Raw location never leaves the phone.** Only `hours_away_from_home` and `places_visited` are uploaded.
2. **Health data never leaves the phone** except `sleep_hours` and `steps` in `daily_signals`.
3. **No message content is analyzed** for drift. The drift score uses counts and timing only.
4. **Friends never learn why they were nudged.** `reason_kind` is never sent to a client. Cover nudges are always on. **Drift and cover nudges use the exact same LLM prompt and inputs** (friend's first name, circle name, nothing else); if the prompt differed, the wording could give away which nudges are real. The LLM never receives signals, scores, or `is_quiet`.
5. **No labels.** Nothing in the database or UI says "lonely", "depressed", or similar. The only flag is `is_quiet`, and only the server sees it.
6. **Consent gates everything.** If `consents.location` or `consents.health` is false, the app does not collect that signal. If `paused_until` is in the future, no nudges are sent about that user.
7. **Informer sees only de-identified aggregates**, through a read-only role limited to the `analytics` schema.
8. **Crisis path:** the consent screen and settings link to the 988 Suicide & Crisis Lifeline. Friends are not the emergency plan.
9. **The consent copy tells the truth about this build.** Daily summary numbers (`daily_signals`) and in-app activity counts are uploaded and drift is scored **on the server**. The concept doc's "the model stays on the phone" describes a later version, so it must not appear in the consent screen.

---

## 10. Progress tracker

Tick only your own role's list (this keeps merges conflict-free). Commit the tick with the task, e.g. `A1.3: circle hooks + invite link`. Shared pre-hacking items (P0.x) are ticked in section 3.

### Developer A

- [ ] S1 · [ ] S2 · [ ] S3 · [ ] S4 · [ ] S5 · [ ] S6
- [ ] A0.1 · [ ] A0.2 · [ ] A0.3
- [ ] A1.1 · [ ] A1.2 · [ ] A1.3 · [ ] A1.4 · [ ] A1.5
- [ ] A2.1 · [ ] A2.2 · [ ] A2.3 · [ ] A2.4 · [ ] A2.5 · [ ] A2.6
- [ ] A3.1 · [ ] A3.2 · [ ] A3.3 · [ ] A3.4 · [ ] A3.5
- [ ] A4.1 · [ ] A4.2 · [ ] A4.3 · [ ] A4.4 · [ ] A4.5 · [ ] A4.6 · [ ] A4.7
- [ ] A5.1 · [ ] A5.2 · [ ] A5.3

&nbsp;

### Developer B

- [x] B0.1 · [x] B0.2 · [x] B0.3 · [x] B0.4
- [ ] B1.1 · [x] B1.2 · [x] B1.3 · [x] B1.4 · [ ] B1.5
- [ ] B2.1 · [ ] B2.2 · [ ] B2.3 · [ ] B2.4 · [x] B2.5
- [ ] B3.1 · [ ] B3.2 · [ ] B3.3 · [ ] B3.4 · [ ] B3.5
- [ ] B4.1 · [ ] B4.2 · [ ] B4.3 · [ ] B4.4 · [ ] B4.5 · [ ] B4.6 · [ ] B4.7 · [ ] B4.8
- [ ] B5.1 · [ ] B5.2 · [ ] B5.3

### Merge points (tick together)

- [ ] M0 · [ ] M1 · [ ] M2 · [ ] M3 · [ ] M4 · [ ] M5

---

## 11. Fallbacks

- **No paid Apple Developer account in time:** EAS dev builds for devices and remote push both need it. Build from a Mac with Xcode and a free personal team (`npx expo run:ios --device`), drop HealthKit (sleep/steps come from the seed), and show nudges as **local** notifications fired by a realtime subscription on `my_nudges` while the app is open. Tell both developers before switching; it changes A1.4 and B1.3.
- **EAS build queue too slow:** `eas build --local` or `npx expo run:ios --device` on the Mac (P0.6).
- **Edge Functions can't import from `/shared`:** the function bundler may not include files outside `supabase/functions/`. B checks this during B0.4. If it fails, keep request/response types in `supabase/functions/_shared/` as a copy of `shared/api.ts`, and make every change in both places in the same commit.
