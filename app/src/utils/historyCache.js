// Last-known History list for a subject, so reopening the page paints the log
// rows immediately instead of sitting on a spinner. Same shape and reasoning
// as todayCache.js - but unlike Today, past logs don't change day to day, so
// there is no "day rollover" concern: a stale cache is just as correct as a
// fresh one until the real fetch corrects it.

const KEY = 'nk_history_cache_v1'

// familyMemberId is null for the account holder. Normalised on both sides so a
// stored null never matches an undefined argument by accident.
function sameSubject(cached, ownerId, familyMemberId) {
  return cached.userId === ownerId &&
    (cached.familyMemberId ?? null) === (familyMemberId ?? null)
}

export function readHistoryCache(ownerId, familyMemberId) {
  let cached
  try {
    cached = JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null // corrupt JSON / private-mode storage - just skip the cache
  }
  if (!cached?.userId || !Array.isArray(cached.days)) return null
  if (!sameSubject(cached, ownerId, familyMemberId)) return null
  return cached.days
}

export function writeHistoryCache(ownerId, familyMemberId, days) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      userId: ownerId,
      familyMemberId: familyMemberId ?? null,
      days,
    }))
  } catch {
    // quota / private mode - caching is an optimization, not required
  }
}

export function clearHistoryCache() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
