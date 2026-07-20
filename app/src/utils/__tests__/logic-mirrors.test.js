// Agreement tests for the client/server logic mirrors.
//
// Three pieces of logic exist twice - once in JS for the UI, once in SQL for the
// authoritative write path. Nothing forced them to stay in step, so a change to one
// side could silently diverge from the other. These tests pin them together.
//
// The `sql*` helpers below are literal transcriptions of the Postgres source, quoted
// in the comment above each. When a migration changes one of those functions, update
// the transcription here in the same commit - a failing test then tells you which JS
// mirror also needs updating.
//
// Refresh the transcriptions with (via the Supabase MCP, never the CLI):
//   select proname, prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
//   where n.nspname = 'public'
//     and proname in ('is_scheduled', 'tier_for', 'freeze_cap_for', 'submit_practice_log');
//
// Verified against the live database on 2026-07-20 (sandhya day-completion
// threshold moved from >= 3 slots to >= 1 - marking just 1 of the 3 sandhyas
// now completes the day; get_leaderboard's independent slot-count check moved
// with it, see migration 20260720160000_sandhya_one_slot_completes_day).

import { describe, it, expect } from 'vitest'
import { isScheduled, isDoneToday, countsTowardDayCompletion, SANDHYA_SLOTS } from '../cadence'
import { tierFor, TIERS } from '../tiers'

// ---------------------------------------------------------------------------
// SQL transcriptions
// ---------------------------------------------------------------------------

// public.is_scheduled(p_cadence text, p_weekday integer, p_date date):
//   select case
//     when p_cadence = 'weekly' then extract(dow from p_date)::int = p_weekday
//     else true
//   end
// Postgres `extract(dow)` is 0 = Sunday, matching JS getDay().
const sqlIsScheduled = (cadence, weekday, date) =>
  cadence === 'weekly' ? date.getDay() === weekday : true

// public.tier_for(p_punya integer):
//   select case
//     when p_punya >= 2500 then 'Brahmarishi'
//     when p_punya >= 1000 then 'Rishi'
//     when p_punya >= 400  then 'Yogi'
//     when p_punya >= 100  then 'Sadhaka'
//     else 'Shishya'
//   end
const sqlTierFor = (punya) =>
  punya >= 2500 ? 'Brahmarishi'
    : punya >= 1000 ? 'Rishi'
      : punya >= 400 ? 'Yogi'
        : punya >= 100 ? 'Sadhaka'
          : 'Shishya'

// public.freeze_cap_for(p_punya integer):
//   select case
//     when p_punya >= 2500 then 5
//     when p_punya >= 1000 then 4
//     when p_punya >= 400  then 3
//     when p_punya >= 100  then 2
//     else 1
//   end
const sqlFreezeCapFor = (punya) =>
  punya >= 2500 ? 5 : punya >= 1000 ? 4 : punya >= 400 ? 3 : punya >= 100 ? 2 : 1

// The per-practice half of the day-completion `bool_and` inside
// public.submit_practice_log:
//   case when p2.is_sandhyavandhanam then
//     (select count(*) from practice_logs pl
//       where pl.user_practice_id = up2.id and pl.log_date = v_today
//         and pl.counts_toward_streak) >= 1
//   else
//     exists (select 1 from practice_logs pl
//       where pl.user_practice_id = up2.id and pl.log_date = v_today
//         and pl.counts_toward_streak)
//   end
const sqlPracticeComplete = (practice, logs) => {
  const counting = logs.filter(l => l.counts_toward_streak)
  return practice.is_sandhyavandhanam ? counting.length >= 1 : counting.length > 0
}

// ---------------------------------------------------------------------------

const CADENCES = ['daily', 'daily_count', 'weekly', 'sequence']
// A full week of local-midnight dates. Constructed with the Y/M/D constructor so
// they are local dates, matching how Postgres treats a `date`. Parsing an ISO
// string instead would give UTC midnight and shift the weekday in negative-offset
// timezones.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(2026, 6, 19 + i))

describe('isScheduled mirrors SQL is_scheduled', () => {
  it('agrees across every cadence, weekday and date in a week', () => {
    for (const cadence of CADENCES) {
      for (let weekday = 0; weekday < 7; weekday++) {
        for (const date of WEEK) {
          expect(
            isScheduled({ cadence, weekday }, date),
            `cadence=${cadence} weekday=${weekday} date=${date.toDateString()}`,
          ).toBe(sqlIsScheduled(cadence, weekday, date))
        }
      }
    }
  })

  it('agrees across a year boundary', () => {
    const dates = [new Date(2026, 11, 31), new Date(2027, 0, 1), new Date(2028, 1, 29)]
    for (const date of dates) {
      for (let weekday = 0; weekday < 7; weekday++) {
        expect(isScheduled({ cadence: 'weekly', weekday }, date))
          .toBe(sqlIsScheduled('weekly', weekday, date))
      }
    }
  })

  it('WEEK covers all seven weekdays, so the matrix is exhaustive', () => {
    expect(new Set(WEEK.map(d => d.getDay())).size).toBe(7)
  })
})

describe('tierFor mirrors SQL tier_for', () => {
  // Every threshold, plus the values either side of it, plus a negative guard.
  const BOUNDARIES = [0, 100, 400, 1000, 2500]
  const CASES = [-1, ...BOUNDARIES.flatMap(b => [b - 1, b, b + 1]), 99999]

  it('agrees on every tier boundary and either side of it', () => {
    for (const punya of CASES) {
      expect(tierFor(punya), `punya=${punya}`).toBe(sqlTierFor(punya))
    }
  })

  it('TIERS thresholds match the SQL cutoffs exactly', () => {
    expect(TIERS.map(t => t.min)).toEqual(BOUNDARIES)
    expect(TIERS.map(t => t.name))
      .toEqual(['Shishya', 'Sadhaka', 'Yogi', 'Rishi', 'Brahmarishi'])
  })

  // freeze_cap_for has no JS mirror - the UI reads freeze_credits from the DB
  // rather than recomputing the cap. This test exists so that if someone ever adds
  // one, the shared thresholds are already pinned. The caps are 1..5 stepping at
  // exactly the tier boundaries, so the two SQL functions must move together.
  it('freeze_cap_for steps at the same thresholds as the tier ladder', () => {
    expect(BOUNDARIES.map(sqlFreezeCapFor)).toEqual([1, 2, 3, 4, 5])
    for (const b of BOUNDARIES.slice(1)) {
      expect(sqlFreezeCapFor(b - 1)).toBeLessThan(sqlFreezeCapFor(b))
    }
  })
})

describe('isDoneToday vs the SQL day-completion bool_and', () => {
  const sandhya = { is_sandhyavandhanam: true }
  const daily = { is_sandhyavandhanam: false }
  const log = (slot) => ({ slot, counts_toward_streak: true })

  it('agrees for a sandhyavandhanam practice at every stage of the day', () => {
    const stages = [
      [],
      [log('morning')],
      [log('morning'), log('afternoon')],
      [log('morning'), log('afternoon'), log('evening')],
    ]
    for (const logs of stages) {
      expect(isDoneToday(sandhya, logs), `${logs.length} slots`)
        .toBe(sqlPracticeComplete(sandhya, logs))
    }
  })

  it('agrees for a plain daily practice', () => {
    expect(isDoneToday(daily, [])).toBe(sqlPracticeComplete(daily, []))
    expect(isDoneToday(daily, [log(null)])).toBe(sqlPracticeComplete(daily, [log(null)]))
  })

  // 2026-07-20: sandhya day-completion no longer requires all 3 distinct slots
  // (that used to depend on practice_logs_unique making "3 rows" == "3 distinct
  // slots" - now any 1 row/slot is enough, so that distinction stopped mattering).
  it('any single slot satisfies sandhya completion (only 1 of 3 is required)', () => {
    for (const s of SANDHYA_SLOTS) {
      expect(isDoneToday(sandhya, [log(s.key)])).toBe(true)
      expect(sqlPracticeComplete(sandhya, [log(s.key)])).toBe(true)
    }
  })

  // isDoneToday deliberately does NOT filter counts_toward_streak - it answers
  // "was this logged today", which is what the per-practice tick and LearningPage's
  // already-logged guard need. countsTowardDayCompletion is the mirror of the SQL
  // rule. Keeping both, with this test, is what stops them being conflated again.
  it('isDoneToday still reports a non-counting log as logged', () => {
    const logs = [{ slot: null, counts_toward_streak: false }]
    expect(isDoneToday(daily, logs)).toBe(true)
  })

  it('countsTowardDayCompletion mirrors SQL for non-counting logs', () => {
    const logs = [{ slot: null, counts_toward_streak: false }]
    expect(countsTowardDayCompletion(daily, logs)).toBe(sqlPracticeComplete(daily, logs))
    expect(countsTowardDayCompletion(daily, logs)).toBe(false)
  })

  it('countsTowardDayCompletion agrees with SQL across mixed sandhya logs', () => {
    const mixed = [
      log('morning'),
      { slot: 'afternoon', counts_toward_streak: false },
      log('evening'),
    ]
    expect(countsTowardDayCompletion(sandhya, mixed)).toBe(sqlPracticeComplete(sandhya, mixed))
    expect(countsTowardDayCompletion(sandhya, mixed)).toBe(true)
  })

  // Logs loaded from older rows may predate the column; treat missing as counting,
  // matching the NOT NULL DEFAULT true on practice_logs.counts_toward_streak.
  it('treats an absent counts_toward_streak as counting, like the column default', () => {
    expect(countsTowardDayCompletion(daily, [{ slot: null }])).toBe(true)
  })
})

// The server-side half of the fix: a practice with affects_streak = false is
// excluded from the day-completion set entirely, so it can neither advance nor
// block the streak. Migration 20260719060618_practices_affects_streak.
//
//   ... from user_practices up2 join practices p2 on p2.id = up2.practice_id
//       where up2.owner_id = up.owner_id
//         and up2.family_member_id is not distinct from up.family_member_id
//         and p2.affects_streak
//         and is_scheduled(p2.cadence, p2.weekday, v_today)
describe('affects_streak gating', () => {
  const sqlDayComplete = (practices) => {
    const gating = practices.filter(p => p.affects_streak)
    if (!gating.length) return false // bool_and over zero rows is NULL -> coalesce false
    return gating.every(p => sqlPracticeComplete(p, p.logs))
  }

  it('a learning-style practice cannot block day completion', () => {
    const day = [
      { is_sandhyavandhanam: false, affects_streak: true, logs: [{ counts_toward_streak: true }] },
      { is_sandhyavandhanam: false, affects_streak: false, logs: [{ counts_toward_streak: false }] },
    ]
    expect(sqlDayComplete(day)).toBe(true)
  })

  it('and cannot complete the day on its own either', () => {
    const day = [
      { is_sandhyavandhanam: false, affects_streak: false, logs: [{ counts_toward_streak: false }] },
    ]
    expect(sqlDayComplete(day)).toBe(false)
  })

  it('a streak-affecting practice still gates as before', () => {
    const day = [
      { is_sandhyavandhanam: false, affects_streak: true, logs: [] },
      { is_sandhyavandhanam: false, affects_streak: true, logs: [{ counts_toward_streak: true }] },
    ]
    expect(sqlDayComplete(day)).toBe(false)
  })
})
