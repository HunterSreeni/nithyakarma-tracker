// Maps common Supabase/network failure shapes to plain-language copy so
// users never see a raw error string. Falls back to a generic message for
// anything unrecognized.
export function friendlyError(err) {
  const message = err?.message ?? String(err ?? '')
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return "You're offline. Check your connection and try again."
  }
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Couldn't reach the server. Check your connection and try again."
  }
  if (/jwt|session|expired|not authenticated/i.test(message)) {
    return 'Your session expired. Please sign in again.'
  }
  if (/permission|rls|denied/i.test(message)) {
    return "You don't have permission to do that."
  }
  return 'Something went wrong. Please try again.'
}
