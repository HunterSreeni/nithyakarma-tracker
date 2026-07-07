import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationSettings() {
  const { session, profile } = useAuth()
  const { enabled, loading, error, supported, toggle } = useNotifications(
    session.user, { includeSandhya: profile.gender === 'male' },
  )

  return (
    <div className="card">
      <div className="card-h">Notifications</div>
      {!supported ? (
        <div className="greet-sub">Push notifications are not supported in this browser.</div>
      ) : (
        <>
          <label className="checkbox-row" style={{ marginTop: 0 }}>
            <input type="checkbox" checked={enabled} disabled={loading} onChange={toggle} />
            Reminder notifications
          </label>
          <div className="tp-hint">
            {profile.gender === 'male'
              ? 'Sandhya reminders at 9:00 AM, 12:30 PM and 6:30 PM, plus an 8:00 PM streak nudge for unmarked anushtanams.'
              : 'An 8:00 PM streak nudge when today\'s anushtanams are not yet marked.'}
          </div>
          {error && <div className="auth-error">{error}</div>}
        </>
      )}
    </div>
  )
}
