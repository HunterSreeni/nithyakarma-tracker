import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

// First-run product tour. Uses driver.js to spotlight the real elements on the
// Today page - most importantly the Sandhyavandhanam slot row - so the 3-slot
// design is explained on the actual buttons, not just described in a modal.
// Shown once per device; the "!" info button on the card is the permanent
// re-explainer afterwards.
const SEEN_KEY = 'nk_tour_seen_v1'

export function tourSeen() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return true }
}
function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1') } catch { /* private mode - show once per load */ }
}

// Element-less first step renders as a centered popover; anchored steps
// spotlight the target. The sandhya step is only included when its element is
// present (male users who track Sandhyavandhanam).
export function buildSteps(showSandhya) {
  const steps = [{
    popover: {
      title: 'Namaskaram 🙏',
      description: 'Track your daily anushtanams here. Mark each one done every day to grow your streak.',
    },
  }]
  if (showSandhya) {
    steps.push({
      element: '[data-tour="sandhya-slots"]',
      popover: {
        title: 'Sandhyavandhanam is three sandhyas',
        description: 'Perform it thrice a day - Prathakala (morning), Madhyanika (noon) and Saayamkala (evening). Mark all three here to complete the day; only then does it count towards your streak.',
        side: 'top', align: 'center',
      },
    })
  }
  steps.push({
    element: '[data-tour="add-practice"]',
    popover: {
      title: "You're all set",
      description: 'Add more anushtanams from here any time. Tap the "!" beside Sandhyavandhanam to see this again.',
      side: 'top', align: 'center',
    },
  })
  return steps
}

export default function GuidedTour({ ready, showSandhya }) {
  useEffect(() => {
    if (!ready || tourSeen()) return
    // Only anchor the sandhya step if the card is actually on the page.
    const hasSlots = !!document.querySelector('[data-tour="sandhya-slots"]')
    const d = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Begin 🪔',
      popoverClass: 'nk-tour',
      onDestroyed: () => markSeen(),
      steps: buildSteps(showSandhya && hasSlots),
    })
    d.drive()
    return () => d.destroy()
  }, [ready, showSandhya])

  return null
}
