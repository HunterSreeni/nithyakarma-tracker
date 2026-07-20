# 02 - Postgres Functions and RPCs

All 13 functions in schema `public`, verified against `pg_proc` on 18 July 2026,
`submit_practice_log`'s day-completion step re-verified 20 July 2026.

| Function | Security | Lang | Called from |
|---|---|---|---|
| [`submit_practice_log`](#submit_practice_log) | DEFINER | plpgsql | Client RPC |
| [`apply_referral`](#apply_referral) | DEFINER | plpgsql | Client RPC |
| [`get_leaderboard`](#get_leaderboard) | DEFINER | plpgsql | Client RPC |
| [`get_my_referrals`](#get_my_referrals) | DEFINER | sql | Client RPC |
| [`delete_account`](#delete_account) | DEFINER | plpgsql | Client RPC |
| [`streak_after_completion`](#streak_after_completion) | INVOKER | plpgsql | Internal |
| [`check_sandhya_eligibility`](#check_sandhya_eligibility) | DEFINER | plpgsql | Trigger |
| [`tier_for`](#tier_for) | INVOKER | sql | Internal |
| [`freeze_cap_for`](#freeze_cap_for) | INVOKER | sql | Internal |
| [`is_scheduled`](#is_scheduled) | INVOKER | sql | Internal |
| [`prev_scheduled`](#prev_scheduled) | INVOKER | sql | Internal |
| [`validate_count`](#validate_count) | INVOKER | sql | Internal |
| `rls_auto_enable` | DEFINER | plpgsql | Event trigger |

---

## submit_practice_log

```sql
submit_practice_log(
  p_user_practice_id uuid,
  p_slot text,
  p_count integer,
  p_local_date date,
  p_award_streak boolean
) returns jsonb
```

**The single write path into `practice_logs`.** `practice_logs` has no INSERT policy, so
this SECURITY DEFINER function is the only way a log can be created.

### Behaviour, in order

1. **Resolve the date.** `p_local_date` is used if supplied and within ±1 day of
   `current_date`; otherwise falls back to `current_date`. The clamp prevents a client
   from backdating or future-dating logs arbitrarily while still allowing genuine
   timezone offsets.

   > This is the fix for bug B1 (UTC server vs IST client). An IST user doing
   > Pratahkala Sandhyavandhanam at 05:00 local is at 23:30 UTC the *previous* day;
   > without the local date the log landed on the wrong server day and the Today page
   > showed it as not done.

2. **Validate** `p_count` via `validate_count` (nulls anything outside 1-10000).
3. **Authorize** - loads `user_practices` filtered by `owner_id = auth.uid()`; raises
   `Practice association not found` otherwise.
4. **Check scheduling** via `is_scheduled`; raises `This practice is not scheduled today`.
5. **Slot rules** - Sandhyavandhanam requires a slot; every other practice has its slot
   forced to `null`.
6. **Sequence advance** - for `sequence` cadence, increment `sequence_position`, wrapping
   to 1 past `sequence_length`.
7. **Insert** the log row.
8. **Per-practice completion** - Sandhyavandhanam needs 3 slot rows that day; everything
   else is done on one row.
9. **Per-practice streak** - if complete and `p_award_streak`, increment when
   `last_log_date = prev_scheduled(...)`, else reset to 1.
10. **Award punya** to the subject (`profiles` or `family_members`) by `punya_value`.
11. **Tier-up top-up** - if `freeze_cap_for(new_punya) > freeze_cap_for(old_punya)`, raise
    `freeze_credits` to the new cap.
12. **Day completion** - `bool_and` across *every scheduled practice for that subject*
    **where `practices.affects_streak = true`**, counting only logs with
    `counts_toward_streak = true`. The `affects_streak` filter (added `20260719060618`)
    fixes a real bug: `hanuman-chalisa` (Learning page) is a daily-cadence practice logged
    with `p_award_streak = false`, so its logs never satisfy `counts_toward_streak`. Before
    this filter existed, that practice still joined the `bool_and` every day and could never
    be satisfied - marking a single verse permanently froze the subject's day completion
    and overall streak, even though the UI's `isDoneToday` (which doesn't filter
    `counts_toward_streak`) showed the day as done. `affects_streak = false` now excludes
    Learning-style practices from the day-completion check entirely - they earn punya but
    neither advance nor block the streak.
13. **Subject streak** - if the day just completed and `last_complete_date` is not today,
    delegate to `streak_after_completion`, then persist streak, best, date and credits.

### Returns

```jsonc
{
  "saved": true,
  "practice_name": "...",
  "practice_done_today": true,
  "practice_streak": 5,
  "day_complete": true,
  "overall_streak": 12,
  "best_streak": 30,
  "punya": 415,
  "tier": "Yogi",
  "sequence_position": null,
  "freeze_used": false,
  "freeze_credits": 3
}
```

`day_complete` drives `CelebrationModal`, the interstitial ad, the in-app review prompt
and `suppressTodayNudgesIfScheduled()`. `freeze_used` drives the "a freeze saved your
streak" message.

---

## streak_after_completion

```sql
streak_after_completion(
  p_streak int, p_best int, p_last date, p_today date, p_freeze int
) returns (new_streak int, new_best int, new_freeze int, freeze_used boolean)
```

The streak state machine, isolated as a pure function so it can be unit-tested in SQL.

| Condition | Result |
|---|---|
| `p_last = p_today - 1` | streak + 1, no credit consumed |
| `p_last = p_today - 2` **and** credit available | streak + 1, credit decremented, `freeze_used = true` |
| Anything else (2+ day gap, or no credit) | streak resets to 1 |

`new_best` is `greatest(p_best, new_streak)`. **One freeze covers exactly one missed
day** - a two-day gap always resets regardless of credits held.

---

## tier_for / freeze_cap_for

Punya thresholds, kept in lockstep. Mirrored client-side in `src/utils/tiers.js`.

| Punya | Tier | Freeze cap |
|---|---|---|
| 0-99 | Shishya | 1 |
| 100-399 | Sadhaka | 2 |
| 400-999 | Yogi | 3 |
| 1000-2499 | Rishi | 4 |
| 2500+ | Brahmarishi | 5 |

> These two functions and `utils/tiers.js` must be changed together. There is no test
> asserting the SQL and JS agree.

---

## is_scheduled / prev_scheduled

```sql
is_scheduled(p_cadence text, p_weekday integer, p_date date) returns boolean
prev_scheduled(p_cadence text, p_date date) returns date
```

```sql
-- is_scheduled
select case
  when p_cadence = 'weekly' then extract(dow from p_date)::int = p_weekday
  else true
end
```

`is_scheduled` special-cases **only** `weekly`; `daily`, `daily_count` and `sequence` are
all "scheduled every day". `prev_scheduled` returns `p_date - 7` for weekly, `p_date - 1`
otherwise.

Client mirror: `isScheduled()` in `src/utils/cadence.js`.

> **This is the extension point for thithi cadence.** Adding a `thithi` branch that joins
> `panchangam_days` is the minimal change needed for lunar-day observances.

---

## validate_count

```sql
select case when p is null or p < 1 or p > 10000 then null else p end
```

Silently nulls out-of-range counts rather than raising.

---

## apply_referral

```sql
apply_referral(p_code text) returns jsonb
```

1. Resolve `p_code` to a referrer; raise `Invalid referral code` if unknown
2. Raise `Cannot refer yourself` if it is the caller's own code
3. **Rate limit:** count that referrer's referrals in the last 24 hours; raise if >= 5
4. Insert the `referrals` edge (the `referred_id` UNIQUE index prevents double-claiming)
5. Grant **both** parties +30 days `ad_free_until` and +1 `freeze_credits`, capped at
   `freeze_cap_for(punya)`

The 24-hour cap (migration `20260716144330_referral_rate_limit`) closes finding S3 from
the July 16 analysis, which noted unlimited ad-free farming via throwaway accounts.

> Residual: the cap slows farming but does not stop a patient attacker (5/day
> compounds). Verifying the caller is a genuinely new account would close it properly.

---

## get_leaderboard

```sql
get_leaderboard(p_period text, p_scope text)
  returns table(subject_id uuid, display_name text, punya int,
                tier text, streak int, score bigint, is_me boolean)
```

SECURITY DEFINER, so it reads across profiles by design.

**`score` is not punya.** It is the count of *completed days* in the period - days where
a practice was logged, requiring 3 slot rows for Sandhyavandhanam and 1 for everything
else. Punya is returned alongside but the ranking is `score desc, streak desc`, limit 50.

**Period:** `p_period = 'month'` starts at `date_trunc('month')`, anything else at
`date_trunc('week')`.

**Three scopes:**

| Scope | Population | Visibility gate |
|---|---|---|
| `global` | All profiles | `leaderboard_opt_in OR id = auth.uid()` |
| `friends` | Profiles connected to the caller by a `referrals` edge in **either** direction | Same, plus the referral join |
| `kids` | `family_members` | `bala_sabha_opt_in` - a **separate** flag from the adult one |

Two privacy details worth preserving in any rewrite:

- **You always see yourself**, even when opted out (`OR id = auth.uid()`), so the board
  is never confusingly empty for a private user.
- **Kids are shown by first name only** - `split_part(fm.name, ' ', 1)` - so a child's
  full name never reaches another household.

Zero-score rows are filtered out except the caller's own (`score > 0 OR is_me`).

Migrations that shaped the current posture:
- `20260716144249_leaderboard_opt_in` - flipped opt-out to opt-in, closing S4
- `20260716151620_leaderboard_hide_zero_score` - closing B4
- `20260717093000_fix_leaderboard_score_ambiguity` - the `select * from (...) t` wrapper
  exists to disambiguate `score`/`streak` between the output columns and the source
  columns

---

## get_my_referrals

```sql
select p.id, p.display_name, r.created_at
from referrals r join profiles p on p.id = r.referred_id
where r.referrer_id = (select auth.uid())
order by r.created_at desc;
```

Exists because RLS on `profiles` would otherwise hide the referred users' display names.

---

## delete_account

```sql
delete_account() returns void
-- body: delete from auth.users where id = auth.uid();
```

A one-liner. It deletes the `auth.users` row and lets **FK cascades do everything else**:
`profiles.id` references `auth.users.id` on cascade, and every other user-owned table
cascades from `profiles`. A Play Store data-deletion requirement.

> The flip side of relying on cascades: any future table holding user data must declare
> `on delete cascade` or it will silently orphan rows after a deletion. Check this when
> adding tables (e.g. the `observances`/temple work in later phases).

> This is why the destructive Playwright journey (`@destructive`, account `e2efull`)
> cannot run in CI - it self-destructs and is not repeatable. It is a manual
> pre-release gate.

---

## check_sandhya_eligibility

BEFORE INSERT trigger on `user_practices`. No-ops unless the practice has
`is_sandhyavandhanam`.

- **Account holder** (`family_member_id IS NULL`): requires `profiles.gender = 'male'`
- **Child**: requires `gender = 'male'` **and** `upanayanam_done = true`

Enforced in the database, not just the UI - the client cannot bypass it.

---

## rls_auto_enable

Event trigger that enables RLS automatically on newly created tables, from
`20260707075303_security_hardening`. A guard against a future migration forgetting it.

## Related

- Table and RLS detail: [01-DATABASE.md](01-DATABASE.md)
- Client mirrors of this logic: [05-FRONTEND.md](05-FRONTEND.md)
