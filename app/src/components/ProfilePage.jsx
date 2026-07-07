import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { tierProgress, tierClass, tierFor } from '../utils/tiers'
import { shareUrl } from '../utils/share'

export default function ProfilePage() {
  const { profile, familyMembers, updateProfile, addFamilyMember, removeFamilyMember, deleteAccount, signOut } = useAuth()
  const [name, setName] = useState(profile.display_name)
  const [saved, setSaved] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [error, setError] = useState(null)

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
    const text = `🪔 Join me on Nithyakarma - track your daily anushtanams with the Sabha!\n${shareUrl(profile.referral_code)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <>
      <div className="profile-head">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-name">{profile.display_name}</div>
        <span className={`tier-badge ${tierClass(tier)}`} style={{ fontSize: '0.6rem', padding: '3px 10px' }}>{tier}</span>
      </div>

      <div className="card">
        <div className="card-h">Tier Progress</div>
        <div className="tp-row"><span>{tp.current}</span><span className="next">{tp.next ?? 'Highest tier'}</span></div>
        <div className="tp-bar"><div className="tp-fill" style={{ width: `${tp.pct}%` }} /></div>
        <div className="tp-hint">
          {tp.next
            ? `${profile.punya} / ${tp.nextAt} punya points · ${tp.toNext} more to reach ${tp.next}`
            : `${profile.punya} punya points · Brahmarishi 🙏`}
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-tile"><div className="stat-num">🔥 {profile.current_streak}</div><div className="stat-lbl">Streak</div></div>
        <div className="stat-tile"><div className="stat-num">{profile.best_streak}</div><div className="stat-lbl">Best</div></div>
        <div className="stat-tile"><div className="stat-num">{profile.punya}</div><div className="stat-lbl">Punya</div></div>
      </div>

      <div className="card">
        <div className="card-h">Edit Profile</div>
        <label className="field-label" htmlFor="pf-name">Display name</label>
        <input id="pf-name" className="field-input" value={name} onChange={e => setName(e.target.value)} />
        <button className="btn-primary" onClick={saveName} disabled={!name.trim() || name === profile.display_name}>
          {saved ? 'Saved ✓' : 'Save changes'}
        </button>
      </div>

      <div className="card" id="family">
        <div className="card-h">Family Members (children under 15)</div>
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
                {' · 🔥 '}{fm.current_streak}
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
        <div className="ref-title">Invite from your Sabha 🎁</div>
        <div className="ref-sub">
          Every member who joins with your link gives you both 1 month ad-free.
          Your code: <strong>{profile.referral_code}</strong>
        </div>
        <button className="btn-ref" onClick={inviteWhatsApp}>Share invite on WhatsApp</button>
      </div>

      <div className="card">
        <div className="card-h">Account</div>
        <button className="btn-secondary" style={{ marginTop: 0 }} onClick={signOut}>Sign out</button>
      </div>

      <div className="danger-zone">
        <div className="dz-title">Danger zone</div>
        <div className="dz-sub">
          Deleting your account removes your profile, all family member profiles, every log,
          streak, and leaderboard entry - permanently. Type DELETE to confirm.
        </div>
        <input className="field-input" style={{ marginTop: '0.7rem' }} value={confirmDelete}
          onChange={e => setConfirmDelete(e.target.value)} placeholder="Type DELETE" />
        <button className="btn-danger" disabled={confirmDelete !== 'DELETE'}
          onClick={async () => { try { await deleteAccount() } catch (err) { setError(err.message) } }}>
          Delete my account &amp; all data
        </button>
        {error && <div className="auth-error">{error}</div>}
      </div>
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
    <div style={{ marginTop: '0.8rem' }}>
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
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: 'flex', gap: '0.6rem' }}>
        <button className="btn-primary" onClick={submit} disabled={busy}>Add</button>
        <button className="btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}
