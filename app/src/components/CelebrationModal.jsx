import { useEffect, useRef, useState } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { shareCardToWhatsApp } from '../utils/share'
import { track } from '../utils/analytics'
import { celebrationHaptic } from '../utils/haptics'

// Shown ONLY from a verified submit_practice_log response, and now AFTER the
// interstitial has already fired (Intent 0.2 moved the ad into TodayPage.mark,
// before this reward). Closing just dismisses.
export default function CelebrationModal({ data, onClose }) {
  const { profile } = useAuth()
  const modalRef = useRef(null)
  const cardRef = useRef(null)
  const [sharing, setSharing] = useState(false)
  useFocusTrap(modalRef, true)

  const close = () => onClose()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => { celebrationHaptic() }, [])

  const streak = data.overall_streak ?? 0
  return (
    <div className="modal-dim" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="celebration-title" tabIndex={-1} ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="big-flame"><Flame size={48} strokeWidth={2} /></div>
        <div className="cel-streak" id="celebration-title">
          {data.day_complete
            ? <><span>{streak} Day{streak === 1 ? '' : 's'}</span> Streak!</>
            : <>{data.practice_done_today ? 'Completed!' : 'Marked!'}</>}
        </div>
        <div className="cel-sub">
          {data.practice_name} {data.practice_done_today ? 'completed' : 'progressing'}. Punyam grows daily.
        </div>

        {data.freeze_used && (
          <div className="cel-freeze"><Snowflake size={13} strokeWidth={2.5} /> A freeze saved your streak</div>
        )}

        <div className="share-card" ref={cardRef}>
          <Flame className="sc-mark" size={80} strokeWidth={1.5} />
          <div className="sc-brand">Nithyakarma</div>
          <div className="sc-days">{streak} <span>day{streak === 1 ? '' : 's'} streak</span></div>
          <div className="sc-practice">
            {data.practice_name}<br />
            {data.subjectName} · {data.tier} tier
          </div>
        </div>

        <button className="btn-whatsapp" disabled={sharing} onClick={async () => {
          track('share_clicked', { from: 'celebration' })
          setSharing(true)
          try {
            await shareCardToWhatsApp(cardRef.current, { streak, referralCode: profile.referral_code })
          } catch (err) {
            // AbortError = user closed the native share sheet without picking
            // anything - not a failure, nothing to surface.
            if (err?.name !== 'AbortError') console.error('Share failed', err)
          } finally {
            setSharing(false)
          }
        }}>
          {sharing ? 'Preparing...' : 'Share to WhatsApp'}
        </button>
        <button className="btn-plain" onClick={close}>Continue</button>
      </div>
    </div>
  )
}
