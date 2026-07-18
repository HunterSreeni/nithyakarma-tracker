import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

let scriptPromise = null
function loadTurnstileScript() {
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) { resolve(window.turnstile); return }
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = reject
    document.head.appendChild(script)
  })
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
    loadTurnstileScript().then(turnstile => {
      if (cancelled || !elRef.current) return
      widgetId.current = turnstile.render(elRef.current, {
        sitekey: SITE_KEY,
        callback: onVerify,
        'expired-callback': () => onVerify(null),
        'error-callback': () => onVerify(null),
      })
    })
    return () => {
      cancelled = true
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!SITE_KEY) return null
  return <div ref={elRef} className="turnstile-widget" />
})

export default Turnstile
