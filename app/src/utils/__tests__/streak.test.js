// Agreement tests for utils/streak.js against the two SQL functions it mirrors.
//
// Transcribed from the live database on 2026-08-10 (via the Supabase MCP):
//
//   submit_practice_log, on the branch where the day is complete:
//     if v_last_complete is distinct from v_today then <call the below>
//     else keep current_streak unchanged (the day is already counted)
//
//   streak_after_completion(p_streak, p_best, p_last, p_today, p_freeze):
//     if p_last = p_today - 1                          -> streak + 1
//     elsif p_last = p_today - 2 and p_freeze > 0      -> streak + 1, freeze - 1
//     else                                            -> 1
//
//   decay_stale_streaks(): the full following day is a catch-up grace window,
//     so current_streak becomes 0 only at a gap of 3+.
//
// streakState reports a streak while either a normal completion continues it
// OR yesterday's Sandhya backfill can still repair it. At gap 2 without a
// freeze, marking today first restarts at 1, but backfilling yesterday later
// reconstructs both days, so the original streak remains recoverable/displayable.

import { describe, it, expect } from 'vitest'
import { dayGap, streakState } from '../streak'

const TODAY = '2026-08-10'
const subject = (o = {}) => ({
  current_streak: 4, best_streak: 4, last_complete_date: '2026-08-09', freeze_credits: 1, ...o,
})

// Literal transcription of submit_practice_log's same-day guard plus
// streak_after_completion's branches. Returns the streak a completion on
// `today` would produce.
function sqlStreakAfterCompletion({ current_streak, last_complete_date, freeze_credits }, today) {
  const gap = dayGap(last_complete_date, today)
  if (gap === 0) return current_streak // already counted today, left untouched
  if (gap === 1) return current_streak + 1
  if (gap === 2 && freeze_credits > 0) return current_streak + 1
  return 1
}

// Literal transcription of decay_stale_streaks' WHERE clause. True when the
// nightly job would zero this subject's streak.
function sqlDecayResets({ current_streak, last_complete_date }, today) {
  const gap = dayGap(last_complete_date, today)
  return current_streak > 0 && (gap >= 3 || gap < 0)
}

describe('dayGap', () => {
  it('counts whole calendar days', () => {
    expect(dayGap('2026-08-09', TODAY)).toBe(1)
    expect(dayGap('2026-08-08', TODAY)).toBe(2)
    expect(dayGap(TODAY, TODAY)).toBe(0)
  })

  it('is not thrown off by month boundaries', () => {
    expect(dayGap('2026-07-31', '2026-08-01')).toBe(1)
    expect(dayGap('2026-02-28', '2026-03-01')).toBe(1)
  })
})

describe('streakState agrees with streak_after_completion', () => {
  const cases = [
    ['completed today', { last_complete_date: TODAY }],
    ['completed yesterday', { last_complete_date: '2026-08-09' }],
    ['one missed day, freeze available', { last_complete_date: '2026-08-08' }],
    ['one missed day, no freeze', { last_complete_date: '2026-08-08', freeze_credits: 0 }],
    ['two missed days, freeze available', { last_complete_date: '2026-08-07' }],
    ['two missed days, no freeze', { last_complete_date: '2026-08-07', freeze_credits: 0 }],
    ['a week away', { last_complete_date: '2026-08-03' }],
    // Reachable from a device whose clock is ahead, or a second device a day
    // behind the one that wrote the row. Both server functions treat a future
    // date as dead, so the mirror must too.
    ['completed "tomorrow" (clock skew)', { last_complete_date: '2026-08-11' }],
  ]

  it.each(cases)('%s: reports 0 exactly when neither today nor backfill can preserve it', (_label, o) => {
    const s = subject(o)
    const gap = dayGap(s.last_complete_date, TODAY)
    const recoverable = sqlStreakAfterCompletion(s, TODAY) !== 1 || gap === 2
    expect(streakState(s, TODAY).streak > 0).toBe(recoverable)
  })

  it.each(cases)('%s: reports 0 exactly when decay would zero it', (_label, o) => {
    const s = subject(o)
    expect(streakState(s, TODAY).streak === 0).toBe(sqlDecayResets(s, TODAY))
  })
})

describe('streakState frozen flag', () => {
  it('is set only for the single missed day a freeze can still cover', () => {
    expect(streakState(subject({ last_complete_date: '2026-08-08' }), TODAY).frozen).toBe(true)
  })

  it('is not set on an ordinary in-progress day', () => {
    expect(streakState(subject({ last_complete_date: '2026-08-09' }), TODAY).frozen).toBe(false)
    expect(streakState(subject({ last_complete_date: TODAY }), TODAY).frozen).toBe(false)
  })

  it('keeps the streak recoverable during the catch-up day even without a freeze', () => {
    const s = subject({ last_complete_date: '2026-08-08', freeze_credits: 0 })
    expect(streakState(s, TODAY)).toEqual({ streak: 4, frozen: false })
  })

  it('is not set once the gap is past what one freeze bridges', () => {
    expect(streakState(subject({ last_complete_date: '2026-08-07' }), TODAY).frozen).toBe(false)
  })
})

describe('streakState edge cases', () => {
  it('treats a subject that has never completed a day as no streak', () => {
    expect(streakState(subject({ current_streak: 0, last_complete_date: null }), TODAY))
      .toEqual({ streak: 0, frozen: false })
  })

  it('survives a missing subject while the profile is still loading', () => {
    expect(streakState(undefined, TODAY)).toEqual({ streak: 0, frozen: false })
    expect(streakState(null, TODAY)).toEqual({ streak: 0, frozen: false })
  })

  it('falls back to the stored value if the date is unparseable', () => {
    expect(streakState(subject({ last_complete_date: 'not-a-date' }), TODAY).streak).toBe(4)
  })

  // The exact production row from the 2026-08-09 report, after the decay job
  // had already spent the credit: the card showed 4, the next mark gave 1.
  it('reports the reported production row honestly', () => {
    const reported = { current_streak: 4, last_complete_date: '2026-08-07', freeze_credits: 0 }
    expect(sqlStreakAfterCompletion(reported, TODAY)).toBe(1)
    expect(streakState(reported, TODAY)).toEqual({ streak: 0, frozen: false })
  })
})
