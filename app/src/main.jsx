import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'
import { initSentry } from './utils/sentry'
import { queryClient } from './lib/queryClient'
import { setupDataLifecycle } from './lib/dataLifecycle'
import { initAnalytics, registerOnce } from './lib/posthog'
import { getInstallAttribution } from './utils/installReferrer'
import { trackFirstOpen } from './utils/firstOpen'

// AI-DEV NOTE: iPhone app only. viewport-fit=cover makes WKWebView report real
// env(safe-area-inset-*) values, and the ios-native class turns on the safe-area
// rules at the end of index.css. Not in index.html: on Android (Capacitor 8,
// Chromium 140+) cover means edge-to-edge, and mobile Safari must not change.
if (Capacitor.getPlatform() === 'ios') {
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover')
  document.documentElement.classList.add('ios-native')
}

initSentry()
setupDataLifecycle()
// Product analytics (PostHog EU); no-op outside production builds.
if (initAnalytics()) {
  getInstallAttribution().then(attr => {
    if (Object.keys(attr).length) registerOnce(attr)
    trackFirstOpen(attr)
  })
}

function CrashFallback() {
  return (
    <div className="spinner-wrap stuck">
      <div>Something went wrong.</div>
      <button type="button" className="btn-auth" onClick={() => window.location.reload()}>Reload</button>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)

// Web push service worker (no-op inside the Capacitor shell). @capacitor/core
// defines window.Capacitor on every platform, web included - only
// isNativePlatform() actually distinguishes native from web. The old
// `!window.Capacitor` check was always false once @capacitor/core was
// bundled in, so the service worker never registered on web at all, on any
// platform, ever - the true root cause of web push never having worked.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
