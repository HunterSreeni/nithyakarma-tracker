# AI-Dev Note: protected streak and freeze logic

Do not change the following product rules unless Sreeni explicitly asks for that exact behavior change. Refactors, cleanup, inferred fixes, dependency work, and adjacent features are not authorization to alter them.

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

Any explicitly authorized change must include updated SQL integration assertions, frontend mirror/component tests, this note, and a migration that preserves clean replay. Do not edit an already-applied migration to change production behavior.
