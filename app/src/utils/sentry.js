import * as Sentry from '@sentry/react'

// Crash/error reporting. No-ops unless VITE_SENTRY_DSN is set, so local dev, CI,
// and pre-DSN builds run untouched (same guard pattern as ads). Captures JS
// errors/exceptions in the webview on both web and Android.
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    sendDefaultPii: false, // no IPs / request bodies / user PII
  })
}
