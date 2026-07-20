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
// Deliberately below the 15s stuck-screen watchdog in App.jsx's Gate(), so a hung
// request resolves into a normal signed-out/error render before the user is ever
// shown the "Taking longer than expected" fallback.
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
