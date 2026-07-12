import { useEffect, useRef, useState } from 'react'

// Lightweight first-run walkthrough. Its main job is to explain the 3-slot
// Sandhyavandhanam design (why one "Mark done" is not enough). Shown once per
// device; the "!" info button on the Sandhyavandhanam card is the permanent
// re-explainer after this is dismissed.
const SEEN_KEY = 'nk_tour_seen_v1'

export function tourSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode - show once per load */ }
}

function buildSteps(showSandhya) {
  const steps = [
    {
      icon: '🪔',
      title: 'Namaskaram 🙏',
      body: 'Track your daily anushtanams here. Mark each one done every day to keep your deepam burning and grow your streak.',
    },
  ]
  if (showSandhya) {
    steps.push({
      icon: '🕉',
      title: 'Sandhyavandhanam is three sandhyas',
      body: 'It is performed thrice a day - Prathakala (morning), Madhyanika (noon) and Saayamkala (evening). Mark all three to complete the day; only then does that day count towards your streak.',
    })
  }
  steps.push({
    icon: '✨',
    title: "You're all set",
    body: 'Add more anushtanams from the list below. Tap the "!" beside Sandhyavandhanam any time to see this again.',
  })
  return steps
}

export default function GuidedTour({ showSandhya }) {
  const [open, setOpen] = useState(!tourSeen())
  const [i, setI] = useState(0)
  const closeRef = useRef(null)

  const steps = buildSteps(showSandhya)
  const last = i === steps.length - 1

  const finish = () => { markSeen(); setOpen(false) }

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') finish() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  const step = steps[i]

  return (
    <div className="modal-dim" onClick={finish}>
      <div className="modal tour-modal" role="dialog" aria-modal="true"
        aria-labelledby="tour-title" onClick={e => e.stopPropagation()}>
        <button ref={closeRef} className="tour-skip" onClick={finish} aria-label="Skip walkthrough">Skip</button>
        <div className="tour-icon" aria-hidden="true">{step.icon}</div>
        <div id="tour-title" className="tour-title">{step.title}</div>
        <div className="tour-body">{step.body}</div>

        <div className="tour-dots" aria-hidden="true">
          {steps.map((_, n) => <span key={n} className={`tour-dot ${n === i ? 'on' : ''}`} />)}
        </div>

        <button className="btn-auth" onClick={() => last ? finish() : setI(i + 1)}>
          {last ? 'Begin 🪔' : 'Next'}
        </button>
      </div>
    </div>
  )
}
