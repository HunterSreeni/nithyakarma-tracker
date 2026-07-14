import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

// Web push service worker (no-op inside the Capacitor shell)
if ('serviceWorker' in navigator && !window.Capacitor) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
