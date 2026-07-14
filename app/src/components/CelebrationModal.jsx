import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { shareToWhatsApp } from '../utils/share'
import { track } from '../utils/analytics'

// Shown ONLY from a verified submit_practice_log response, and now AFTER the
// interstitial has already fired (Intent 0.2 moved the ad into TodayPage.mark,
// before this reward). Closing just dismisses.
export default function CelebrationModal({ data, onClose }) {
  const { profile } = useAuth()
  const modalRef = useRef(null)
  useFocusTrap(modalRef, true)

  const close = () => onClose()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const streak = data.overall_streak ?? 0
  return (
    <div className="modal-dim" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="celebration-title" tabIndex={-1} ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="confetti-row">✨ 🎉 ✨</div>
        <div className="big-flame">🔥</div>
        <div className="cel-streak" id="celebration-title">
          {data.day_complete
            ? <><span>{streak} Day</span> Streak!</>
            : <>{data.practice_done_today ? 'Completed!' : 'Marked!'}</>}
        </div>
        <div className="cel-sub">
          {data.practice_name} {data.practice_done_today ? 'completed' : 'progressing'}. Punyam grows daily.
        </div>

        {data.freeze_used && (
          <div className="cel-freeze">🧊 A freeze saved your streak</div>
        )}

        <div className="share-card">
          <div className="sc-om">🕉</div>
          <div className="sc-brand">Nithyakarma</div>
          <div className="sc-days">{streak} <span>day streak</span></div>
          <div className="sc-practice">
            {data.practice_name}<br />
            {data.subjectName} · {data.tier} tier
          </div>
          <div className="sc-foot">
            <span>Join me on Nithyakarma</span>
            <span>/r/{profile.referral_code}</span>
          </div>
        </div>

        <button className="btn-whatsapp" onClick={() => {
          track('share_clicked', { from: 'celebration' })
          shareToWhatsApp({
            streak, practiceName: data.practice_name,
            displayName: data.subjectName, tier: data.tier,
            referralCode: profile.referral_code,
          })
        }}>
          Share to WhatsApp
        </button>
        <button className="btn-plain" onClick={close}>Continue</button>
      </div>
    </div>
  )
}
