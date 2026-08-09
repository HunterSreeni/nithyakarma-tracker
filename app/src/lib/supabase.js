import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// A build without .env inlines these as undefined, which otherwise fails deep
// inside createClient with a cryptic error and a blank screen on the device.
// Fail loudly and clearly instead - the message surfaces in the WebView console.
if (!url || !key) {
  throw new Error(
    'Supabase env missing: VITE_SUPABASE_URL / VITE_SUPABASE_KEY were not set at build time. ' +
    'The app was built without a .env file.',
  )
}

// auth-js issues every request through a bare fetch() with no AbortSignal, so a
// socket that never settles hangs it forever. That is not theoretical: getSession()
// awaits initializePromise, which awaits _recoverAndRefresh(), which refreshes the
// access token whenever it is within the expiry margin. A tab left open past the
// 1h token lifetime and then resumed (laptop sleep, network change, captive portal)
// can resume onto a dead socket - the refresh POST never settles, initializePromise
// never resolves, and every getSession() caller blocks behind it permanently. In
// AuthProvider that leaves `loading` true forever, which is the "Taking longer than
// expected" watchdog users hit after leaving the app open overnight.
//
// Bounding the request turns that silent hang into an ordinary rejection, which the
// existing error paths already handle. Applies to PostgREST queries too - they have
// the same unbounded-fetch exposure.
//
// NOT sufficient on its own for the refresh call specifically (2026-08-10): auth-js's
// GoTrueClient catches this abort, classifies it as a retryable error, and retries the
// refresh internally with backoff for up to ~30s (its own AUTO_REFRESH_TICK_DURATION_MS),
// regardless of what this constant is set to - shrinking it just buys more, shorter
// retries within roughly the same ~30s total. That's why the "stuck" watchdog in
// App.jsx's Gate() is sized in terms of this value (worst case ~30s here, plus another
// ~1x this for loadProfile after it resolves) rather than being set safely below it.
const REQUEST_TIMEOUT_MS = 12000

// AbortSignal.timeout/any are Chrome 116+; minSdkVersion is 24, so a device on an
// old System WebView must not take a TypeError at module load - that would blank
// the whole app, which is strictly worse than the hang being fixed here. Fall back
// to the unbounded fetch there.
const canTimeout = typeof AbortSignal !== 'undefined' &&
  typeof AbortSignal.timeout === 'function' && typeof AbortSignal.any === 'function'

const fetchWithTimeout = canTimeout
  ? (input, init = {}) => {
      // Respect a caller-supplied signal (realtime/storage pass their own) by
      // aborting on whichever fires first.
      const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
      return fetch(input, { ...init, signal })
    }
  : fetch

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout },
})
