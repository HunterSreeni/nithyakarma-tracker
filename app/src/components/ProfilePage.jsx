import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Check, Gift } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import NotificationSettings from './NotificationSettings'
import { tierProgress, tierClass, tierFor } from '../utils/tiers'
import { shareUrl } from '../utils/share'
import { track } from '../utils/analytics'
import { APP_VERSION } from '../version'

export default function ProfilePage() {
  const { session, profile, familyMembers, updateProfile, addFamilyMember, removeFamilyMember, deleteAccount, signOut } = useAuth()
  const email = session.user.email
  const [name, setName] = useState(profile.display_name)
  const [saved, setSaved] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [error, setError] = useState(null)
  const [optOut, setOptOut] = useState(profile.leaderboard_opt_out)
  const [communityEnabled, setCommunityEnabled] = useState(profile.community_enabled)

  const toggleOptOut = async (checked) => {
    setOptOut(checked) // optimistic - revert on failure
    try {
      await updateProfile({ leaderboard_opt_out: checked })
    } catch {
      setOptOut(!checked)
    }
  }

  const toggleCommunity = async (checked) => {
    setCommunityEnabled(checked) // optimistic - revert on failure
    try {
      await updateProfile({ community_enabled: checked })
    } catch {
      setCommunityEnabled(!checked)
    }
  }

  const tp = tierProgress(profile.punya)
  const tier = tierFor(profile.punya)
  const initials = profile.display_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  const saveName = async () => {
    setError(null)
    try {
      await updateProfile({ display_name: name.trim() })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (err) { setError(err.message) }
  }

  const inviteWhatsApp = () => {
    track('share_clicked', { from: 'profile' })
    const text = `Join me on Nithyakarma - track your daily anushtanams with the Sabha!\n${shareUrl(profile.referral_code)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <>
      <div className="profile-head">
        <div className="profile-avatar">{initials}</div>
        <h1 className="profile-name">{profile.display_name}</h1>
        <span className={`tier-badge ${tierClass(tier)}`} style={{ fontSize: '0.6rem', padding: '3px 10px' }}>{tier}</span>
      </div>

      <div className="card">
        <h2 className="card-h">Tier Progress</h2>
        <div className="tp-row"><span>{tp.current}</span><span className="next">{tp.next ?? 'Highest tier'}</span></div>
        <div className="tp-bar"><div className="tp-fill" style={{ width: `${tp.pct}%` }} /></div>
        <div className="tp-hint">
          {tp.next
            ? `${profile.punya} / ${tp.nextAt} punya points · ${tp.toNext} more to reach ${tp.next}`
            : `${profile.punya} punya points · Brahmarishi`}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-num"><Flame size={16} strokeWidth={2.5} /> {profile.current_streak}</div><div className="stat-lbl">Streak</div></div>
        <div className="stat-tile"><div className="stat-num">{profile.best_streak}</div><div className="stat-lbl">Best</div></div>
        <div className="stat-tile"><div className="stat-num">{profile.punya}</div><div className="stat-lbl">Punya</div></div>
      </div>

      <div className="card">
        <h2 className="card-h">Edit Profile</h2>
        <form onSubmit={e => { e.preventDefault(); saveName() }}>
          <label className="field-label" htmlFor="pf-name">Display name</label>
          <input id="pf-name" className="field-input" value={name} onChange={e => setName(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={!name.trim() || name === profile.display_name}>
            {saved ? <>Saved <Check size={14} strokeWidth={3} /></> : 'Save changes'}
          </button>
        </form>
      </div>

      <div className="card" id="family">
        <h2 className="card-h">Family Members (children under 15)</h2>
        {familyMembers.length === 0 && (
          <div className="greet-sub">No phones for kids - add them here and mark their anushtanams on their behalf.</div>
        )}
        {familyMembers.map(fm => (
          <div className="fam-row" key={fm.id}>
            <div className="fam-av">{fm.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}</div>
            <div>
              <div className="fam-name">{fm.name}</div>
              <div className="fam-meta">
                {fm.gender === 'male' ? `Male · ${fm.upanayanam_done ? 'upanayanam done' : 'upanayanam pending'}` : 'Female'}
                {fm.bala_sabha_opt_in ? ' · Bala Sabha' : ''}
                {' · '}<Flame size={11} strokeWidth={2.5} style={{ verticalAlign: 'text-bottom' }} />{' '}{fm.current_streak}
              </div>
            </div>
            <button className="fam-remove" onClick={() => {
              if (window.confirm(`Remove ${fm.name} and all their logs?`)) removeFamilyMember(fm.id)
            }}>Remove</button>
          </div>
        ))}
        {showAdd
          ? <AddFamilyForm onDone={() => setShowAdd(false)} onAdd={addFamilyMember} />
          : <button className="btn-secondary" onClick={() => setShowAdd(true)}>+ Add family member</button>}
      </div>

      <div className="referral-card">
        <h2 className="ref-title"><Gift size={16} strokeWidth={2.5} /> Invite &amp; earn rewards</h2>
        <div className="ref-sub">
          Every member who joins with your link gives you both 1 month ad-free
          and a streak freeze. Your code: <strong>{profile.referral_code}</strong>
        </div>
        <button className="btn-ref" onClick={inviteWhatsApp}>Share invite on WhatsApp</button>
      </div>

      <div className="card">
        <h2 className="card-h">Community</h2>
        <label className="checkbox-row" style={{ marginTop: 0 }}>
          <input type="checkbox" checked={communityEnabled}
            onChange={e => toggleCommunity(e.target.checked)} />
          Show the Sabha tab (compare streaks and punya with others)
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={optOut}
            onChange={e => toggleOptOut(e.target.checked)} />
          Hide me from community leaderboards (only you can see your row)
        </label>
      </div>

      <NotificationSettings />

      <div className="card">
        <h2 className="card-h">Account</h2>
        <button className="btn-secondary" style={{ marginTop: 0 }} onClick={signOut}>Sign out</button>
      </div>

      <div className="danger-zone">
        <h2 className="dz-title">Danger zone</h2>
        <div className="dz-sub">
          Deleting your account removes your profile, all family member profiles, every log,
          streak, and leaderboard entry - permanently. Type your email address to confirm.
        </div>
        <form onSubmit={async e => {
          e.preventDefault()
          try { await deleteAccount() } catch (err) { setError(err.message) }
        }}>
          <input className="field-input" style={{ marginTop: '0.7rem' }} value={confirmDelete}
            onChange={e => setConfirmDelete(e.target.value)} placeholder={email} />
          <button type="submit" className="btn-danger" disabled={confirmDelete !== email}>
            Delete my account &amp; all data
          </button>
        </form>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </div>

      <div className="profile-legal">
        <Link to="/terms">Terms &amp; Conditions</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </div>

      <div className="app-version">v{APP_VERSION}</div>
    </>
  )
}

function AddFamilyForm({ onAdd, onDone }) {
  const [name, setName] = useState('')
  const [gender, setGender] = useState(null)
  const [upanayanam, setUpanayanam] = useState(false)
  const [balaSabha, setBalaSabha] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!name.trim() || !gender) { setError('Name and gender are required'); return }
    setBusy(true); setError(null)
    try {
      await onAdd({ name: name.trim(), gender, upanayanamDone: upanayanam, balaSabhaOptIn: balaSabha })
      onDone()
    } catch (err) {
      setError(err.message); setBusy(false)
    }
  }

  return (
    <form style={{ marginTop: '0.8rem' }} onSubmit={e => { e.preventDefault(); submit() }}>
      <label className="field-label" htmlFor="fam-name">Child's name</label>
      <input id="fam-name" className="field-input" value={name} onChange={e => setName(e.target.value)} />
      <label className="field-label">Gender</label>
      <div className="radio-row">
        <button type="button" className={`radio-chip ${gender === 'male' ? 'on' : ''}`} onClick={() => setGender('male')}>Boy</button>
        <button type="button" className={`radio-chip ${gender === 'female' ? 'on' : ''}`} onClick={() => setGender('female')}>Girl</button>
      </div>
      {gender === 'male' && (
        <label className="checkbox-row">
          <input type="checkbox" checked={upanayanam} onChange={e => setUpanayanam(e.target.checked)} />
          Upanayanam done (enables Sandhyavandhanam)
        </label>
      )}
      <label className="checkbox-row">
        <input type="checkbox" checked={balaSabha} onChange={e => setBalaSabha(e.target.checked)} />
        Include in Bala Sabha kids leaderboard (first name only)
      </label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button type="submit" className="btn-primary" disabled={busy}>Add</button>
        <button type="button" className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
