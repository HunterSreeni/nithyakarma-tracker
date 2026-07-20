import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { usePanchangam } from '../hooks/usePanchangam'
import { supabase } from '../lib/supabase'

const DISMISS_PREFIX = 'nk_dismissed_special_'

// Data-driven monthly nudge (general framework, not Karkidakam-specific) -
// looks up today's malayalam_month against monthly_specials. Adding a future
// month's special is a DB row, not a code change.
export default function MonthlySpecialBanner() {
  const { day } = usePanchangam()
  const [special, setSpecial] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!day?.malayalam_month) return
    let cancelled = false
    supabase.from('monthly_specials').select('*').eq('malayalam_month', day.malayalam_month).maybeSingle()
      .then(({ data }) => { if (!cancelled) setSpecial(data ?? null) })
    return () => { cancelled = true }
  }, [day?.malayalam_month])

  useEffect(() => {
    if (!special) return
    setDismissed(localStorage.getItem(DISMISS_PREFIX + special.malayalam_month) === '1')
  }, [special])

  if (!special || dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_PREFIX + special.malayalam_month, '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  return (
    <Link to={special.route} className="monthly-special">
      <div>
        <div className="ms-title">{special.title}</div>
        <div className="ms-subtitle">{special.subtitle}</div>
      </div>
      <button type="button" className="ms-dismiss" aria-label="Dismiss"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss() }}>
        <X size={16} strokeWidth={2.5} />
      </button>
    </Link>
  )
}
