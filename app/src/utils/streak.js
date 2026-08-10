// Client-side mirror of the server's "is this streak still alive" boundary,
// shared by decay_stale_streaks() (the nightly reset) and
// streak_after_completion() (the write path). See
// utils/__tests__/streak.test.js for the agreement tests.
//
// Why the UI needs its own copy: profiles.current_streak is only rewritten by
// those two, and decay runs once a day. Between the moment a user's local day
// rolls over and the moment decay next runs, the stored number can be a streak
// that is already gone - which is exactly what was reported on 2026-08-09
// (card said "4 days" when the next mark would in fact have set it to 1).
// Reading the boundary live here means the card can never claim a streak the
// next mark would not honour.

import { localDateString } from './cadence'

// Whole days from a 'YYYY-MM-DD' date to another. Noon UTC on both sides so no
// DST or timezone offset can shift the difference across a day boundary.
export function dayGap(from, to) {
  const a = Date.parse(from + 'T12:00:00Z')
  const b = Date.parse(to + 'T12:00:00Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN
  return Math.round((b - a) / 86400000)
}

// subject: { current_streak, last_complete_date, freeze_credits } from either
// profiles or family_members - both carry the same three columns.
//
// Returns:
//   streak - what the next mark would actually build on, so 0 once the gap is
//            past what a freeze can bridge.
//   frozen - a freeze is the only thing still holding this streak up, and it
//            only pays out if the user completes a day today.
export function streakState(subject, today = localDateString()) {
  const streak = subject?.current_streak ?? 0
  const last = subject?.last_complete_date
  const credits = subject?.freeze_credits ?? 0
  if (streak <= 0 || !last) return { streak: 0, frozen: false }

  const gap = dayGap(last, today)
  if (!Number.isFinite(gap)) return { streak, frozen: false }

  // gap 0 = completed today, gap 1 = completed yesterday and today is still
  // in play. Both continue normally on the next mark. Matched exactly, not
  // `gap <= 1`: a last_complete_date in the FUTURE (device clock ahead, or a
  // row written from a device a day ahead of this one) is dead on the server -
  // decay_stale_streaks resets it and streak_after_completion restarts at 1 -
  // so treating it as alive would be the very lie this module exists to stop.
  if (gap === 0 || gap === 1) return { streak, frozen: false }
  // gap 2 is the single missed day a freeze covers, and only while a credit
  // is left to spend (streak_after_completion consumes it on the next mark).
  if (gap === 2 && credits > 0) return { streak, frozen: true }
  // Anything further is beyond what one freeze bridges; the next mark starts
  // over at 1 and decay_stale_streaks will zero the stored column.
  return { streak: 0, frozen: false }
}
