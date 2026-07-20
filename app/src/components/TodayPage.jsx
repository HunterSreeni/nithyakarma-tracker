import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react'
import { Flame, Snowflake, Check, Search } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToday } from '../hooks/useToday'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { supabase } from '../lib/supabase'
import { isDoneToday, countsTowardDayCompletion, cadenceLabel, SANDHYA_SLOTS } from '../utils/cadence'
import CelebrationModal from './CelebrationModal'
import ProfileSwitcher from './ProfileSwitcher'
import PanchangamBox from './PanchangamBox'
import MonthlySpecialBanner from './MonthlySpecialBanner'
import ErrorBanner from './ErrorBanner'
import PracticeIcon from '../utils/practiceIcons'
import { track } from '../utils/analytics'
import { showInterstitial } from '../utils/ads'
import { isMilestone, maybeRequestReview } from '../utils/review'

// Deferred - pulls in driver.js, which only the first-run tour ever needs.
const GuidedTour = lazy(() => import('./GuidedTour'))

export default function TodayPage() {
  const { session, profile, selectedMember, refresh } = useAuth()
  const { items, loading, error: loadError, submit, addPractice, reload } =
    useToday(session.user.id, selectedMember?.id ?? null)
  const [celebration, setCelebration] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const subjectName = selectedMember?.name ?? profile.display_name
  const subjectStreak = selectedMember?.current_streak ?? profile.current_streak
  const subjectFreezes = selectedMember?.freeze_credits ?? profile.freeze_credits ?? 0
  // Day counter must mirror the server's day-completion rule, not "was it logged".
  // The per-practice tick below still uses isDoneToday.
  const doneCount = items.filter(i => countsTowardDayCompletion(i.practice, i.logs)).length
  const dateLine = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const mark = async (item, slot = null) => {
    setBusyId(item.up.id); setError(null)
    try {
      const result = await submit(item.up.id, { slot, count: item.practice.target_count ?? null })
      await refresh() // streaks in topbar / switcher
      track('practice_marked', {
        day_complete: !!result.day_complete,
        freeze_used: !!result.freeze_used,
        overall_streak: result.overall_streak ?? 0,
        is_sandhya: !!item.practice.is_sandhyavandhanam,
      })
      // Ad fires here - after the verified save, BEFORE the celebration reward
      // (Intent 0.2). At a streak milestone, ask for a review instead (Intent 1.4);
      // never both, and never on a failed save (we are past submit()).
      const milestone = result.day_complete && isMilestone(result.overall_streak ?? 0)
      const reviewed = milestone ? await maybeRequestReview() : false
      if (!reviewed) await showInterstitial(profile)
      if (result.day_complete && (result.overall_streak ?? 0) >= 1) {
        setCelebration({ ...result, subjectName })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <div className="eyebrow">{dateLine}</div>
      <h1 className="greet">Namaskaram, {subjectName.split(' ')[0]}</h1>
      <div className="greet-sub">
        {loading ? ' '
          : items.length === 0 ? 'Start with a suggested anushtanam below'
          : `${doneCount} of ${items.length} anushtanams done.`}
      </div>
      <PanchangamBox />
      <MonthlySpecialBanner />

      <ProfileSwitcher />

      <div className="today-card">
        <div>
          <div className="tc-label">Current Streak</div>
          <div className="tc-big"><Flame size={18} strokeWidth={2.5} /> {subjectStreak} day{subjectStreak === 1 ? '' : 's'}</div>
          <div className="tc-hint">
            Best: {selectedMember?.best_streak ?? profile.best_streak} day{(selectedMember?.best_streak ?? profile.best_streak) === 1 ? '' : 's'}
            {' · '}<Snowflake size={12} strokeWidth={2.5} /> {subjectFreezes} freeze{subjectFreezes === 1 ? '' : 's'}
          </div>
        </div>
        <div className="progress-ring" style={{
          background: `conic-gradient(#fff 0% ${items.length ? (doneCount / items.length) * 100 : 0}%, rgba(255,255,255,0.25) 0% 100%)`,
        }}>
          <div className="pr-core">{doneCount}/{items.length}</div>
        </div>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <h2 className="section-h">Today's Anushtanams</h2>
      {loading ? <div className="spinner-wrap">Loading...</div> : loadError ? (
        <ErrorBanner message={loadError} onRetry={reload} />
      ) : items.length === 0 ? (
        <SuggestedPractices onAdd={addPractice} />
      ) : (
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

      <Suspense fallback={null}>
        <GuidedTour ready={!loading} showSandhya={profile.gender === 'male'} />
      </Suspense>
    </>
  )
}

// Curated one-tap starters shown when the day is empty (e.g. female profiles and
// non-upanayanam boys who don't get Sandhyavandhanam) so onboarding lands on an
// actionable screen instead of a blank list.
const SUGGESTED_SLUGS = ['narayaneeyam', 'lalitha-sahasranamam', 'devi-mahatmyam']

function SuggestedPractices({ onAdd }) {
  const [suggestions, setSuggestions] = useState([])
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    supabase.from('practices').select('*').in('slug', SUGGESTED_SLUGS).eq('active', true).order('id')
      .then(({ data }) => setSuggestions(data ?? []))
  }, [])

  const add = async (id) => {
    setBusy(id)
    try { await onAdd(id) } finally { setBusy(null) }
  }

  if (!suggestions.length) return null
  return (
    <>
      <h2 className="section-h">Suggested to start</h2>
      <div className="practice-list">
        {suggestions.map(p => (
          <div key={p.id} className="practice-card">
            <div className="p-icon"><PracticeIcon slug={p.slug} size={20} strokeWidth={1.8} /></div>
            <div className="p-body">
              <div className="p-name">{p.name}</div>
              <div className="p-meta">{cadenceLabel(p)}</div>
            </div>
            <button className="btn-done" disabled={busy === p.id} onClick={() => add(p.id)}>
              {busy === p.id ? 'Adding...' : '+ Add'}
            </button>
          </div>
        ))}
      </div>
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
      <div className="p-icon"><PracticeIcon slug={practice.slug} size={20} strokeWidth={1.8} /></div>
      <div className="p-body">
        <div className="p-name">
          {practice.name}
          {practice.is_sandhyavandhanam && (
            <button type="button" className="info-btn" aria-expanded={showInfo}
              aria-label="Why are there three Sandhyavandhanam times?"
              onClick={() => setShowInfo(v => !v)}>!</button>
          )}
        </div>
        <div className="p-meta">
          {practice.cadence === 'sequence' && up.sequence_position > 0
            ? `${up.sequence_position}${practice.sequence_length ? `/${practice.sequence_length}` : ''} · `
            : ''}
          {cadenceLabel(practice)} · <span className="mini-flame"><Flame size={11} strokeWidth={2.5} /> {up.current_streak}</span>
        </div>
        {practice.is_sandhyavandhanam && (
          <>
            {showInfo && (
              <div className="sandhya-info" role="note">
                Sandhyavandhanam is performed 3 times a day - <b>Prathakala</b> (morning),
                <b> Madhyanika</b> (noon) and <b>Saayamkala</b> (evening). Marking even one
                keeps your streak alive; mark more when your day allows, for extra punya.
              </div>
            )}
            <div className="sandhya-progress">
              {slotsDone.size === 0 && '0 of 3 sandhyas done'}
              {slotsDone.size > 0 && slotsDone.size < 3 && `${slotsDone.size} of 3 sandhyas done · streak kept`}
              {slotsDone.size === 3 && 'All 3 sandhyas done'}
            </div>
            <div className="slot-row" data-tour="sandhya-slots">
              {SANDHYA_SLOTS.map(s => (
                <button key={s.key} disabled={slotsDone.has(s.key) || busy}
                  className={`slot-btn ${slotsDone.has(s.key) ? 'done' : ''}`}
                  onClick={() => onMark(item, s.key)}>
                  {slotsDone.has(s.key) && <Check size={11} strokeWidth={3} />}{s.short}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {done ? <div className="done-check"><Check size={16} strokeWidth={3} /></div>
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
  const dropdownRef = useRef(null)
  useFocusTrap(dropdownRef, open)

  useEffect(() => {
    supabase.from('practices').select('*').eq('active', true).order('id')
      .then(({ data }) => setCatalog(data ?? []))
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

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
        <div className="dropdown" ref={dropdownRef}>
          <div className="dd-search-wrap">
            <Search size={14} strokeWidth={2.5} className="dd-search-icon" />
            <input className="dd-search" placeholder="Search..." value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          {visible.map(p => {
            const tracked = existing.includes(p.id)
            return (
              <button key={p.id} className={`dd-item ${tracked ? 'muted' : ''}`}
                disabled={tracked} onClick={() => add(p)}>
                <span className="dd-icon"><PracticeIcon slug={p.slug} size={17} strokeWidth={1.8} /></span>
                <span className="dd-name">{p.name}</span>
                <span className="dd-freq">{tracked ? 'already tracking' : cadenceLabel(p)}</span>
                {tracked && <Check size={14} strokeWidth={2.5} className="dd-check" />}
              </button>
            )
          })}
          {visible.length === 0 && <div className="dd-item muted">No matches</div>}
        </div>
      )}
      {error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  )
}
