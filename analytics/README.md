# Analytics: Entrinsik Informer (B4.5)

Informer gets **read-only, de-identified aggregates only** (plan §9.7). It logs in as the
Postgres role `informer_ro`, which can read the `analytics` schema and nothing else: no names,
user ids, media, message bodies, drift scores or `is_quiet`. Circles appear as a hashed
`circle_key`.

## Views (schema `analytics`)

| View | One row per | Columns |
| --- | --- | --- |
| `circle_engagement_daily` | circle per day | `circle_key`, `day`, `members`, `sent`, `received`, `opens`, `activity_per_member` |
| `daily_totals` | day | `day`, `circles`, `member_days`, `sent`, `opens`, `avg_activity_per_member` |
| `circle_engagement_alerts` | circle | `circle_key`, `recent_avg` (last 3 days), `baseline_avg` (14 days before), `drop_pct`, `alert` (drop >= 25%) |

`activity_per_member` = messages/reactions/shares sent + half the app opens, per member per day.
The data is refreshed by the nightly drift job (08:00 UTC) and whenever the demo runs drift.

## Connect Informer (one-time, Developer B)

1. **Turn on the login** (pick a strong password; don't commit it). In the Supabase dashboard
   → SQL Editor, run:
   ```sql
   alter role informer_ro with login password 'CHOOSE-A-STRONG-PASSWORD';
   ```
2. **Get the session pooler address**: Supabase dashboard → **Connect** → **Session pooler**.
   Use the *session pooler*, not the direct connection (that one is IPv6-only).
   - Host: `aws-…pooler.supabase.com` (copy from the dashboard)
   - Port: `5432`
   - Database: `postgres`
   - **User: `informer_ro.zztlrcshhvhesnocbhrh`** (role name + `.` + project ref)
   - Password: the one from step 1
   - SSL: required
3. **In Informer**: add a PostgreSQL datasource with those values. Only the `analytics` schema
   will be visible.

## Demo dashboard

- **Line chart:** `circle_engagement_daily`, x = `day`, y = `activity_per_member`, one line per
  `circle_key`. The demo circle shows the dip over the last 3 days.
- **Totals:** `daily_totals` (sent + opens per day).
- **Alert:** on `circle_engagement_alerts` where `alert = true`. This shows the circle's
  engagement dropping, without saying who.

Screenshots for the pitch go in `analytics/screenshots/`.
