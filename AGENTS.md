# AI-Dev Note: protected app/business logic

Do not change the product rules below - across every section of this file - unless Sreeni explicitly asks for that exact behavior change. Refactors, cleanup, inferred fixes, dependency work, and adjacent features are not authorization to alter them. Any explicitly authorized change must include updated SQL integration assertions, frontend mirror/component tests where they exist, this note, and (for SQL) a migration that preserves clean replay - never edit an already-applied migration to change production behavior (comment-only edits, like the AI-DEV notes themselves, are fine).

## Streak & freeze

- One local calendar day adds at most one overall streak day. Any one scheduled, `affects_streak=true` practice with a counting log completes that day.
- Any one Sandhyavandhanam slot completes Sandhya and the day; the other slots earn their configured punya but never add the daily or per-practice streak again.
- Yesterday catch-up is Sandhyavandhanam-only, exactly one local day back, forward-looking only, and awards the full configured punya. Its first counting slot completes yesterday; later slots do not double-count it.
- Backfilling yesterday must repair chronological order whether it is marked before or after today. Two consecutive completed days from a fresh streak must display streak 2.
- A freeze is consumed only by a real completion that bridges exactly one missed day. Scheduled decay never spends a freeze. A later yesterday backfill refunds exactly one only when that completion actually spent one.
- Tier crossings top freeze credits up to the tier cap. Referrals add one only up to the same cap. Freeze balances never reset to the cap merely because one was used.
- The full next local day remains a catch-up grace window. Reset happens only after that window closes and produces a durable `streak_reset` event.
- `profiles.timezone`/the parent's timezone defines the server-local day. The database RPC is authoritative; client helpers are display mirrors and must remain aligned with SQL tests.

Protected implementation surfaces:

- `app/supabase/migrations/*submit*`, `*streak*`, and the latest definitions of `submit_practice_log`, `submit_yesterday_sandhya`, `streak_after_completion`, and `decay_stale_streaks`
- `app/supabase/tests/integration-assertions.sql`
- `app/src/utils/streak.js`, `app/src/utils/cadence.js`, `app/src/hooks/useToday.js`, `app/src/hooks/useAuth.jsx`
- the Today-page daily streak card and `YesterdaySandhya` flow
- freeze/streak event notification generation and delivery

## Punya & tiers

- Punya only increases through `submit_practice_log`'s `pr.punya_value` award (see Streak & freeze above) or `apply_referral`'s signup bonus. Never award punya from client code.
- Tier thresholds (`tier_for`) are fixed bands: Shishya < 100 <= Sadhaka < 400 <= Yogi < 1000 <= Rishi < 2500 <= Brahmarishi. Freeze cap (`freeze_cap_for`) mirrors the same bands 1..5. Changing one without the other breaks the "tier crossing tops up freeze" rule above.

Protected implementation surfaces: `tier_for` (`app/supabase/migrations/*tier_for*`), `freeze_cap_for` (already covered by the `*streak*` glob above), `app/src/utils/tiers.js`.

## Referrals

- A referral code can only be applied once per referred account (`referred_by` set on first use), never self-referral, and is rate-limited to 5 applications per referrer per rolling 24 hours.
- Both sides get the same reward on a successful apply: 30 ad-free days (extending, not replacing, any existing `ad_free_until`) and one freeze credit, capped at the referrer's/referee's own current tier cap via `freeze_cap_for`.

Protected implementation surfaces: `apply_referral`, `get_my_referrals` (`app/supabase/migrations/*referral*`), the `apply_referral` call site in `app/src/hooks/useAuth.jsx`.

## Notifications & reminders

- Push delivery is claim-then-send (`claim_notification_delivery`): a delivery row is inserted as `'sending'` before the provider call, finalized to `'delivered'`/`'failed'` after. A transient provider failure must stay retryable (status `'failed'`, picked up by the next cron tick or a stuck `'sending'` row older than 5 minutes) - never silently dedupe out a real failure.
- Streak/freeze transition pushes (`freeze_used`, `streak_reset`) are event-driven from the durable `streak_events` table, not inferred from current profile state, and fire before the time-window reminder logic on every run.
- The 08:00/20:00 streak nudges gate on the same "any one `affects_streak` practice already logged today" day-completion rule as the streak logic itself (`dayComplete` mirrors `cadence.js`/the SQL bool_or aggregate) - never "every practice logged", or the nudge fires after the day is already secured.
- Freeze-aware nudge wording (`freezeNudge`) only replaces the generic nudge at the exact gaps the freeze mechanic cares about (1-day gap at 20:00, 2-day gap at 08:00) - judged against each user's own local day, never a fixed UTC cron time.
- Sandhya slot reminders are gated to male users with an active Sandhyavandhanam practice; each slot fires once, never re-sent after that slot is already logged.

Protected implementation surfaces: `claim_notification_delivery` (`app/supabase/migrations/*notification_deliver*`), `app/supabase/functions/send-reminders/`, `app/supabase/functions/send-freeze-notifications/`, `app/supabase/functions/_shared/{push,freezeNudge,streakEventMessage,observanceMatch,dayComplete,reminderWindow}.ts`, `app/src/hooks/useNotifications.js`, `app/src/utils/{notifications,pushAndroid,webPush}.js`.

## Sandhya / Samidhadhanam eligibility gating

- `check_sandhya_eligibility` (a DB trigger on `user_practices` insert) is the sole gate: Sandhyavandhanam requires male + (for family members) `upanayanam_done`; Samidhadhanam additionally requires unmarried (self) or upanayanam-done-and-unmarried (family member). These are hard `raise exception` blocks, not soft warnings - client-side checks are a UX convenience only, never the actual gate.

Protected implementation surfaces: `check_sandhya_eligibility` (`app/supabase/migrations/*sandhya_eligibility*`, `*samidhadhanam*`, `*brahmayagnam*`).

## Account deletion

- `delete_account` deletes the `auth.users` row directly; every owned row (profile, family members, practice logs, streak events, push subscriptions, referrals, etc.) must cascade via `on delete cascade`, not app-level cleanup. A new table that stores `owner_id`/`user_id` without a cascading FK silently orphans rows here - this has bitten the project before (see `docs/ROADMAP.md`'s temple-visit schema note).

Protected implementation surfaces: `delete_account` (`app/supabase/migrations/*delete_account*`).

## Leaderboard / Sabha

- `get_leaderboard` scores are period-scoped (week starts Monday via `date_trunc('week', ...)`, month via `date_trunc('month', ...)`) and scope-gated (`kids` vs. adults are separate pools, never mixed). Sabha participation is opt-in and off by default per account - never flip that default.

Protected implementation surfaces: `get_leaderboard` (`app/supabase/migrations/*leaderboard*`).

## AdMob / ads

- Ad gating (`isTesting`/dev-mode bypass, interstitial frequency, ad-free-until honoring) lives in `app/src/utils/ads.js`. `ad_free_until` from a referral or purchase must always suppress ads client-side - never show an interstitial to a user with a future `ad_free_until`.

Protected implementation surfaces: `app/src/utils/ads.js`.

## Panchangam / observance calendar

- Observance/tharpanam matching (`bestMatch`/`bestAdvanceMatch` in `observanceMatch.ts`) is priority-then-specificity ordered and category-scoped (`tharpanam` vs. `observance` never cross-match). `day_offset` on a rule means "check the neighboring day's panchangam row, fire on the candidate day" - do not reinterpret it as shifting which day the notification is dated.
- Only rules with `advance_notify = true` are eligible for the "in N days" heads-up push; routine monthly tithis (e.g. plain Amavasya) are deliberately excluded from that path.
- Tamil Nadu vs. Kerala day-1 rules differ (aparahna vs. sunset) - see memory `panchangam-day1-rules`; do not unify them.

Protected implementation surfaces: `app/supabase/migrations/*panchangam_observances*`, `*avani_avittam*`, `app/supabase/functions/_shared/observanceMatch.ts`, `app/src/utils/panchangamScript.js`.
