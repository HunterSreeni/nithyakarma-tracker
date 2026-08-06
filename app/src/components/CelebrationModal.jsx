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
// The on-screen preview and the hidden export node render identical markup -
// factored out so they can't drift apart.
function ShareCardBody({ streak, data }) {
  return (
    <>
      <Flame className="sc-mark" size={150} strokeWidth={1.2} />
      <div className="sc-brand">Nithyakarma</div>
      <div className="sc-center">
        <div className="sc-days">{streak}</div>
        <div className="sc-days-label">day{streak === 1 ? '' : 's'} streak</div>
      </div>
      <div className="sc-practice">
        {data.practice_name}<br />
        {data.subjectName} · {data.tier} tier
      </div>
    </>
  )
}

export default function CelebrationModal({ data, onClose }) {
  const { profile } = useAuth()
  const modalRef = useRef(null)
  const cardRef = useRef(null)
  const exportCardRef = useRef(null)
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
    <>
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
            <ShareCardBody streak={streak} data={data} />
          </div>

          <button className="btn-whatsapp" disabled={sharing} onClick={async () => {
            track('share_clicked', { from: 'celebration' })
            setSharing(true)
            try {
              await shareCardToWhatsApp(exportCardRef.current, { streak, referralCode: profile.referral_code })
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

      {/* Hidden, isolated copy of the share card for html-to-image to capture -
          NOT the visible preview above. Off-screen via position:fixed, outside
          .modal-dim entirely, so none of the modal's padding/margin/animation
          leaks into the capture (see utils/share.js and the
          whatsapp-share-card-pixelratio memory for why that matters). No
          explicit width: a position:fixed block with only `left` set shrinks to
          fit its child, so .share-card's own `margin: auto` resolves to 0
          rather than centering into extra space. */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }} aria-hidden="true">
        <div className="share-card" ref={exportCardRef}>
          <ShareCardBody streak={streak} data={data} />
        </div>
      </div>
    </>
  )
}
