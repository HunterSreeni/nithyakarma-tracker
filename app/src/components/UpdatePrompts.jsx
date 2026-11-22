import { Download, X } from 'lucide-react'
import { useAppUpdate, dismissSuggestedUpdate } from '../hooks/useAppUpdate'

// Approved mockup: https://claude.ai/artifact/SsjA2FDLEttrhdQBSdsTDD (2026-11-22).
// The store link opens outside the app (Capacitor hands external links to the
// system, which opens the App Store or Play Store app).

export function UpdateRequired({ update }) {
  return (
    <div className="auth-wrap">
      <main className="update-required">
        <div className="update-ic update-ic-lg" aria-hidden="true">
          <Download size={32} strokeWidth={2} />
        </div>
        <h1 className="oi-title">Please update Nithyakarma</h1>
        <p className="oi-sub">
          This version can no longer keep your streak and reminders working correctly.
          Update to keep going. Your practices, streak and punya are safe.
        </p>
        <p className="update-versions">You have {update.installed}. Needed: {update.target} or later.</p>
        <a className="btn-auth update-store-btn" href={update.storeUrl} target="_blank" rel="noopener noreferrer">
          {`Update on ${update.storeName}`}
        </a>
        <a className="update-help" href="mailto:support@nithyakarma.org">Need help? support@nithyakarma.org</a>
      </main>
    </div>
  )
}

export function UpdateCard() {
  const update = useAppUpdate()
  if (update.status !== 'suggested' || update.dismissed) return null
  return (
    <div className="card update-card" role="status">
      <div className="update-ic" aria-hidden="true"><Download size={20} strokeWidth={2} /></div>
      <div className="update-card-body">
        <div className="update-card-title">New version available</div>
        <div className="update-card-sub">Version {update.target} is ready. You have {update.installed}.</div>
        <a className="btn-primary update-store-btn" href={update.storeUrl} target="_blank" rel="noopener noreferrer">
          {`Update on ${update.storeName}`}
        </a>
      </div>
      <button type="button" className="update-dismiss" aria-label="Dismiss" onClick={dismissSuggestedUpdate}>
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
