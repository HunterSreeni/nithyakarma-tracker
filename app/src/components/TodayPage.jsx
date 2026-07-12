import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useToday } from '../hooks/useToday'
import { supabase } from '../lib/supabase'
import { isDoneToday, cadenceLabel, SANDHYA_SLOTS } from '../utils/cadence'
import CelebrationModal from './CelebrationModal'
import ProfileSwitcher from './ProfileSwitcher'
import GuidedTour from './GuidedTour'

export default function TodayPage() {
  const { session, profile, selectedMember, refresh } = useAuth()
  const { items, loading, submit, addPractice } = useToday(session.user.id, selectedMember?.id ?? null)
  const [celebration, setCelebration] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const subjectName = selectedMember?.name ?? profile.display_name
  const subjectStreak = selectedMember?.current_streak ?? profile.current_streak
  const subjectFreezes = selectedMember?.freeze_credits ?? profile.freeze_credits ?? 0
  const doneCount = items.filter(i => isDoneToday(i.practice, i.logs)).length
  const dateLine = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const mark = async (item, slot = null) => {
    setBusyId(item.up.id); setError(null)
    try {
      const result = await submit(item.up.id, { slot, count: item.practice.target_count ?? null })
      await refresh() // streaks in topbar / switcher
      setCelebration({ ...result, subjectName })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="eyebrow">{dateLine}</div>
      <div className="greet">Namaskaram, {subjectName.split(' ')[0]} 🙏</div>
      <div className="greet-sub">
        {items.length === 0 ? 'Add your first anushtanam below.'
          : `${doneCount} of ${items.length} anushtanams done.`}
      </div>

      <ProfileSwitcher />

      <div className="today-card">
        <div>
          <div className="tc-label">Current Streak</div>
          <div className="tc-big">{subjectStreak} days 🔥</div>
          <div className="tc-hint">
            Best: {selectedMember?.best_streak ?? profile.best_streak} days
            {' · '}🧊 {subjectFreezes} freeze{subjectFreezes === 1 ? '' : 's'}
          </div>
        </div>
        <div className="progress-ring" style={{
          background: `conic-gradient(#fff 0% ${items.length ? (doneCount / items.length) * 100 : 0}%, rgba(255,255,255,0.25) 0% 100%)`,
        }}>
          <div className="pr-core">{doneCount}/{items.length}</div>
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="section-h">Today's Anushtanams</div>
      {loading ? <div className="spinner-wrap">Loading...</div> : (
        <div className="practice-list">
          {items.map(item => (
            <PracticeCard key={item.up.id} item={item}
              busy={busyId === item.up.id} onMark={mark} />
          ))}
        </div>
      )}

      <AddPracticeDropdown existing={items.map(i => i.practice.id)} onAdd={addPractice} />

      {celebration && (
        <CelebrationModal data={celebration} onClose={() => setCelebration(null)} />
      )}

      <GuidedTour ready={!loading} showSandhya={profile.gender === 'male'} />
    </>
  )
}

function PracticeCard({ item, busy, onMark }) {
  const { practice, up, logs } = item
  const done = isDoneToday(practice, logs)
  const slotsDone = new Set(logs.map(l => l.slot))
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div className={`practice-card ${done ? 'done' : ''}`}>
      <div className="p-icon">{practice.icon}</div>
      <div className="p-body">
        <div className="p-name">
          {practice.name}
          {practice.is_sandhyavandhanam && (
            <button type="button" className="info-btn" aria-expanded={showInfo}
              aria-label="Why does Sandhyavandhanam need three marks?"
              onClick={() => setShowInfo(v => !v)}>!</button>
          )}
        </div>
        <div className="p-meta">
          {practice.cadence === 'sequence' && up.sequence_position > 0
            ? `${up.sequence_position}${practice.sequence_length ? `/${practice.sequence_length}` : ''} · `
            : ''}
          {cadenceLabel(practice)} · <span className="mini-flame">🔥 {up.current_streak}</span>
        </div>
        {practice.is_sandhyavandhanam && (
          <>
            {showInfo && (
              <div className="sandhya-info" role="note">
                Sandhyavandhanam is performed 3 times a day - <b>Prathakala</b> (morning),
                <b> Madhyanika</b> (noon) and <b>Saayamkala</b> (evening). Mark all three to
                complete the day and grow your streak.
              </div>
            )}
            <div className="sandhya-progress">
              {done ? 'All 3 sandhyas done 🎉' : `${slotsDone.size} of 3 sandhyas done`}
            </div>
            <div className="slot-row" data-tour="sandhya-slots">
              {SANDHYA_SLOTS.map(s => (
                <button key={s.key} disabled={slotsDone.has(s.key) || busy}
                  className={`slot-btn ${slotsDone.has(s.key) ? 'done' : ''}`}
                  onClick={() => onMark(item, s.key)}>
                  {slotsDone.has(s.key) ? '✓ ' : ''}{s.short}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {done ? <div className="done-check">✓</div>
        : !practice.is_sandhyavandhanam && (
          <button className="btn-done" disabled={busy} onClick={() => onMark(item)}>
            {busy ? 'Saving...' : 'Mark Done'}
          </button>
        )}
    </div>
  )
}

function AddPracticeDropdown({ existing, onAdd }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState([])
  const [error, setError] = useState(null)
  const { profile, selectedMember } = useAuth()

  useEffect(() => {
    supabase.from('practices').select('*').eq('active', true).order('id')
      .then(({ data }) => setCatalog(data ?? []))
  }, [])

  const subjectGender = selectedMember?.gender ?? profile.gender
  const upanayanamOk = selectedMember ? selectedMember.upanayanam_done : true

  const visible = useMemo(() => catalog.filter(p => {
    if (p.is_sandhyavandhanam && (subjectGender !== 'male' || !upanayanamOk)) return false
    return p.name.toLowerCase().includes(search.toLowerCase())
  }), [catalog, search, subjectGender, upanayanamOk])

  const add = async (p) => {
    setError(null)
    try {
      await onAdd(p.id)
      setOpen(false); setSearch('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <button className={`add-select ${open ? 'open' : ''}`} data-tour="add-practice" onClick={() => setOpen(!open)}>
        <span>Add an anushtanam to track...</span>
        <span className="plus">{open ? '×' : '+'}</span>
      </button>
      {open && (
        <div className="dropdown">
          <input className="dd-search" placeholder="🔍 Search..." value={search}
            onChange={e => setSearch(e.target.value)} autoFocus />
          {visible.map(p => {
            const tracked = existing.includes(p.id)
            return (
              <button key={p.id} className={`dd-item ${tracked ? 'muted' : ''}`}
                disabled={tracked} onClick={() => add(p)}>
                <span className="dd-icon">{p.icon}</span>
                <span className="dd-name">{p.name}</span>
                <span className="dd-freq">{tracked ? 'already tracking' : cadenceLabel(p)}</span>
                {tracked && <span className="dd-check">✓</span>}
              </button>
            )
          })}
          {visible.length === 0 && <div className="dd-item muted">No matches</div>}
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}
    </div>
  )
}
