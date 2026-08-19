// AI-DEV NOTE: Protected day-completion mirror. See AGENTS.md "Notifications &
// reminders" and "Streak & freeze" - do not change without Sreeni's explicit
// instruction; must stay aligned with cadence.js and the SQL bool_or aggregate.
//
// Mirrors app/src/utils/cadence.js's dayComplete/isScheduled (client-side)
// and the bool_or day-completion aggregate inside public.submit_practice_log
// (see migration 20260802090000_any_practice_completes_day_and_tier_up.sql):
// ANY ONE affects_streak, scheduled practice with a counts_toward_streak log
// today completes the day - not every scheduled practice. For
// sandhyavandhanam, any 1 of the 3 slots is enough (see
// 20260720160000_sandhya_one_slot_completes_day.sql).
//
// The 8am/8pm streak-nudge push must check THIS, not "every practice
// logged", or it nags after the streak is already secured (reported
// 2026-08-06: user marks one practice, streak counts, 8pm push still says
// "mark for today").

export interface PracticeLike {
  cadence?: string | null
  weekday?: number | null
  is_sandhyavandhanam?: boolean | null
  affects_streak?: boolean | null
}

export interface LogLike {
  log_date: string
  counts_toward_streak?: boolean | null
}

// Same UTC-noon trick the caller uses elsewhere for weekday checks, so a
// 'YYYY-MM-DD' string reads the same weekday regardless of server TZ.
export function isScheduled(practice: PracticeLike, dateStr: string): boolean {
  if (practice.cadence !== "weekly") return true
  return new Date(dateStr + "T12:00:00Z").getUTCDay() === practice.weekday
}

export function dayComplete(
  items: { practice: PracticeLike; logs: LogLike[] }[],
  dateStr: string,
): boolean {
  return items.some(({ practice, logs }) => {
    if (practice.affects_streak === false) return false
    if (!isScheduled(practice, dateStr)) return false
    const counting = logs.filter(
      (l) => l.log_date === dateStr && l.counts_toward_streak !== false,
    )
    return counting.length > 0
  })
}
