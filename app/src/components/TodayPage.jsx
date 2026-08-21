import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Flame, Snowflake, Check, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useToday } from '../hooks/useToday'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { supabase } from '../lib/supabase'
import { isDoneToday, countsTowardDayCompletion, dayComplete, cadenceLabel, localDateString, SANDHYA_SLOTS, RUDRAM_SLOTS, SAMIDHA_SLOTS } from '../utils/cadence'
import { dayGap, streakState } from '../utils/streak'
import { tierFor, tierClass } from '../utils/tiers'
import CelebrationModal from './CelebrationModal'
import TierUpModal from './TierUpModal'
import GayatriCountModal from './GayatriCountModal'
import ProfileSwitcher from './ProfileSwitcher'
import PanchangamBox from './PanchangamBox'
import MonthlySpecialBanner from './MonthlySpecialBanner'
import ObservanceBanner from './ObservanceBanner'
import ErrorBanner from './ErrorBanner'
import PracticeIcon from '../utils/practiceIcons'
import { track } from '../utils/analytics'
import { showInterstitial } from '../utils/ads'
import { isMilestone, maybeRequestReview } from '../utils/review'
import { lazyWithRetry } from '../utils/lazyWithRetry'
import { queryClient, withDeadline, unwrap } from '../lib/queryClient'
import { friendlyError } from '../utils/friendlyError'

// Deferred - pulls in driver.js, which only the first-run tour ever needs.
const GuidedTour = lazyWithRetry(() => import('./GuidedTour'))

export default function TodayPage() {
  const { session, profile, selectedMember, refresh } = useAuth()
  const { items, loading, refreshing, error: loadError, submit, addPractice, reload } =
    useToday(session.user.id, selectedMember?.id ?? null)
  const [celebration, setCelebration] = useState(null)
  const [tierUp, setTierUp] = useState(null)
  const [gayatriPrompt, setGayatriPrompt] = useState(null) // { item, slot }
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)
  // Holds a tier-up until the streak celebration (if any) has been dismissed,
  // so the two modals never stack on top of each other.
  const pendingTierUpRef = useRef(null)

  const subjectName = selectedMember?.name ?? profile.display_name
  // Read the alive/dead boundary live rather than trusting current_streak,
  // which only gets rewritten by the nightly decay job - see utils/streak.js.
  const subject = selectedMember ?? profile
  const { streak: subjectStreak, frozen } = streakState(subject)
  const catchupAvailable = subjectStreak > 0 && dayGap(subject.last_complete_date, localDateString()) === 2
  const subjectFreezes = selectedMember?.freeze_credits ?? profile.freeze_credits ?? 0
  const subjectPunya = selectedMember?.punya ?? profile.punya ?? 0
  const subjectTier = tierFor(subjectPunya)
  // Day counter must mirror the server's day-completion rule, not "was it logged".
  // The per-practice tick below still uses isDoneToday.
  const doneCount = items.filter(i => countsTowardDayCompletion(i.practice, i.logs)).length
  const dateLine = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  })

  const mark = async (item, slot = null, count = null) => {
    setBusyId(item.up.id); setError(null)
    // Any one scheduled practice now completes the day, so day_complete stays
    // true for every remaining mark that day - snapshot whether it was already
    // true before this log, so the celebration/review-prompt/ad-milestone logic
    // below only fires on the mark that FIRST completed the day, not every one after.
    const wasComplete = dayComplete(items)
    try {
      const result = await submit(item.up.id, {
        slot, count: item.practice.is_sandhyavandhanam ? count
          : item.practice.is_sri_rudram ? null
          : (item.practice.target_count ?? null),
      })
      await refresh() // streaks in topbar / switcher
      const justCompleted = !!result.day_complete && !wasComplete
      track('practice_marked', {
        day_complete: !!result.day_complete,
        freeze_used: !!result.freeze_used,
        overall_streak: result.overall_streak ?? 0,
        is_sandhya: !!item.practice.is_sandhyavandhanam,
        is_sri_rudram: !!item.practice.is_sri_rudram,
        is_samidhadhanam: !!item.practice.is_samidhadhanam,
      })
      // Ad fires here - after the verified save, BEFORE the celebration reward
      // (Intent 0.2). At a streak milestone, ask for a review instead (Intent 1.4);
      // never both, and never on a failed save (we are past submit()).
      const milestone = justCompleted && isMilestone(result.overall_streak ?? 0)
      const reviewed = milestone ? await maybeRequestReview() : false
      if (!reviewed) await showInterstitial(profile)
      const willCelebrate = justCompleted && (result.overall_streak ?? 0) >= 1
      if (willCelebrate) {
        setCelebration({ ...result, subjectName })
      }
      if (result.tier_up) {
        if (willCelebrate) {
          pendingTierUpRef.current = result.tier
        } else {
          setTierUp({ tier: result.tier })
        }
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyId(null)
    }
  }

  const onSlotClick = (item, slot) => setGayatriPrompt({ item, slot })
  // Sri Rudram and Samidhadhanam slots mark directly, unlike Sandhya's - no
  // Gayatri-count prompt applies.
  const onRudramSlotClick = (item, slot) => mark(item, slot)

  return (
    <>
      <div className="eyebrow">{dateLine}</div>
      <h1 className="greet">Namaskaram, {subjectName.split(' ')[0]}</h1>
      <div className="greet-sub">
        {loading ? ' '
          : items.length === 0 ? 'Start with a suggested anushtanam below'
          : doneCount === 0 ? "0 anushtanams done today. Let's begin."
          : doneCount === items.length ? `${doneCount} anushtanam${doneCount === 1 ? '' : 's'} done today. Wonderful, all done!`
          : `${doneCount} anushtanam${doneCount === 1 ? '' : 's'} done today. Keep it up!`}
      </div>
      <PanchangamBox />
      <MonthlySpecialBanner />
      <ObservanceBanner />

      <ProfileSwitcher />

      <div className="today-card">
        <div>
          <div className="tc-label">Current Streak</div>
          <div className="tc-big"><Flame size={18} strokeWidth={2.5} /> {subjectStreak} day{subjectStreak === 1 ? '' : 's'}</div>
          <div className="tc-hint">
            Best: {selectedMember?.best_streak ?? profile.best_streak} day{(selectedMember?.best_streak ?? profile.best_streak) === 1 ? '' : 's'}
            {' · '}<Snowflake size={12} strokeWidth={2.5} /> {subjectFreezes} freeze{subjectFreezes === 1 ? '' : 's'}
          </div>
          <div className="tc-hint">
            <span>{subjectPunya} punya</span>{' · '}
            <span className={`tier-badge ${tierClass(subjectTier)}`}>{subjectTier}</span>
          </div>
          {catchupAvailable && (
            <div className="tc-frozen" role="status">
              <Snowflake size={12} strokeWidth={2.5} /> {frozen
                ? <>You missed yesterday. Backfill one of yesterday's sandhyas to keep this streak
                  without spending a freeze, or mark one anushtanam today to use a freeze.</>
                : <>You missed yesterday. Backfill one of yesterday's sandhyas before today ends to
                  keep this streak. Marking only today will restart it.</>}
            </div>
          )}
        </div>
        <div className="pr-wrap">
          <div className="pr-core">{doneCount}</div>
          <div className="pr-caption">Today</div>
        </div>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <h2 className="section-h">Today's Anushtanams</h2>
      {refreshing && <div className="greet-sub" role="status">Refreshing...</div>}
      {loading ? <div className="spinner-wrap">Loading...</div> : loadError && !items.length ? (
        <ErrorBanner message={loadError} onRetry={reload} />
      ) : items.length === 0 ? (
        <SuggestedPractices onAdd={addPractice} />
      ) : (
        <div className="practice-list">
          {items.map(item => (
            <PracticeCard key={item.up.id} item={item}
              busy={busyId === item.up.id} onMark={mark} onSlotClick={onSlotClick}
              onRudramSlotClick={onRudramSlotClick} />
          ))}
        </div>
      )}
      {loadError && items.length > 0 && <ErrorBanner message={loadError} onRetry={reload} />}

      <AddPracticeDropdown existing={items.map(i => i.practice.id)} onAdd={addPractice} />

      {celebration && (
        <CelebrationModal data={celebration} onClose={() => {
          setCelebration(null)
          if (pendingTierUpRef.current) {
            setTierUp({ tier: pendingTierUpRef.current })
            pendingTierUpRef.current = null
          }
        }} />
      )}

      {tierUp && (
        <TierUpModal tier={tierUp.tier} onClose={() => setTierUp(null)} />
      )}

      {gayatriPrompt && (
        <GayatriCountModal slot={gayatriPrompt.slot}
          onCancel={() => setGayatriPrompt(null)}
          onConfirm={count => {
            const { item, slot } = gayatriPrompt
            setGayatriPrompt(null)
            mark(item, slot, count)
          }} />
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

function PracticeCard({ item, busy, onMark, onSlotClick, onRudramSlotClick }) {
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
                  onClick={() => onSlotClick(item, s.key)}>
                  {slotsDone.has(s.key) && <Check size={11} strokeWidth={3} />}{s.short}
                </button>
              ))}
            </div>
            <YesterdaySandhya item={item} />
          </>
        )}
        {practice.is_sri_rudram && (
          <div className="slot-row">
            {RUDRAM_SLOTS.map(s => (
              <button key={s.key} disabled={slotsDone.has(s.key) || busy}
                className={`slot-btn ${slotsDone.has(s.key) ? 'done' : ''}`}
                onClick={() => onRudramSlotClick(item, s.key)}>
                {slotsDone.has(s.key) && <Check size={11} strokeWidth={3} />}{s.short}
              </button>
            ))}
          </div>
        )}
        {practice.is_samidhadhanam && (
          <div className="slot-row">
            {SAMIDHA_SLOTS.map(s => (
              <button key={s.key} disabled={slotsDone.has(s.key) || busy}
                className={`slot-btn ${slotsDone.has(s.key) ? 'done' : ''}`}
                onClick={() => onRudramSlotClick(item, s.key)}>
                {slotsDone.has(s.key) && <Check size={11} strokeWidth={3} />}{s.short}
              </button>
            ))}
          </div>
        )}
      </div>
      {done ? <div className="done-check"><Check size={16} strokeWidth={3} /></div>
        : !practice.is_sandhyavandhanam && !practice.is_sri_rudram && !practice.is_samidhadhanam && (
          <button className="btn-done" disabled={busy} onClick={() => onMark(item)}>
            {busy ? 'Saving...' : 'Mark Done'}
          </button>
        )}
    </div>
  )
}

// AI-DEV NOTE: Protected product logic. Do not change yesterday catch-up's
// one-day-only/full-punya/streak/freeze behavior without Sreeni's explicit
// instruction. The dedicated server RPC owns the accounting and validation.
// See AGENTS.md and the Supabase integration assertions.
function YesterdaySandhya({ item }) {
  const { refresh } = useAuth()
  const [open, setOpen] = useState(false)
  const [busySlot, setBusySlot] = useState(null)
  const [note, setNote] = useState(null)
  const [saveError, setSaveError] = useState(null)
  const [gayatriSlot, setGayatriSlot] = useState(null)
  const yesterday = localDateString(new Date(Date.now() - 24 * 60 * 60 * 1000))

  const yesterdayQuery = useQuery({
    queryKey: ['yesterday-sandhya', item.up.id, yesterday],
    enabled: open,
    queryFn: async () => unwrap(await withDeadline(
      supabase.from('practice_logs').select('slot')
        .eq('user_practice_id', item.up.id).eq('log_date', yesterday),
      'Yesterday sandhya',
    )) ?? [],
    staleTime: 60_000,
  }, queryClient)
  const slotsDone = new Set((yesterdayQuery.data ?? []).map(log => log.slot))

  const markYesterday = async (slot, count) => {
    setBusySlot(slot); setSaveError(null); setNote(null)
    try {
      const data = unwrap(await withDeadline(supabase.rpc('submit_yesterday_sandhya', {
        p_user_practice_id: item.up.id, p_slot: slot, p_count: count,
        p_local_date: yesterday,
      }), 'Save yesterday sandhya'))
      if (!data?.saved) throw new Error('Save could not be verified')
      await yesterdayQuery.refetch()
      const streak = Number.isInteger(data.overall_streak)
        ? ` · streak is now ${data.overall_streak} day${data.overall_streak === 1 ? '' : 's'}`
        : ` · yesterday's streak counted`
      const refund = data.freeze_refunded ? ' · freeze refunded' : ''
      setNote(`+${data.punya_awarded} punya${streak}${refund}`)
      await refresh() // punya/streak/freeze in the topbar and card
    } catch (err) {
      setSaveError(friendlyError(err))
    } finally {
      setBusySlot(null)
    }
  }

  return (
    <div className="yesterday-sandhya">
      <button type="button" className="yesterday-toggle" onClick={() => setOpen(value => !value)}>
        {open ? <ChevronUp size={12} strokeWidth={2.5} /> : <ChevronDown size={12} strokeWidth={2.5} />}
        Missed a sandhya yesterday?
      </button>
      {open && (
        <div className="yesterday-panel">
          {yesterdayQuery.isPending && <div className="yesterday-note">Checking yesterday...</div>}
          {yesterdayQuery.error && (
            <ErrorBanner message={friendlyError(yesterdayQuery.error)} onRetry={() => yesterdayQuery.refetch()} />
          )}
          {yesterdayQuery.isSuccess && slotsDone.size >= 3 && (
            <div className="yesterday-note">All 3 of yesterday's sandhyas are already marked.</div>
          )}
          {yesterdayQuery.isSuccess && slotsDone.size < 3 && (
            <>
              <div className="yesterday-note">Full punya. Your first marked sandhya also counts yesterday toward your streak.</div>
              <div className="slot-row">
                {SANDHYA_SLOTS.map(s => (
                  <button key={s.key} disabled={slotsDone.has(s.key) || !!busySlot}
                    className={`slot-btn ${slotsDone.has(s.key) ? 'done' : ''}`}
                    onClick={() => setGayatriSlot(s.key)}>
                    {slotsDone.has(s.key) && <Check size={11} strokeWidth={3} />}{s.short}
                  </button>
                ))}
              </div>
            </>
          )}
          {note && <div className="yesterday-note yesterday-success">{note}</div>}
          {saveError && <div className="yesterday-note yesterday-error">{saveError}</div>}
        </div>
      )}
      {gayatriSlot && (
        <GayatriCountModal slot={gayatriSlot}
          onCancel={() => setGayatriSlot(null)}
          onConfirm={count => {
            const slot = gayatriSlot
            setGayatriSlot(null)
            markYesterday(slot, count)
          }} />
      )}
    </div>
  )
}

function AddPracticeDropdown({ existing, onAdd }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [catalog, setCatalog] = useState([])
  const [catalogLoaded, setCatalogLoaded] = useState(false)
  const [error, setError] = useState(null)
  const { profile, selectedMember } = useAuth()
  const dropdownRef = useRef(null)
  useFocusTrap(dropdownRef, open)

  // On first open, not on mount: `catalog` is only ever read inside the
  // `open &&` block below, so fetching the whole practices table on every
  // Today render just put a full table read on the reopen critical path for a
  // dropdown most users never touch. Tracked with a loaded flag rather than
  // `catalog.length`, so the in-flight state is distinguishable from a genuine
  // empty result - otherwise the first open renders "No matches" for the whole
  // round trip, which reads as "there is nothing to add".
  useEffect(() => {
    if (!open || catalogLoaded) return
    supabase.from('practices').select('*').eq('active', true).order('id')
      .then(({ data }) => { setCatalog(data ?? []); setCatalogLoaded(true) })
  }, [open, catalogLoaded])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const subjectGender = selectedMember?.gender ?? profile.gender
  const upanayanamOk = selectedMember ? selectedMember.upanayanam_done : true

  const brahmachariOk = selectedMember ? selectedMember.upanayanam_done : !profile.is_married
  // A child can never be married - Brahmayagnam is self-only.
  const grihasthaOk = selectedMember ? false : !!profile.is_married

  const visible = useMemo(() => catalog.filter(p => {
    if (p.is_sandhyavandhanam && (subjectGender !== 'male' || !upanayanamOk)) return false
    if (p.requires_brahmachari && (subjectGender !== 'male' || !brahmachariOk)) return false
    if (p.requires_grihastha && (subjectGender !== 'male' || !grihasthaOk)) return false
    return p.name.toLowerCase().includes(search.toLowerCase())
  }), [catalog, search, subjectGender, upanayanamOk, brahmachariOk, grihasthaOk])

  const add = async (p) => {
    setError(null)
    try {
      await onAdd(p.id)
      setOpen(false); setSearch('')
    } catch (err) {
      setError(friendlyError(err))
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
          {!catalogLoaded
            ? <div className="dd-item muted">Loading...</div>
            : visible.length === 0 && <div className="dd-item muted">No matches</div>}
        </div>
      )}
      {error && <div className="auth-error" role="alert">{error}</div>}
    </div>
  )
}
