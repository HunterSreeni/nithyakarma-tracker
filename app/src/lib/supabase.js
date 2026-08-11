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

// AbortSignal.timeout/any only reached Android System WebView in Chrome 116.
// minSdkVersion is 24, so feature-gating on those helpers made the timeout a
// no-op on older devices and restored the original permanent-resume hang. Build
// the timeout from the much older AbortController primitive instead. The
// Promise.race fallback still bounds the Supabase caller if an exceptionally old
// WebView has fetch but no AbortController (the underlying socket cannot be
// cancelled there, but it can no longer pin the UI's loading state).
function timeoutError() {
  const message = `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
  return typeof DOMException === 'function'
    ? new DOMException(message, 'TimeoutError')
    : Object.assign(new Error(message), { name: 'TimeoutError' })
}

const fetchWithTimeout = (input, init = {}) => {
  const callerSignal = init.signal
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  let forwardCallerAbort

  if (controller && callerSignal) {
    forwardCallerAbort = () => controller.abort(callerSignal.reason)
    if (callerSignal.aborted) forwardCallerAbort()
    else callerSignal.addEventListener('abort', forwardCallerAbort, { once: true })
  }

  const signal = controller?.signal ?? callerSignal
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = timeoutError()
      controller?.abort(error)
      reject(error)
    }, REQUEST_TIMEOUT_MS)
  })

  let request
  try {
    request = fetch(input, signal ? { ...init, signal } : init)
  } catch (error) {
    request = Promise.reject(error)
  }

  return Promise.race([request, timeout]).finally(() => {
    clearTimeout(timer)
    if (forwardCallerAbort) callerSignal.removeEventListener('abort', forwardCallerAbort)
  })
}

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout },
})
