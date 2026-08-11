import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { usePanchangam } from '../hooks/usePanchangam'
import { supabase } from '../lib/supabase'
import { localDateString } from '../utils/cadence'

const DISMISS_PREFIX = 'nk_dismissed_tithi_'

// Same-day banner for Ekadashi/Dwadashi/Trayodashi/Purnima (Intent: requested
// 2026-08-11). Scoped to the "pure tithi" rows only - every match_* column
// null except match_thithi and day_offset=0 - so this never picks up a
// named-festival row (Pongal, Vishu, Avani Avittam, ...) that happens to
// share a thithi; those already have their own more specific messaging via
// MonthlySpecialBanner or their own observance row. Wording is identical for
// both traditions on purpose - no Tamil/Malayalam branch, unlike
// PanchangamBox.
export default function TithiObservanceBanner() {
  const { day } = usePanchangam()
  const [observance, setObservance] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const thithi = day?.thithi

  useEffect(() => {
    if (!thithi) return
    let cancelled = false
    supabase.from('panchangam_observances').select('*')
      .eq('category', 'observance').eq('match_thithi', thithi)
      .is('match_tamil_month', null).is('match_tamil_day', null)
      .is('match_malayalam_month', null).is('match_malayalam_day', null)
      .is('match_nakshatra', null).eq('day_offset', 0)
      .order('priority', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (!cancelled) setObservance(data ?? null) })
    return () => { cancelled = true }
  }, [thithi])

  useEffect(() => {
    if (!observance) return
    setDismissed(localStorage.getItem(DISMISS_PREFIX + localDateString()) === '1')
  }, [observance])

  if (!observance || dismissed) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_PREFIX + localDateString(), '1') } catch { /* private mode */ }
    setDismissed(true)
  }

  return (
    <div className="monthly-special monthly-special-static">
      <div>
        <div className="ms-title">{observance.title}</div>
        <div className="ms-subtitle">{observance.message}</div>
      </div>
      <button type="button" className="ms-dismiss" aria-label="Dismiss" onClick={dismiss}>
        <X size={16} strokeWidth={2.5} />
      </button>
    </div>
  )
}
