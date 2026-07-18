# 04 - Migration Ledger

31 migrations in `app/supabase/migrations/`, 31 applied to project
`fkrifejzhnhknkuyhjhp`. Verified 18 July 2026.

## Drift status: closed, with a caveat

Every migration **name** matches 1:1 between git and the database. Nothing is applied
remotely that is missing from git, and nothing in git is unapplied.

**However, 10 of the 31 have different timestamp prefixes** between the local filename
and the recorded remote version. This is a leftover from the reconstruction work that
closed Intent R4 - the DDL was re-applied through the MCP, which stamped its own
timestamps.

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

**Why this is safe:** the *relative ordering* is identical in both sets. Every migration
sorts into the same sequence locally as remotely, so a clean replay from git produces the
same schema. The mismatch is cosmetic.

**Why it still matters:** a naive drift check comparing filename prefixes to
`list_migrations` versions will report 10 false positives. Compare **names**, not
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
