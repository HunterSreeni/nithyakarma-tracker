// Last-known referrals list, so reopening the page paints instantly instead
// of sitting on a spinner. Same shape and reasoning as todayCache.js/
// historyCache.js.

const KEY = 'nk_referrals_cache_v1'

export function readReferralsCache(ownerId) {
  let cached
  try {
    cached = JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null // corrupt JSON / private-mode storage - just skip the cache
  }
  if (!cached?.userId || !Array.isArray(cached.rows)) return null
  if (cached.userId !== ownerId) return null
  return cached.rows
}

export function writeReferralsCache(ownerId, rows) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId: ownerId, rows }))
  } catch {
    // quota / private mode - caching is an optimization, not required
  }
}

export function clearReferralsCache() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
