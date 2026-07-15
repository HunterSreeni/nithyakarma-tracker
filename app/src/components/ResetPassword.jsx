import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// Reached from the recovery email link (redirectTo=/reset). supabase-js has
// already established a recovery session from the URL by the time this renders,
// so updateUser sets the new password. Kept standalone in App's Gate so the
// recovery session doesn't route the user straight into the app.
export default function ResetPassword() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setBusy(true)
    const { error } = await updatePassword(password)
    setBusy(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">Nithya<span>karma</span></div>
      <div className="auth-sub">Set a new password</div>
      <div className="auth-card">
        {done ? (
          <div className="auth-notice">Password updated. Taking you in...</div>
        ) : (
          <form onSubmit={submit}>
            <label className="field-label" htmlFor="rp-pass">New password</label>
            <input id="rp-pass" className="field-input" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              autoComplete="new-password" />
            {error && <div className="auth-error" role="alert">{error}</div>}
            <button className="btn-auth" type="submit" disabled={busy}>
              {busy ? 'Updating...' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
