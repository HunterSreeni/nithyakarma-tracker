import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { initSentry } from './utils/sentry'

initSentry()

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
      <App />
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
