# 04 - Migration Ledger

58 migrations in `app/supabase/migrations/`, 58 applied to project
`fkrifejzhnhknkuyhjhp`. Verified 18 July 2026, ledger extended 20 July 2026, extended
again 4 August 2026 after the batches below.

## 2-4 August 2026

Written 2 August; **could not be applied that day** because the Supabase MCP in this dev
environment was authenticated to a different, unrelated project ("Kalanjali2026" - a
deliberate account switch for other work, not an error). Re-authenticated to
`fkrifejzhnhknkuyhjhp` 4 August 2026 - all 6 applied that day, in this order, plus a
`send-reminders` function redeploy (version 13) to match.

| Migration | What it does |
|---|---|
| `20260802090000_any_practice_completes_day_and_tier_up` | `submit_practice_log`: day-completion `bool_and` -> `bool_or` (any one scheduled practice completes the day, not all); adds `tier_up` to the RPC's return |
| `20260802093000_streak_decay_cron` | New `decay_stale_streaks()` + daily `pg_cron` job - zeroes streaks that went stale while a subject was inactive (previously never decayed, see 09-STATUS-LEDGER.md) |
| `20260802150000_monthly_specials_all_months` | `monthly_specials.route` made nullable; **reshapes the PK** from `malayalam_month` alone to `(calendar, month)` so the table can hold both traditions; seeds the 11 remaining Malayalam months |
| `20260802153000_avani_avittam_and_advance_notify` | New `panchangam_observances.advance_notify` column; seeds Avani Avittam (Yajurveda); widens `notification_deliveries.slot` CHECK for `observance_advance` |
| `20260804060000_monthly_specials_tamil_months` | Seeds all 12 Tamil months into the reshaped `monthly_specials` (`calendar = 'tamil'`) - closes the gap where `profiles.panchangam_tradition` defaults to `'tamil'` but only a Malayalam banner existed |
| `20260804070000_decay_stale_streaks_revoke_execute` | `revoke execute on function decay_stale_streaks() from anon, authenticated, public` - the initial migration missed this repo's usual internal-only-function revoke, caught by `mcp__supabase__get_advisors` right after applying (function had no `auth.uid()` scoping and was reachable via `/rest/v1/rpc/decay_stale_streaks`) |

**Two bugs caught before applying, both fixed in the committed files, not just live:**
`20260802150000` originally spelled the last Malayalam month `'Midhunam'` - the real
value loaded in `panchangam_days.malayalam_month` is `'Mithunam'`, so that row would have
silently never matched (no CHECK constraint on the column, no error, just a banner that
never shows for that month). Caught by cross-checking `select distinct malayalam_month
from panchangam_days` before applying. The Tamil month spellings in `20260804060000`
(`'Karthikai'` not `'Karthigai'`, etc.) were verified the same way beforehand specifically
because of this near-miss.

`MonthlySpecialBanner.jsx` was also updated this session to branch on
`profile.panchangam_tradition` (mirroring `PanchangamBox.jsx`) - before this batch it
queried `monthly_specials` by `malayalam_month` unconditionally, so a Tamil-tradition user
(the default) never saw a banner match at all even before the Tamil rows existed.

## 4 August 2026, Learning tab content

| Migration | What it does |
|---|---|
| `20260804090000_five_more_learning_content_texts` | `has_learning_content = true` for 5 practices (Dakshinamurthy Stotram, Aditya Hrudayam, Subrahmanya Bhujangam, Mukundamala, Sri Rudram) |
| `20260804100000_sandhyavandhanam_samidhadhanam_video_content` | Same flag for Sandhyavandhanam and Samidhadhanam - video-only Learning entries, see [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md#4-august-additions---learning-tab-content) |

Both are schema-identical single-column `UPDATE`s - the actual content is either verse
JSON in the `learning-content` Storage bucket (first migration; **not yet uploaded**, see
the status ledger) or a `youtubeUrl` baked into `LearningPage.jsx` (second migration,
fully live).

## Drift status: closed, with a caveat

Every migration **name** matches 1:1 between git and the database. Nothing is applied
remotely that is missing from git, and nothing in git is unapplied.

**However, 18 of the 58 have different timestamp prefixes** between the local filename
and the recorded remote version. 10 are a leftover from the reconstruction work that
closed Intent R4 - the DDL was re-applied through the MCP, which stamped its own
timestamps. The other 8 are the 4 August 2026 batches below - `mcp__supabase__apply_migration`
always stamps the version at actual apply time regardless of the `name` argument passed
(same mechanism, different cause: these were simply applied after being written, not
reconstructed).

| Migration name | Local filename prefix | Remote version |
|---|---|---|
| `streak_freeze` | `20260712100000` | `20260712094627` |
| `analytics_events` | `20260712120000` | `20260712104231` |
| `get_my_referrals` | `20260715113314` | `20260715060812` |
| `community_enabled` | `20260715120000` | `20260715073920` |
| `rename_tiers` | `20260715130000` | `20260715105845` |
| `learning_content` | `20260716054549` | `20260716055038` |
| `panchangam_days` | `20260716060856` | `20260716060912` |
| `panchangam_service_role_grant` | `20260716061247` | `20260716061242` |
| `drop_learning_content_list_policy` | `20260716061818` | `20260716061839` |
| `punya_weighting_and_streak_exempt_logs` | `20260717090000` | `20260717055954` |
| `fix_leaderboard_score_ambiguity` | `20260717093000` | `20260717060635` |
| `any_practice_completes_day_and_tier_up` | `20260802090000` | `20260804030844` |
| `streak_decay_cron` | `20260802093000` | `20260804030856` |
| `monthly_specials_all_months` | `20260802150000` | `20260804030912` |
| `avani_avittam_and_advance_notify` | `20260802153000` | `20260804030923` |
| `monthly_specials_tamil_months` | `20260804060000` | `20260804030941` |
| `decay_stale_streaks_revoke_execute` | `20260804070000` | `20260804031049` |
| `five_more_learning_content_texts` | `20260804090000` | `20260804041154` |
| `sandhyavandhanam_samidhadhanam_video_content` | `20260804100000` | `20260804045249` |

**Why this is safe:** the *relative ordering* is identical in both sets. Every migration
sorts into the same sequence locally as remotely, so a clean replay from git produces the
same schema. The mismatch is cosmetic.

**Why it still matters:** a naive drift check comparing filename prefixes to
`list_migrations` versions will report 18 false positives. Compare **names**, not
timestamps.

---

## Drift-check procedure

Run before every release (this is Intent R4's standing gate):

```bash
ls app/supabase/migrations/*.sql | sed 's/.*\/[0-9]*_//; s/\.sql$//' | sort > /tmp/local.txt
```

Then `mcp__supabase__list_migrations`, extract the `name` field, sort, and diff against
`/tmp/local.txt`. **An empty diff is the passing condition.** Any line present on one
side only is real drift and must be reconciled before shipping.

Per project rule, reconstruct missing DDL via `mcp__supabase__execute_sql` and commit it
as a migration. Never use `supabase db pull`.

---

## Chronological ledger

### Foundation - 7 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260707075111` | `core_schema` | `profiles`, `family_members`, `practices`, `user_practices`, `practice_logs`, `referrals` |
| `20260707075126` | `seed_practices` | Seeded the practice catalog |
| `20260707075235` | `rpcs_and_guards` | `submit_practice_log`, `is_scheduled`, `prev_scheduled`, `tier_for`, `check_sandhya_eligibility` |
| `20260707075303` | `security_hardening` | RLS policies, the `rls_auto_enable` event trigger |
| `20260707080633` | `table_grants` | Role grants for `anon` / `authenticated` / `service_role` |
| `20260707130524` | `leaderboard_opt_out` | First leaderboard, opt-**out** model |
| `20260707130741` | `push_notifications_schema` | `push_subscriptions`, `notification_preferences`, `notification_deliveries`, `app_config` |
| `20260707130948` | `reminders_cron` | The 15-minute pg_cron job |
| `20260707131315` | `audit_fixes` | Post-audit corrections |
| `20260707131404` | `submit_rpc_count_validation` | `validate_count` |

> ⚠️ `push_notifications_schema` committed the live VAPID private key and cron secret in
> plaintext (finding S1). Both rotated since; the values remain in git history.

### Account lifecycle - 11 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260711120953` | `delete_account_rpc` | Play-required account deletion |
| `20260711122657` | `service_role_read_grants` | **Fixed the push outage** - `sb_secret_` keys do not bypass table grants |

### Retention mechanics - 12 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260712094627` | `streak_freeze` | `freeze_credits`, `freeze_cap_for`, `streak_after_completion` (Intent 1.1) |
| `20260712104231` | `analytics_events` | First-party analytics table (Intent 1.3) |

### Push and social - 14-15 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260714032226` | `push_subscriptions_per_user_unique` | UNIQUE `(user_id, endpoint)` |
| `20260715060812` | `get_my_referrals` | Reads referred display names past RLS |
| `20260715073920` | `community_enabled` | Community opt-in flag |
| `20260715105845` | `rename_tiers` | Tier names to Shishya → Brahmarishi. **Dropped `tier_for`'s `search_path`**, creating finding S5 |

### Learning and panchangam - 16 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260716055038` | `learning_content` | `learning_progress`, `practices.has_learning_content` (Intent 2.1a) |
| `20260716060912` | `panchangam_days` | The precomputed panchangam table (Intent 2.7) |
| `20260716061242` | `panchangam_service_role_grant` | Grants for the generation script |
| `20260716061839` | `drop_learning_content_list_policy` | Removed an over-permissive policy |

> These four are the reconstruction migrations that closed Intent R4's schema drift.

### Security and correctness sweep - 16 July 2026

Migrations closing findings from the 16 July project analysis:

| Version | Name | Closes |
|---|---|---|
| `20260716144213` | `tier_for_search_path` | **S5** - restored `set search_path = public` |
| `20260716144249` | `leaderboard_opt_in` | **S4** - flipped opt-out to opt-in |
| `20260716144330` | `referral_rate_limit` | **S3** - 5 referrals per referrer per 24h |
| `20260716144405` | `submit_local_date` | **B1** - the timezone bug; added `p_local_date` |
| `20260716144729` | `drop_submit_practice_log_3arg_overload` | Removed the stale 3-arg signature |
| `20260716151502` | `normalize_timezone_alias` | **B8** - `Asia/Calcutta` → `Asia/Kolkata` |
| `20260716151620` | `leaderboard_hide_zero_score` | **B4** - hide inactive zero-score users |

### Punya weighting - 17 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260717055954` | `punya_weighting_and_streak_exempt_logs` | `practices.punya_value`, `practice_logs.counts_toward_streak` |
| `20260717060635` | `fix_leaderboard_score_ambiguity` | Wrapped the leaderboard query to disambiguate `score`/`streak` |

### Streak-freeze and calendar fixes - 18-19 July 2026

| Version | Name | What it did |
|---|---|---|
| `20260718170117` | `notification_deliveries_nudge_morning_slot` | Added `nudge_morning` to the `slot` CHECK - fixes **B9**, the 08:00 nudge that had silently never sent (see [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md)) |
| `20260719060618` | `practices_affects_streak` | `practices.affects_streak` (default `true`, `false` for `hanuman-chalisa`); adds `and p2.affects_streak` to `submit_practice_log`'s day-completion `bool_and`. Fixes a Learning-page log permanently blocking day completion |
| `20260719110709` | `panchangam_kollavarsham_year` | `panchangam_days.kollavarsham_year int`, nullable first (365 existing rows to backfill) |
| `20260719110828` | `panchangam_kollavarsham_year_not_null` | Same column, flipped `NOT NULL` after backfill/verification against `scripts/panchangam-2026.json` |

---

## Archive

`app/supabase/migrations/_archive/` holds superseded files. Not replayed; ignore for
drift checks.

## Conventions

- Timestamp prefix `YYYYMMDDHHMMSS`, then a snake_case name
- Apply through `mcp__supabase__apply_migration`, **never** the `supabase` CLI
- Additive by preference. Constraint changes need an explicit drop-and-recreate
- Any new user-data table needs `on delete cascade` back to `profiles`, or
  `delete_account` will orphan its rows

## Related

- Resulting schema: [01-DATABASE.md](01-DATABASE.md)
- Function bodies: [02-RPCS.md](02-RPCS.md)
