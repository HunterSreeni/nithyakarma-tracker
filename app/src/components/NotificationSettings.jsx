import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'

export default function NotificationSettings() {
  const { session, profile } = useAuth()
  const {
    enabled, tharpanamEnabled, observancesEnabled, loading, error, testResult, supported,
    toggle, toggleTharpanam, toggleObservances, sendTestNotification,
  } = useNotifications(session.user, { includeSandhya: profile.gender === 'male' })

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
              ? 'Sandhya reminders at 9:00 AM, 12:30 PM and 6:30 PM, plus streak nudges at 8:00 AM and 8:00 PM for unmarked anushtanams.'
              : 'Streak nudges at 8:00 AM and 8:00 PM when today\'s anushtanams are not yet marked.'}
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={tharpanamEnabled} disabled={!enabled}
              onChange={e => toggleTharpanam(e.target.checked)} />
            Tharpanam reminders - monthly Amavasya, Karkidaka Vaavu, and the two Sankranti days
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={observancesEnabled} disabled={!enabled}
              onChange={e => toggleObservances(e.target.checked)} />
            Auspicious-day reminders - Pongal, Sivarathri, and other festivals
          </label>
          <button type="button" className="btn-secondary" onClick={sendTestNotification}>
            Send test notification
          </button>
          {testResult && <div className="tp-hint">{testResult}</div>}
          {error && <div className="auth-error" role="alert">{error}</div>}
        </>
      )}
    </div>
  )
}
