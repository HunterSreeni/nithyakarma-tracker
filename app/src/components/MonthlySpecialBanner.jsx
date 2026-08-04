import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { usePanchangam } from '../hooks/usePanchangam'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const DISMISS_PREFIX = 'nk_dismissed_special_'

// Data-driven monthly nudge (general framework, not Karkidakam-specific) -
// looks up today's month against monthly_specials, keyed by (calendar,
// month). Follows the same tradition branch as PanchangamBox.jsx
// (profile.panchangam_tradition, default 'tamil') rather than always
// showing the Malayalam row regardless of the user's preference. Adding a
// future month's special is a DB row, not a code change.
export default function MonthlySpecialBanner() {
  const { day } = usePanchangam()
  const { profile } = useAuth()
  const [special, setSpecial] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const tradition = profile?.panchangam_tradition === 'malayalam' ? 'malayalam' : 'tamil'
  const month = tradition === 'malayalam' ? day?.malayalam_month : day?.tamil_month

  useEffect(() => {
    if (!month) return
    let cancelled = false
    supabase.from('monthly_specials').select('*').eq('calendar', tradition).eq('month', month).maybeSingle()
      .then(({ data }) => { if (!cancelled) setSpecial(data ?? null) })
    return () => { cancelled = true }
  }, [tradition, month])

  useEffect(() => {
    if (!special) return
    setDismissed(localStorage.getItem(DISMISS_PREFIX + special.calendar + '_' + special.month) === '1')
  }, [special])

  if (!special || dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_PREFIX + special.calendar + '_' + special.month, '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  const body = (
    <>
      <div>
        <div className="ms-title">{special.title}</div>
        <div className="ms-subtitle">{special.subtitle}</div>
      </div>
      <button type="button" className="ms-dismiss" aria-label="Dismiss"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismiss() }}>
        <X size={16} strokeWidth={2.5} />
      </button>
    </>
  )

  // Most months don't have a dedicated page to link to yet - route is
  // nullable, and those render as an info-only banner instead of a link.
  if (!special.route) {
    return <div className="monthly-special monthly-special-static">{body}</div>
  }

  return (
    <Link to={special.route} className="monthly-special">
      {body}
    </Link>
  )
}
