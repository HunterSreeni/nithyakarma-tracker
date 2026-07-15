import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Traps Tab/Shift+Tab focus within containerRef while active, moves focus
// into it on activation, and restores focus to whatever was focused before
// activation once it ends (e.g. the button that opened a modal/dropdown).
export function useFocusTrap(containerRef, active) {
  const previouslyFocused = useRef(null)

  useEffect(() => {
    if (!active) return
    previouslyFocused.current = document.activeElement

    const container = containerRef.current
    const focusables = () => Array.from(container?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])
    const first = focusables()[0]
    ;(first ?? container)?.focus()

    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault(); lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [active, containerRef])
}
