import { useState } from 'react'
import { Check, Languages } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useToday } from '../hooks/useToday'
import { useLearning } from '../hooks/useLearning'
import { supabase } from '../lib/supabase'
import { isDoneToday } from '../utils/cadence'
import CelebrationModal from './CelebrationModal'
import ErrorBanner from './ErrorBanner'

// Pilot content (Intent 2.1a) - the Learning content slug matches the
// practices.slug it auto-marks on the dashboard.
const PRACTICE_SLUG = 'hanuman-chalisa'
const LANGUAGES = [
  { key: 'english', label: 'English' },
  { key: 'malayalam', label: 'Malayalam' },
  { key: 'sanskrit', label: 'Sanskrit' },
]

export default function LearningPage() {
  const { session, profile, selectedMember, refresh } = useAuth()
  const ownerId = session.user.id
  const familyMemberId = selectedMember?.id ?? null
  const subjectName = selectedMember?.name ?? profile.display_name

  const { items, submit, addPractice } = useToday(ownerId, familyMemberId)
  const { verses, learned, loading, error: loadError, markLearned } =
    useLearning(ownerId, familyMemberId, PRACTICE_SLUG)

  const [language, setLanguage] = useState('english')
  const [busyId, setBusyId] = useState(null)
  const [markError, setMarkError] = useState(null)
  const [celebration, setCelebration] = useState(null)

  const onMarkVerse = async (verseId) => {
    setBusyId(verseId); setMarkError(null)
    try {
      const wasNew = await markLearned(verseId)
      if (!wasNew) return

      const existingItem = items.find(i => i.practice.slug === PRACTICE_SLUG)
      let userPracticeId
      if (existingItem) {
        if (isDoneToday(existingItem.practice, existingItem.logs)) return
        userPracticeId = existingItem.up.id
      } else {
        const { data: practice } = await supabase.from('practices')
          .select('id').eq('slug', PRACTICE_SLUG).single()
        if (!practice) return
        await addPractice(practice.id)
        let q = supabase.from('user_practices').select('id')
          .eq('owner_id', ownerId).eq('practice_id', practice.id)
        q = familyMemberId ? q.eq('family_member_id', familyMemberId) : q.is('family_member_id', null)
        const { data: up } = await q.single()
        userPracticeId = up.id
      }

      const result = await submit(userPracticeId, { awardStreak: false })
      await refresh()
      if (result.day_complete && (result.overall_streak ?? 0) >= 1) {
        setCelebration({ ...result, subjectName })
      }
    } catch (err) {
      setMarkError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const learnedCount = verses.filter(v => learned.has(v.id)).length

  return (
    <>
      <div className="eyebrow">Learning</div>
      <h1 className="greet">Hanuman Chalisa</h1>
      <div className="greet-sub">Learn verse by verse, in the language you read best.</div>

      <div className="today-card">
        <div>
          <div className="tc-label">Verses Learned</div>
          <div className="tc-big">{learnedCount} of {verses.length || 43}</div>
          <div className="tc-hint">Marking a verse logs today's practice and earns punya (doesn't affect your streak)</div>
        </div>
        <div className="progress-ring" style={{
          background: `conic-gradient(#fff 0% ${verses.length ? (learnedCount / verses.length) * 100 : 0}%, rgba(255,255,255,0.25) 0% 100%)`,
        }}>
          <div className="pr-core">{learnedCount}/{verses.length || 43}</div>
        </div>
      </div>

      <div className="lang-select" role="group" aria-label="Language">
        <Languages size={14} strokeWidth={2.5} />
        {LANGUAGES.map(l => (
          <button key={l.key} type="button"
            className={`lang-btn ${language === l.key ? 'on' : ''}`}
            aria-pressed={language === l.key}
            onClick={() => setLanguage(l.key)}>
            {l.label}
          </button>
        ))}
      </div>

      {markError && <div className="auth-error" role="alert">{markError}</div>}

      {loading ? <div className="spinner-wrap">Loading...</div> : loadError ? (
        <ErrorBanner message={loadError} />
      ) : (
        <div className="verse-list">
          {verses.map(v => {
            const done = learned.has(v.id)
            return (
              <div key={v.id} className={`verse-card ${done ? 'done' : ''}`}>
                <div className="v-body">
                  <div className="verse-type">{v.type === 'doha' ? 'Doha' : 'Chaupai'}</div>
                  <div className="verse-text">{v[language]}</div>
                </div>
                {done ? <div className="done-check"><Check size={16} strokeWidth={3} /></div>
                  : (
                    <button className="btn-done" disabled={busyId === v.id}
                      onClick={() => onMarkVerse(v.id)}>
                      {busyId === v.id ? 'Saving...' : 'Mark Learned'}
                    </button>
                  )}
              </div>
            )
          })}
        </div>
      )}

      {celebration && (
        <CelebrationModal data={celebration} onClose={() => setCelebration(null)} />
      )}
    </>
  )
}
