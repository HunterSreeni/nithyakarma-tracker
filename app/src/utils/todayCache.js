// Last-known Today list for a subject, so reopening the app paints the
// practice cards immediately instead of sitting on a spinner.
//
// Same shape and reasoning as useAuth's nk_profile_cache_v1: the profile cache
// already makes the header and streak card appear instantly, but useToday had
// no equivalent, so the app shell rendered around a spinner while
// user_practices + practice_logs went out. On reopen those queue behind
// getSession()'s token refresh, which is what made it a multi-second wait
// rather than a flicker (reported 2026-08-10, ~5-6s on a real device).
//
// Self-correcting: useToday overwrites this on every successful fetch, and
// only seeds from it on the initial load - never on the refresh after a mark,
// where showing the pre-mark list would flash the tick back off.

import { isScheduled, localDateString } from './cadence'

const KEY = 'nk_today_cache_v1'

// familyMemberId is null for the account holder. Normalised on both sides so a
// stored null never matches an undefined argument by accident.
function sameSubject(cached, ownerId, familyMemberId) {
  return cached.userId === ownerId &&
    (cached.familyMemberId ?? null) === (familyMemberId ?? null)
}

// Returns items ready to render, or null when there is nothing trustworthy to
// show (no cache, different subject, corrupt JSON, or nothing scheduled today)
// - in which case the caller should fall back to its normal loading state.
export function readTodayCache(ownerId, familyMemberId, now = new Date()) {
  let cached
  try {
    cached = JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null // corrupt JSON / private-mode storage - just skip the cache
  }
  if (!cached?.userId || !Array.isArray(cached.items)) return null
  if (!sameSubject(cached, ownerId, familyMemberId)) return null

  // A cache written on an earlier day still has the right practices but the
  // wrong logs - a new day legitimately starts unmarked, so drop them rather
  // than briefly showing yesterday's ticks. Re-filter by cadence too: a weekly
  // practice cached on its own weekday must not appear on a day it isn't
  // scheduled.
  const sameDay = cached.date === localDateString(now)
  const items = cached.items
    .filter(i => i?.practice && isScheduled(i.practice, now))
    .map(i => ({ ...i, logs: sameDay ? (i.logs ?? []) : [] }))
    .sort((a, b) => (b.practice.is_sandhyavandhanam ? 1 : 0) - (a.practice.is_sandhyavandhanam ? 1 : 0))

  // An empty result would render the "start with a suggested anushtanam" empty
  // state for a moment before the real list lands, which reads as data loss.
  return items.length ? items : null
}

export function writeTodayCache(ownerId, familyMemberId, items, now = new Date()) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      userId: ownerId,
      familyMemberId: familyMemberId ?? null,
      date: localDateString(now),
      items,
    }))
  } catch {
    // quota / private mode - caching is an optimization, not required
  }
}

export function clearTodayCache() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
