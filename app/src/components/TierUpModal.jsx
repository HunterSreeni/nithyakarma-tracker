import { useEffect, useRef } from 'react'
import { Star } from 'lucide-react'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { tierClass } from '../utils/tiers'
import { celebrationHaptic } from '../utils/haptics'

const TIER_MESSAGE = {
  Sadhaka: 'Discipline is taking root. Keep at it.',
  Yogi: 'Steady practice, steady growth - this is yogic consistency.',
  Rishi: 'Rare devotion. You are walking the path of the sages.',
  Brahmarishi: 'The highest tier. Your sadhana speaks for itself.',
}

// Shown after a tier-up (submit_practice_log's tier_up flag), separate from
// CelebrationModal - a tier change is a punya milestone, not a streak one, and
// can happen on any mark, not only the one that completes the day.
export default function TierUpModal({ tier, onClose }) {
  const modalRef = useRef(null)
  useFocusTrap(modalRef, true)

  const close = () => onClose()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => { celebrationHaptic() }, [])

  return (
    <div className="modal-dim" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="tier-up-title" tabIndex={-1} ref={modalRef} onClick={e => e.stopPropagation()}>
        <div className="big-flame"><Star size={48} strokeWidth={2} /></div>
        <div className="cel-streak" id="tier-up-title">Tier Up!</div>
        <div className={`tier-badge tier-up-badge ${tierClass(tier)}`}>{tier}</div>
        <div className="cel-sub">
          {TIER_MESSAGE[tier] ?? 'Your punya keeps growing. Keep at it.'}
        </div>
        <button className="btn-plain" onClick={close}>Continue</button>
      </div>
    </div>
  )
}
