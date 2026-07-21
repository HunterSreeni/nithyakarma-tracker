import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'

// Shown once, right after onboarding creates a profile and before the main
// app (and its guided tour) renders - see App.jsx's Gate(). Reuses the same
// enable/subscribe/test-push plumbing as the Profile page's
// NotificationSettings, just in a first-run, skippable interstitial instead
// of a settings toggle.
export default function NotificationPrompt({ onDone }) {
  const { session, profile } = useAuth()
  const { enabled, error, testResult, supported, toggle, sendTestNotification } = useNotifications(
    session.user, { includeSandhya: profile.gender === 'male' },
  )
  const [enabling, setEnabling] = useState(false)
  const [testSent, setTestSent] = useState(false)

  useEffect(() => {
    if (enabled && !testSent) {
      setTestSent(true)
      sendTestNotification()
    }
  }, [enabled, testSent, sendTestNotification])

  const handleEnable = async () => {
    setEnabling(true)
    await toggle()
    setEnabling(false)
  }

  return (
    <div className="auth-wrap">
      <div className="onboard-intro">
        <div className="oi-ic" style={{ justifyContent: 'center', marginBottom: '0.6rem' }}>
          <BellRing size={32} strokeWidth={2} />
        </div>
        {enabled ? (
          <>
            <h1 className="oi-title">Notifications enabled!</h1>
            <div className="oi-sub">{testResult || 'Sending a test alert...'}</div>
          </>
        ) : (
          <>
            <h1 className="oi-title">Turn on reminders?</h1>
            <div className="oi-sub">
              {profile.gender === 'male'
                ? "Sandhya reminders at 9:00 AM, 12:30 PM and 6:30 PM, plus streak nudges so you never miss a day."
                : "Streak nudges morning and evening so you never miss a day."}
            </div>
          </>
        )}

        {error && <div className="auth-error" role="alert">{error}</div>}

        {!enabled && supported && (
          <button className="btn-auth" onClick={handleEnable} disabled={enabling}>
            {enabling ? 'Enabling...' : 'Enable notifications'}
          </button>
        )}
        <button className="btn-plain" onClick={onDone}>
          {enabled ? 'Continue' : 'Maybe later'}
        </button>
      </div>
    </div>
  )
}
