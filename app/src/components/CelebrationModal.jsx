import { useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { shareToWhatsApp } from '../utils/share'
import { showInterstitial } from '../utils/ads'
import { track } from '../utils/analytics'

// Shown ONLY from a verified submit_practice_log response.
// Flow: celebrate -> share (optional) -> on close, interstitial (Android, non-ad-free).
export default function CelebrationModal({ data, onClose }) {
  const { profile } = useAuth()
  const adFired = useRef(false)

  const close = async () => {
    if (!adFired.current) {
      adFired.current = true
      await showInterstitial(profile)
    }
    onClose()
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const streak = data.overall_streak ?? 0
  return (
    <div className="modal-dim" onClick={close}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="confetti-row">✨ 🎉 ✨</div>
        <div className="big-flame">🔥</div>
        <div className="cel-streak">
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
          <div className="sc-brand">🪔 Nithyakarma</div>
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
