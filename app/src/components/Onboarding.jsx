import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

export default function Onboarding() {
  const { createProfile, session } = useAuth()
  const [name, setName] = useState(session?.user?.user_metadata?.full_name ?? '')
  const [gender, setGender] = useState(null)
  const [referral, setReferral] = useState(getReferralFromUrl())
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!gender) { setError('Please select gender'); return }
    setError(null); setBusy(true)
    try {
      await createProfile({ displayName: name.trim(), gender, referralCode: referral.trim() || null })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">🪔 Namaskaram 🙏</div>
      <div className="auth-sub">A few details to set up your anushtanams</div>
      <div className="auth-card">
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="ob-name">Your name</label>
          <input id="ob-name" className="field-input" value={name} onChange={e => setName(e.target.value)} required />
          <label className="field-label">Gender</label>
          <div className="radio-row">
            <button type="button" className={`radio-chip ${gender === 'male' ? 'on' : ''}`}
              onClick={() => setGender('male')}>Male</button>
            <button type="button" className={`radio-chip ${gender === 'female' ? 'on' : ''}`}
              onClick={() => setGender('female')}>Female</button>
          </div>
          {gender === 'male' && (
            <div className="greet-sub" style={{ marginTop: 8 }}>
              Sandhyavandhanam (3 sandhyas + Gaayatri) will be added to your daily list.
            </div>
          )}
          <label className="field-label">Referral code (optional)</label>
          <input className="field-input" value={referral} onChange={e => setReferral(e.target.value)}
            placeholder="From a friend's invite link" />
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-auth" type="submit" disabled={busy}>Begin 🪔</button>
        </form>
      </div>
    </div>
  )
}

function getReferralFromUrl() {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9]+)/)
  if (m) return m[1]
  return new URLSearchParams(window.location.search).get('ref') ?? ''
}
