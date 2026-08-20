import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY
export const TURNSTILE_ENABLED = Boolean(SITE_KEY)

// A <script> that never fires onload/onerror (request stalls on a flaky
// mobile connection) would leave this promise pending forever, and a pending
// promise here means the widget never renders and the submit button sits at
// "Verifying..." for the rest of the session. Bound it so it fails instead.
const SCRIPT_LOAD_TIMEOUT_MS = 10000
const SCRIPT_RETRY_DELAY_MS = 3000

let scriptPromise = null
function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) { resolve(window.turnstile); return }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    const timer = setTimeout(() => {
      script.remove()
      reject(new Error('Turnstile script load timed out'))
    }, SCRIPT_LOAD_TIMEOUT_MS)
    script.onload = () => { clearTimeout(timer); resolve(window.turnstile) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Turnstile script failed to load')) }
    document.head.appendChild(script)
  })
  // Never cache a rejection: a single failed load would otherwise be handed to
  // every later caller, permanently disabling the captcha (and with it every
  // auth submit) until the app is restarted.
  scriptPromise.catch(() => { scriptPromise = null })
  return scriptPromise
}

// Cloudflare Turnstile widget for AuthPage. Renders nothing (and every auth
// call carries no captcha token) until VITE_TURNSTILE_SITE_KEY is set, so
// local dev/CI never needs a Cloudflare account and this is a no-op until
// deliberately turned on. Once Supabase Auth's "Prevent use of leaked
// passwords"/captcha protection is enabled in the dashboard, every signup,
// signin, and password-reset call must carry a valid token or Supabase
// rejects it - so this widget (and the reset() below, since a token is
// single-use) needs to sit in all three AuthPage modes, not just signup.
const Turnstile = forwardRef(function Turnstile({ onVerify }, ref) {
  const elRef = useRef(null)
  const widgetId = useRef(null)

  useImperativeHandle(ref, () => ({
    reset: () => { if (widgetId.current != null) window.turnstile?.reset(widgetId.current) },
  }))

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    let retryTimer

    const attempt = (remaining) => {
      loadTurnstileScript().then(turnstile => {
        if (cancelled || !elRef.current) return
        widgetId.current = turnstile.render(elRef.current, {
          sitekey: SITE_KEY,
          callback: onVerify,
          'expired-callback': () => onVerify(null),
          'error-callback': () => onVerify(null),
        })
      }).catch(() => {
        // Without a retry, one failed load on a flaky connection leaves the
        // user with a permanently disabled submit button and no way forward
        // short of restarting the app.
        if (cancelled || remaining <= 0) return
        retryTimer = setTimeout(() => attempt(remaining - 1), SCRIPT_RETRY_DELAY_MS)
      })
    }
    attempt(2)

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null
  return <div ref={elRef} className="turnstile-widget" />
})

export default Turnstile
