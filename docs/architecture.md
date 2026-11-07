# Sunny Side Up — Architecture & Build Plan Overview

> **Background only.** This is the earlier overview. For ownership, folders, phases, the table and API contract, and task IDs, **[`plan.md`](plan.md) is the source of truth and wins on any conflict.** In particular, the "Two-developer split" section below is superseded: plan.md has 6 phases (0–5), a wider folder layout (A owns `app/` and `src/`; B owns `supabase/`, `analytics/`, `scripts/`), and a three-file contract in `/shared`. Hangout ideas use the circle's typed `home_area`, not a places API.

iOS-first app built with Expo (React Native) on a Supabase backend, with an LLM for nudge wording and hangout ideas. Built for the Triangle AI Hackathon at Duke, November 6–8, 2026 (36 hours of build time). The calendar features are parked for now.

## Architecture

### Stack at a glance

| Layer | Choice | Why |
| --- | --- | --- |
| Mobile app | Expo + React Native + TypeScript, with Expo Router | One codebase, fast iteration, and the team can demo on real iPhones. |
| Build mode | Expo development build (not Expo Go) | HealthKit and background location need native modules that Expo Go can't load. |
| Backend | Supabase | Postgres database, sign-in, file storage, realtime updates, server functions, and scheduled jobs in one service. |
| Push notifications | Expo Notifications (delivers through Apple's push service) | Simplest way to push from the server to iPhones. |
| AI | An LLM API (for example Claude) called from Supabase Edge Functions | Writes nudge wording and suggests hangout ideas. The API key never sits in the app. |
| Maps and places | Apple MapKit, or Google Places API | For AI hangout suggestions near the group. |

### Mobile app components

1. **Auth and onboarding.** Sign in with Apple or email. Signup includes the consent screen: a plain list of every signal, with a toggle for each, and agreement that friends may be nudged automatically.
2. **Circles.** Create a circle, invite by link, join, and see members.
3. **Feed and tiny interactions.** Send a photo, a short voice memo, or an egg to a person or the whole circle. Uses expo-camera, expo-audio, and Supabase Storage.
4. **Rhythm.** The weekly Sunday share and spotlight days, where each day belongs to one member.
5. **Birthdays.** Stored per member, with reminders to the circle.
6. **Moment shout-outs.** A member chooses to flag a big day, such as an interview, so the circle sends good luck.
7. **Passive signals (on the phone).** Core Location visits through expo-location, and sleep and steps through a HealthKit module such as react-native-health. These turn into simple daily numbers on the phone; raw data never leaves it.
8. **Settings and privacy.** Per-signal toggles, pause, "what the app saw", and delete everything.

### Backend components (Supabase)

1. **Database tables:** users, circles, circle\_members, interactions (photo, voice, egg), shares (Sunday and spotlight posts), birthdays, moments, daily\_signals (one row of computed numbers per user per day), engagement\_scores, and nudges.
2. **Row-level security.** Each user can only read circles they belong to. Nobody can read another member's signals or scores.
3. **Storage buckets** for photos and voice memos, private to each circle.
4. **Drift detection job** (scheduled, for example every night). Compares each person's recent in-app engagement and daily signals with their own baseline, and flags who is going quiet. No diagnosis or label is stored.
5. **Nudge engine** (Edge Function). Picks a friend to nudge, mixes in random cover nudges on normal days, asks the LLM to word the prompt, and sends the push.
6. **Rhythm scheduler** (scheduled jobs). Opens the Sunday share, rotates spotlight days, and sends birthday reminders.
7. **Hangout ideas** (Edge Function). Asks the LLM for activity ideas, using places data.

### How data flows

1. The phone turns raw location and health data into a few daily numbers, such as hours away from home and hours of sleep.
2. Only those numbers, plus in-app activity, go to Supabase.
3. The nightly job compares each person with their own normal.
4. If someone is drifting, the nudge engine sends a friend a natural prompt to reach out, with no reason attached.
5. Every interaction feeds back into the engagement score.

## Build plan

### Before hacking starts

- [ ] Create the Expo project, set up a development build, and install it on each team phone.
- [ ] Create the Supabase project and the database tables.
- [ ] Get an LLM API key and an Apple developer account for push notifications and HealthKit.
- [ ] Split roles: mobile UI, backend and jobs, AI and drift detection, demo and pitch.

### Two-developer split

Developer A owns the mobile app; Developer B owns the backend, AI, and Entrinsik Informer analytics. Each works in separate folders, so merges rarely touch the same files. They meet at a shared contract and merge at the end of each phase.

**Ground rules to avoid merge conflicts:**

- **Separate folders.** A works only in `/app` (screens, components, hooks). B works only in `/supabase` (migrations, edge functions, cron jobs) and `/analytics`.
- **Shared contract first.** Before Phase 1, both agree on `/shared/types.ts` (table shapes, API inputs and outputs). Changes to it go through a quick check with the other person.
- **Mock until merge.** A builds screens against mock data that matches the contract; B tests functions with scripts. Real wiring happens at each merge point.
- **Short-lived branches.** One branch per phase per person (for example `a/phase-1`), merged to `main` at each merge point.
- **UI is plain until the end.** Screens use unstyled, functional components so the final design pass can restyle everything in one place.

| Phase | Developer A: mobile app | Developer B: backend, AI, analytics | Merge point |
| --- | --- | --- | --- |
| 0. Setup (together, \~2 hrs) | Expo project, dev build on phones, navigation skeleton | Supabase project, tables, row-level security, storage buckets | Agree on `/shared/types.ts` and folder layout |
| 1. Core loop (\~10 hrs) | Sign-in and consent screen, create and join circles, feed, send eggs and photos (mock data) | Auth setup, circle invite links, interactions API, push notification sending | Wire screens to real Supabase; send an egg end to end |
| 2. Rhythm and closeness (\~8 hrs) | Voice memo recording, Sunday share and spotlight screens, birthdays and shout-out screens | Rhythm scheduler jobs, birthday reminders, shout-out notifications | Weekly rhythm working live on two phones |
| 3. Quiet drift (\~8 hrs) | On-phone daily numbers from location and HealthKit, upload to `daily_signals`, settings and privacy screens | Engagement score, nightly drift job, nudge engine with cover nudges and LLM wording, hangout ideas, Informer dashboards and alerts | A quiet member triggers a friend nudge |
| 4. UI integration and demo (\~8 hrs, together) | Apply the final design: theme, colors, fonts, icons, animations across all screens | Seed two weeks of fake history, Informer demo dashboard, bug fixes | Final build, demo script, Devpost write-up and pitch |

**Entrinsik Informer (Developer B):** connect the Supabase Postgres database to Informer for engagement dashboards and automated drift alerts, aiming for the "best use of Entrinsik" prize. Send only numbers and engagement counts, never photos or voice memos.

## Open questions

- [ ] Which hackathon track to enter, and whether to aim for a sponsor prize, such as Entrinsik's.
- [ ] Rule-based drift score or a small model? Rule-based is safer for 36 hours.
- [ ] Sign in with Apple only, or email too?
- [ ] When the calendar features come back, they only read busy or free, never event details.
