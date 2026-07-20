# 01 - Database

Supabase project `fkrifejzhnhknkuyhjhp`, Postgres 17.6.1.141, schema `public`.
**RLS is enabled on all 13 tables.** Verified 18 July 2026, columns refreshed 20 July 2026
against a live schema pull (see `README.md`'s "Keeping this current" for the regen query).

Row counts below are production values at verification time and are indicative only.

## Table index

| Table | Rows | Purpose |
|---|---|---|
| [`profiles`](#profiles) | 5 | The account holder: identity, streak, punya, perks |
| [`family_members`](#family_members) | 0 | Children tracked by a parent (Bala Sabha) |
| [`practices`](#practices) | 15 | The catalog of observances |
| [`user_practices`](#user_practices) | 7 | Which subject tracks which practice |
| [`practice_logs`](#practice_logs) | 23 | Every completion event |
| [`referrals`](#referrals) | 1 | Referrer to referred edges |
| [`learning_progress`](#learning_progress) | 4 | Verses marked learned |
| [`panchangam_days`](#panchangam_days) | 365 | Precomputed daily panchangam |
| [`notification_preferences`](#notification_preferences) | 3 | Opt-in and timezone |
| [`push_subscriptions`](#push_subscriptions) | 3 | FCM tokens and web-push endpoints |
| [`notification_deliveries`](#notification_deliveries) | 59 | Send ledger, doubles as dedupe |
| [`analytics_events`](#analytics_events) | 151 | First-party event stream |
| [`app_config`](#app_config) | 5 | Server-side config and secrets |

---

## profiles

The account-level subject. One row per auth user; `id` is the `auth.users` id.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | FK `auth.users.id` |
| `display_name` | text | |
| `gender` | text | CHECK in (`male`, `female`) |
| `referral_code` | text UNIQUE | `substr(md5(gen_random_uuid()::text), 1, 8)` |
| `referred_by` | uuid NULL | FK `profiles.id` |
| `ad_free_until` | date NULL | Gates ads; set by referral, later by subscription |
| `reminder_times` | jsonb | `{"morning":"09:00","afternoon":"12:30","evening":"18:30"}` |
| `punya` | integer | `0` |
| `current_streak` | integer | `0` |
| `best_streak` | integer | `0` |
| `last_complete_date` | date NULL | Drives streak/freeze arithmetic |
| `leaderboard_opt_in` | boolean | `false` - opt **in**, privacy-safe default |
| `freeze_credits` | integer | `1` |
| `community_enabled` | boolean | `false` |
| `created_at` | timestamptz | `now()` |

**Indexes:** `profiles_pkey (id)`, `profiles_referral_code_key (referral_code)` UNIQUE,
`idx_profiles_referred_by (referred_by)`

**RLS:** four separate policies, all `id = auth.uid()` - `select`, `insert`, `update`,
`delete`. A user can only ever see their own row through the client.

> Note: `get_leaderboard` is SECURITY DEFINER and therefore reads other profiles by
> design, gated on `leaderboard_opt_in`. See [02-RPCS.md](02-RPCS.md).

---

## family_members

Children whose observances a parent tracks. Has its own punya, streak and freeze
credits - structurally a parallel subject to `profiles`.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `parent_id` | uuid | FK `profiles.id` ON DELETE CASCADE |
| `name` | text | |
| `gender` | text | CHECK in (`male`, `female`) |
| `upanayanam_done` | boolean | `false` - gates Sandhyavandhanam eligibility |
| `bala_sabha_opt_in` | boolean | `false` |
| `punya` | integer | `0` |
| `current_streak` | integer | `0` |
| `best_streak` | integer | `0` |
| `last_complete_date` | date NULL | |
| `freeze_credits` | integer | `1` |
| `created_at` | timestamptz | `now()` |

**Indexes:** `family_members_pkey (id)`, `idx_family_members_parent (parent_id)`

**RLS:** one `ALL` policy, `parent_id = auth.uid()`.

> **0 rows in production.** Bala Sabha is described as a key differentiator but has
> never been exercised by a real user. Flagged in [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md).

---

## practices

The catalog. Read-only to clients; seeded and extended by migration.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | integer PK | `nextval('practices_id_seq')` |
| `slug` | text UNIQUE | |
| `name` | text | |
| `icon` | text | `'🕉️'` |
| `cadence` | text | CHECK in (`daily`, `daily_count`, `weekly`, `sequence`) |
| `weekday` | integer NULL | CHECK 0-6, only meaningful for `weekly` |
| `target_count` | integer NULL | For `daily_count` |
| `sequence_length` | integer NULL | For `sequence`, wraps back to 1 |
| `is_sandhyavandhanam` | boolean | `false` - triggers three-slot handling |
| `active` | boolean | `true` - inactive rows are invisible via RLS |
| `has_learning_content` | boolean | `false` |
| `punya_value` | integer | `5` |
| `affects_streak` | boolean | `true` - `false` for `hanuman-chalisa`; excluded from the day-completion `bool_and` in `submit_practice_log` so a Learning-page log can't permanently block the streak (migration `20260719060618`) |

**Indexes:** `practices_pkey (id)`, `practices_slug_key (slug)` UNIQUE

**RLS:** `SELECT` for `authenticated` where `active`. No write policy - catalog changes
are migrations only.

> The `cadence` CHECK is the constraint that must be extended to add `thithi` support
> (Phase 3 of the Phase 2 plan).

---

## user_practices

The join between a subject and a practice. `family_member_id NULL` means the practice
belongs to the account holder.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid | FK `profiles.id` |
| `family_member_id` | uuid NULL | FK `family_members.id` |
| `practice_id` | integer | FK `practices.id` |
| `current_streak` | integer | `0` - per-practice streak |
| `best_streak` | integer | `0` |
| `last_log_date` | date NULL | |
| `sequence_position` | integer | `0` |
| `created_at` | timestamptz | `now()` |

**Indexes:** `user_practices_pkey (id)`, `idx_user_practices_family_member`,
`idx_user_practices_practice`, and

```sql
user_practices_unique UNIQUE (owner_id,
  COALESCE(family_member_id, '00000000-0000-0000-0000-000000000000'::uuid), practice_id)
```

The `COALESCE` sentinel is the idiom used throughout this schema to make a nullable
column participate in a unique constraint.

**RLS:** one `ALL` policy, `owner_id = auth.uid()`.

**Trigger:** `check_sandhya_eligibility` (BEFORE INSERT) rejects Sandhyavandhanam for
non-male profiles, and for children without `upanayanam_done`.

---

## practice_logs

One row per completion. For Sandhyavandhanam, three rows per day (one per slot).

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_practice_id` | uuid | FK `user_practices.id` |
| `owner_id` | uuid | FK `profiles.id` |
| `log_date` | date | `CURRENT_DATE`, overridden by the client's local date |
| `slot` | text NULL | CHECK in (`morning`, `afternoon`, `evening`) |
| `count` | integer NULL | For `daily_count` practices |
| `sequence_position` | integer NULL | For `sequence` practices |
| `counts_toward_streak` | boolean | `true` |
| `created_at` | timestamptz | `now()` |

**Indexes:** `practice_logs_pkey (id)`, `idx_practice_logs_owner`, `practice_logs_date`,
and

```sql
practice_logs_unique UNIQUE (user_practice_id, log_date, COALESCE(slot, 'day'))
```

**RLS:** `SELECT` and `DELETE` only, both `owner_id = auth.uid()`.
**There is deliberately no INSERT or UPDATE policy** - the only write path is the
SECURITY DEFINER `submit_practice_log` RPC. This is the schema's most important
security property.

`counts_toward_streak = false` exists so a log can record an observance without
advancing the streak (used for exempt/backfilled entries).

---

## referrals

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `referrer_id` | uuid | FK `profiles.id` |
| `referred_id` | uuid UNIQUE | FK `profiles.id` - a user can only be referred once |
| `created_at` | timestamptz | `now()` |

**Indexes:** `referrals_pkey`, `referrals_referred_id_key` UNIQUE, `idx_referrals_referrer`

**RLS:** `SELECT` where the caller is either side of the edge. Writes go through
`apply_referral`, which enforces a **5-per-24-hours cap per referrer**.

---

## learning_progress

One row per verse learned, per subject. Same shape and RLS pattern as `practice_logs`.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid | FK `profiles.id` ON DELETE CASCADE |
| `family_member_id` | uuid NULL | FK `family_members.id` ON DELETE CASCADE |
| `content_slug` | text | e.g. `hanuman-chalisa` |
| `verse_id` | text | |
| `learned_at` | timestamptz | `now()` |

**Indexes:** `learning_progress_pkey`, and

```sql
learning_progress_unique UNIQUE (owner_id,
  COALESCE(family_member_id, '000...0'::uuid), content_slug, verse_id)
```

**RLS:** `select`, `insert`, `delete`, all `owner_id = auth.uid()`. No `update` -
learning a verse is append-only.

---

## panchangam_days

Precomputed one row per calendar day. See [08-PANCHANGAM.md](08-PANCHANGAM.md) for how
it is generated.

| Column | Type |
|---|---|
| `date` | date **PK** |
| `thithi` | text |
| `nakshatra` | text |
| `rahu_kalam_start` / `rahu_kalam_end` | text |
| `yamagandam_start` / `yamagandam_end` | text |
| `gulika_kalam_start` / `gulika_kalam_end` | text |
| `tamil_month` / `tamil_day` | text / integer |
| `malayalam_month` / `malayalam_day` | text / integer |
| `varsham_name` | text |
| `kollavarsham_year` | integer, NOT NULL | Kerala's own year count (Malayalam Era), separate from `varsham_name`'s 60-cycle name - rolls over at Chingam 1, not Mesha Sankranti. Added `20260719110709`, backfilled and made NOT NULL in `20260719110828` |

**Indexes:** `panchangam_days_pkey (date)`

**RLS:** `SELECT` for `authenticated`, `USING (true)` - the whole table is readable by
any signed-in user. Writes are service-role only (grant-level, no policy).

**Current contents:** 365 rows covering 2026, computed for Kochi, Kerala
(9.9312N, 76.2673E). Kalam times are sunrise-based and drift for other locations.

---

## notification_preferences

| Column | Type | Default |
|---|---|---|
| `user_id` | uuid **PK** | FK `profiles.id` |
| `enabled` | boolean | `false` |
| `timezone` | text | `'Asia/Kolkata'` |
| `updated_at` | timestamptz | `now()` |

**RLS:** one `ALL` policy, `user_id = auth.uid()`.

Migration `20260716151502_normalize_timezone_alias` normalized the deprecated
`Asia/Calcutta` alias to `Asia/Kolkata`.

---

## push_subscriptions

Holds both transports. For Android, `endpoint` is the FCM token; for web it is the
push service URL and `p256dh`/`auth_key` carry the VAPID keys.

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | FK `profiles.id` |
| `endpoint` | text | FCM token or web-push endpoint URL |
| `p256dh` | text NULL | Web push only |
| `auth_key` | text NULL | Web push only |
| `platform` | text | `'web'`, CHECK in (`web`, `android`) |
| `created_at` | timestamptz | `now()` |

**Indexes:** `push_subscriptions_pkey`, `idx_push_subs_user_platform (user_id, platform)`,
`push_subscriptions_user_endpoint_key (user_id, endpoint)` UNIQUE

**RLS:** one `ALL` policy, `user_id = auth.uid()`.

---

## notification_deliveries

The send ledger. Its unique index is the **idempotency mechanism** - the sender inserts
before sending and treats a duplicate-key error as "already sent, skip".

| Column | Type | Default / Constraint |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid | FK `profiles.id` |
| `reminder_date` | date | The user's **local** date |
| `slot` | text | CHECK in (`morning`, `afternoon`, `evening`, `nudge`, `nudge_morning`) |
| `endpoint` | text | Truncated to 500 chars by the sender |
| `sent_at` | timestamptz | `now()` |

**Indexes:** `notification_deliveries_pkey`, and

```sql
UNIQUE (user_id, reminder_date, slot, endpoint)
```

**RLS:** `SELECT` only, `user_id = auth.uid()`. Inserts are service-role.

> ### Fixed 2026-07-18: the morning nudge had never been sent
>
> Until migration `20260718170117_notification_deliveries_nudge_morning_slot`, this
> CHECK omitted `nudge_morning` - the slot name `send-reminders/index.ts:45` emits for
> the 08:00 window. Every insert failed the constraint, and the sender's
> `if (dupErr) continue;` swallowed the failure as "already sent" and skipped the user.
> The 08:00 nudge was silently dropped for every user, every day, since launch.
>
> **Evidence at the time:** `afternoon` 13 rows, `evening` 17, `morning` 14, `nudge` 15,
> and **zero `nudge_morning` rows, ever**. The four working slots mapped exactly to
> their IST windows (03:30 UTC = 09:00 IST, 07:00 = 12:30, 13:00 = 18:30, 14:30 = 20:00);
> the 08:00 IST window (02:30 UTC) was entirely absent.
>
> The sender's error handling was also narrowed to Postgres code `23505` so that only a
> genuine unique violation is treated as "already sent" - any other insert failure now
> logs instead of vanishing.
>
> **Lesson worth keeping:** a catch-all `if (err) continue` on a dedupe path converts
> every future schema mismatch into silent data loss. This one hid for months.

---

## analytics_events

First-party analytics. No third-party vendor, no PII in `props`.

| Column | Type | Default |
|---|---|---|
| `id` | bigint PK | identity, ALWAYS |
| `user_id` | uuid NULL | FK `auth.users.id` |
| `event` | text | |
| `props` | jsonb | `'{}'` |
| `platform` | text NULL | |
| `created_at` | timestamptz | `now()` |

**Indexes:** `analytics_events_pkey`, `idx_analytics_events_user_time (user_id, created_at)`,
`idx_analytics_events_event_time (event, created_at)`

**RLS:** `INSERT` only, for `authenticated`, `WITH CHECK (user_id = auth.uid())`.
Clients can write events but **cannot read them back** - there is no SELECT policy.

---

## app_config

Key-value server config. **Contains secrets.**

| Column | Type |
|---|---|
| `key` | text **PK** |
| `value` | text |

**RLS:** enabled with **no policy at all** - intentional. Only `service_role` has table
grants, so it is unreachable from any client.

Holds `vapid_private_key`, `vapid_public_key`, `vapid_email`, `cron_secret`. The pg_cron
job reads `cron_secret` from here to authenticate to the edge function.

> Secrets in table rows is a known compromise. They were rotated in July 2026. Edge
> function env vars or Supabase Vault is the better long-term home. See
> [09-STATUS-LEDGER.md](09-STATUS-LEDGER.md).

---

## Grants summary

Table grants are the second layer under RLS, and they matter: a July 2026 outage was
caused by `service_role` lacking explicit grants (new `sb_secret_` keys do **not**
bypass grants).

| Role | Pattern |
|---|---|
| `anon` | `REFERENCES, TRIGGER, TRUNCATE` only on every table - effectively no data access |
| `authenticated` | Full DML on all tables except `app_config`; RLS does the real gating |
| `service_role` | Read-only on `practices`, `profiles`, `user_practices`, `practice_logs`; full DML on `app_config`, `notification_deliveries`, `notification_preferences`, `push_subscriptions`; INSERT/SELECT/UPDATE on `panchangam_days` |

`service_role` deliberately has **no write access** to `practice_logs` or `profiles` -
the reminder function reads state but can never mutate a user's record.

## Related

- Function behaviour: [02-RPCS.md](02-RPCS.md)
- Migration history: [04-MIGRATIONS.md](04-MIGRATIONS.md)
