# Data Safety - what Nithyakarma collects

Reference for the Play Console **Data Safety** form and the Privacy Policy. Keep
this in sync whenever data collection changes.

## Collected

| Data | Purpose | Stored where | Shared with third party? | Optional? |
|------|---------|--------------|--------------------------|-----------|
| Email address | Account / auth | Supabase (our backend) | No | Required for account |
| Display name | Profile, leaderboard | Supabase | No | Required |
| Gender | Determines Sandhyavandhanam eligibility | Supabase | No | Required at onboarding |
| Practice logs, streaks, punya, tier | Core app function | Supabase | No | Core function |
| Family member profiles (name, gender) | Parent tracks kids | Supabase | No | Optional |
| Referral code / graph | Referral rewards | Supabase | No | Optional |
| Push token (FCM / web push) | Reminder notifications | Supabase | Google FCM (delivery only) | Optional (notifications off by default) |
| **Analytics events** (event name + numeric/flag props, no PII) | Product analytics (funnel/retention) | **Supabase (first-party, our own DB)** | **No third-party analytics vendor** | On for signed-in users |
| **Crash/error reports** | Stability | **Sentry** | Sentry (processor) | Only if a crash occurs |

## Key privacy stances
- **Analytics is first-party.** Events go to our own `analytics_events` table.
  Props carry only event names + numbers/flags (e.g. `day_complete`,
  `overall_streak`) - never names, email, or practice content. RLS restricts
  inserts to the signed-in user; reads are service-role only.
- **Crash reporting via Sentry** runs with `sendDefaultPii: false` (no IPs,
  request bodies, or user PII) and only activates when `VITE_SENTRY_DSN` is set.
- **Account deletion is real** (`delete_account` removes the auth user; data
  cascades). Analytics rows are de-identified on deletion (`user_id -> null`).
- Leaderboard visibility is user-controllable (opt-out).

## Play Console form implications
- Declare: Personal info (email, name), App activity (analytics), App info and
  performance (crash logs), plus Messages/Device IDs only if push is enabled.
- "Data shared with third parties": Sentry (crash), Google FCM (push delivery).
  No analytics data sold or shared.
- Provide the hosted Privacy Policy URL (Phase 0 item).
