# Proposal: egg war backend (design v0.5 "play!")

Status: **backend applied to hosted, contract waiting for Developer A's OK** (2026-11-08).
Migrations `20261108001200_egg_war.sql` + `20261108001300_demo_analytics.sql` are live (additive:
nothing existing changed shape). `shared/` types are regenerated in a separate `contract:` commit that
should merge only once Developer A agrees. `src/api/` is untouched (Developer A's call).
`scripts/rls-test` covers it (124 checks); the live stage was tested in a rolled-back SQL scenario.
Author: Developer B.

## The design, mapped to backend

| Design (artifact v0.5) | Backend |
| --- | --- |
| **play! → initiate egg war** (coop of 3+) | `start_egg_war(p_circle_id)` → war row, state `vote`, 24 h countdown; the starter is opted in; the rest of the coop gets an `egg_war` notification |
| **opted in / opted out boxes**, "still deciding: …" | `vote_egg_war(p_war_id, p_choice 'in'\|'out')`, change your mind until it resolves. Read `egg_war_people` (or `egg_war_status`) |
| "n of m in. needs k to start" | `egg_war_status(p_circle_id).need` = more than half the coop (`members / 2 + 1`) |
| countdown ends → **war begins** (3 days) or **"they chose peace"** | resolver runs every minute (pg_cron) and inside every egg war RPC. It also resolves early once everyone has voted. Live: players get "the egg war has begun!". Off: the opted-in get "egg war called off" |
| starter changes their mind | `cancel_egg_war(p_war_id)`: starter only, during the vote (not in the design; small addition) |
| **join** a live war late | `join_egg_war(p_war_id)` |
| **EGG yolk = camera → "who did you get?"** tag + caption (100 max) | upload to `media/{circle_id}/{snipe_id}.jpg`, then `post_snipe(p_war_id, p_target_id, p_media_path, p_caption?, p_id?)`. Target gets "you got egged 🥚 · @x sniped you: caption" |
| **leaderboard** sniper / sniped / score (can go negative) | `egg_war_status(...).war.board` = `[{user_id, sniper, sniped, score}]`, sorted |
| **feed** of snipes | `egg_war_snipes` (coop members can read; Realtime on) |
| **war over** → winner + final leaderboard; "the feed is cleared when a war ends" | state `over`, `final_board` + `snipe_count` kept; snipes **and their photos are deleted**; whole coop gets "the egg war is over · @x wins!" |
| "demo: skip to the end of the countdown" / "end the war now" | `demo_skip_egg_war(p_war_id)`: **demo coop only**, so it can't touch a real coop |

## Contract (`shared/`)

**Tables** (read-only for clients, writes only through RPCs):

| Table | Columns | Who can read |
| --- | --- | --- |
| `egg_wars` | `id`, `circle_id`, `started_by`, `state` (`vote`, `live`, `off`, `over`), `vote_ends_at`, `live_ends_at`, `members`, `snipe_count`, `final_board`, `created_at`, `resolved_at` | coop members |
| `egg_war_people` | `war_id`, `user_id`, `choice` (`in`, `out`), `updated_at` | coop members |
| `egg_war_snipes` | `id`, `war_id`, `circle_id`, `sniper_id`, `target_id`, `caption`, `media_path`, `created_at` | coop members, while the war is live |

All three are in the `supabase_realtime` publication.

**RPCs:** `start_egg_war`, `vote_egg_war`, `cancel_egg_war`, `join_egg_war`, `post_snipe`,
`delete_snipe` (the sniper **or the person in the photo**), `egg_war_status`, `demo_skip_egg_war`.

`egg_war_status(p_circle_id)` returns:
```ts
{
  members: number; need: number; can_start: boolean;
  war: null | {
    id: string; state: 'vote' | 'live' | 'off' | 'over'; started_by: string | null;
    vote_ends_at: string; live_ends_at: string | null; created_at: string;
    people: { user_id: string; choice: 'in' | 'out' }[];
    board: { user_id: string; sniper: number; sniped: number; score: number }[];
    snipes: number;
  };
}
```
It returns the active war or, if none is active, the latest finished one (so "they chose peace" or the final
board can be shown).

**Notifications:** new `notification_type` value `egg_war`. `target_id` = war id. Route a tap to the war
page of `circle_id`.

**Suggested hooks for `@/api` (Developer A decides):** `useEggWar(circleId)` (status + realtime on the
three tables), `useStartEggWar`, `useVoteEggWar`, `useCancelEggWar`, `useJoinEggWar`, `usePostSnipe`
(upload + RPC, like `usePostDailyPhoto`), `useDeleteSnipe`, `useEggWarSnipes(warId)`, `useDemoSkipEggWar`.

## Privacy and safety choices

- Only people who **opted in** can be sniped, and nobody can snipe themselves. Opt-in is the consent to
  candid photos.
- The person in a snipe can delete it. Snipes and their photos are **deleted when the war ends** (the design
  says so; it also keeps candid photos from piling up). Media cleanup knows about snipes.
- Snipe photos must sit in the coop's own storage folder; readable only by coop members.
- Egg war activity does **not** feed drift scoring (no change to `build_engagement`), so the game can't
  make someone look "quiet" or "active".
- Informer gets only `analytics.egg_war_summary` (circle key, date, state, member and opt-in counts,
  snipe count). No names, photos or captions.

## Demo

**Reset demo** now also: sets the cast's first names (Ella, Jocelyn, Caden) where they were never set,
and starts an **egg war vote in the demo coop by Caden** (about 20 h left, Caden is in). On stage:
Jocelyn opts in → 2 of 3 = enough; Ella opts out → everyone voted → the war goes live at once. Snipe
someone, then `demo_skip_egg_war` to end it and show the winner.

## Not built (on purpose)

- **"location summary: friends see the city you're in"** (artifact settings): breaks plan §9.1 (raw
  location never leaves the phone, and friends never see signals). Agreed with Developer A: not built.
- **"sleep and steps: share how you slept with your coops"** (artifact settings): the same problem under
  §9.2. Health numbers may only go to the server for drift scoring, never to friends. Suggest the
  toggle keeps today's meaning (collect for nudges or not) with that wording, or is dropped.
- **"friendly nudges about me"** already exists: `consents.auto_nudges` (nudge engine skips you when off).
  No backend change.
