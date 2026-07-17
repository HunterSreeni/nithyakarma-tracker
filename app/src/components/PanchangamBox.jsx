import { usePanchangam } from '../hooks/usePanchangam'
import { TAMIL_MONTH_SCRIPT, MALAYALAM_MONTH_SCRIPT } from '../utils/panchangamScript'

// Today-page panchangam info box (Intent 2.7) - best-effort v1, see
// docs/UPGRADE-PLAN.md Intent 2.7 for the accuracy caveats. Renders nothing
// while loading or if today's date has no precomputed row yet.
export default function PanchangamBox() {
  const { day, loading } = usePanchangam()
  if (loading || !day) return null

  return (
    <div className="panchangam-box">
      <div className="pb-line">
        <b>{day.varsham_name} Varsham</b> ·{' '}
        {MALAYALAM_MONTH_SCRIPT[day.malayalam_month] ?? day.malayalam_month} [{day.malayalam_month}] {day.malayalam_day} ·{' '}
        {TAMIL_MONTH_SCRIPT[day.tamil_month] ?? day.tamil_month} [{day.tamil_month}] {day.tamil_day}
      </div>
      <div className="pb-line">{day.thithi} · {day.nakshatra} Nakshatram</div>
      <div className="pb-kalams">
        <span>Rahu Kalam {day.rahu_kalam_start}-{day.rahu_kalam_end}</span>
        <span>Yamagandam {day.yamagandam_start}-{day.yamagandam_end}</span>
        <span>Gulika Kalam {day.gulika_kalam_start}-{day.gulika_kalam_end}</span>
      </div>
    </div>
  )
}
