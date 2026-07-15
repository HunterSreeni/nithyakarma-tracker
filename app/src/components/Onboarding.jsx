import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, Flame, Trophy } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export default function Onboarding() {
  const { createProfile, session } = useAuth()
  const [name, setName] = useState(session?.user?.user_metadata?.full_name ?? '')
  const [gender, setGender] = useState(null)
  const [referral, setReferral] = useState(getReferralFromUrl())
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('intro')
  const nameInputRef = useRef(null)

  // Move focus to the first field when advancing from the intro step, so
  // keyboard/screen-reader users land somewhere sensible instead of on
  // whatever the now-unmounted "Get started" button used to be.
  useEffect(() => {
    if (step === 'form') nameInputRef.current?.focus()
  }, [step])

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

  if (step === 'intro') {
    return (
      <div className="auth-wrap">
        <div className="onboard-intro">
          <div className="auth-logo" style={{ textAlign: 'center', marginBottom: '0.2rem' }}>Nithya<span>karma</span></div>
          <h1 className="oi-title">Namaskaram</h1>
          <div className="oi-sub">A simple way to keep up your daily anushtanams.</div>
          <div className="oi-points">
            <div className="oi-point">
              <span className="oi-ic"><CalendarCheck size={22} strokeWidth={2} /></span>
              <div><b>Track every day</b><p>Sandhyavandhanam, parayanams, japam - marked in seconds.</p></div>
            </div>
            <div className="oi-point">
              <span className="oi-ic"><Flame size={22} strokeWidth={2} /></span>
              <div><b>Build a streak</b><p>Earn freezes as you climb tiers, so one missed day won't break it.</p></div>
            </div>
            <div className="oi-point">
              <span className="oi-ic"><Trophy size={22} strokeWidth={2} /></span>
              <div><b>Join the Sabha</b><p>An optional community leaderboard - turn it on anytime from your profile.</p></div>
            </div>
          </div>
          <button className="btn-auth" onClick={() => setStep('form')}>Get started</button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-wrap">
      <h1 className="auth-logo">Namaskaram</h1>
      <div className="auth-sub">A few details to set up your anushtanams</div>
      <div className="auth-card">
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="ob-name">Your name</label>
          <input id="ob-name" ref={nameInputRef} className="field-input" value={name} onChange={e => setName(e.target.value)} required />
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
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="btn-auth" type="submit" disabled={busy}>Begin</button>
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
