import { usePanchangam } from '../hooks/usePanchangam'
import {
  TAMIL_MONTH_SCRIPT, MALAYALAM_MONTH_SCRIPT,
  TAMIL_NAKSHATRA_SCRIPT, MALAYALAM_NAKSHATRA_SCRIPT,
  TAMIL_SAMVATSARA_SCRIPT, TAMIL_KALAM_SCRIPT, MALAYALAM_KALAM_SCRIPT,
  tamilThithi, malayalamThithi, kollavarshamLabel,
} from '../utils/panchangamScript'

const KALAMS = [
  { key: 'rahu', english: 'Rahu Kalam', start: 'rahu_kalam_start', end: 'rahu_kalam_end' },
  { key: 'yamagandam', english: 'Yamagandam', start: 'yamagandam_start', end: 'yamagandam_end' },
  { key: 'gulika', english: 'Gulika Kalam', start: 'gulika_kalam_start', end: 'gulika_kalam_end' },
]

// Today-page panchangam info box (Intent 2.7) - best-effort v1, see
// docs/UPGRADE-PLAN.md Intent 2.7 for the accuracy caveats. Renders nothing
// while loading or if today's date has no precomputed row yet.
//
// Every field carries its Malayalam and Tamil forms alongside the English, in
// that order. Native-script lookups fall back to the stored transliteration
// rather than blanking, so an unmapped value degrades to English.
export default function PanchangamBox() {
  const { day, loading } = usePanchangam()
  if (loading || !day) return null

  const kollavarsham = kollavarshamLabel(day.kollavarsham_year)
  const tamilVarsham = TAMIL_SAMVATSARA_SCRIPT[day.varsham_name]
  const mlThithi = malayalamThithi(day.thithi)
  const taThithi = tamilThithi(day.thithi)
  const mlNakshatra = MALAYALAM_NAKSHATRA_SCRIPT[day.nakshatra]
  const taNakshatra = TAMIL_NAKSHATRA_SCRIPT[day.nakshatra]

  return (
    <div className="panchangam-box">
      <div className="pb-line">
        {/* Kerala counts the Malayalam Era rather than naming the year from the
            60-cycle, so this half is a number, not a translation of Parabhava. */}
        {kollavarsham && <><b>{kollavarsham}</b> · </>}
        <b>{tamilVarsham ?? day.varsham_name} வருடம்</b> [{day.varsham_name}]
      </div>
      <div className="pb-line">
        {MALAYALAM_MONTH_SCRIPT[day.malayalam_month] ?? day.malayalam_month} [{day.malayalam_month}] {day.malayalam_day} ·{' '}
        {TAMIL_MONTH_SCRIPT[day.tamil_month] ?? day.tamil_month} [{day.tamil_month}] {day.tamil_day}
      </div>
      <div className="pb-line">
        {mlThithi ?? day.thithi} · {taThithi ?? day.thithi} [{day.thithi}]
      </div>
      <div className="pb-line">
        {mlNakshatra ?? day.nakshatra} · {taNakshatra ?? day.nakshatra} [{day.nakshatra}] Nakshatram
      </div>
      <div className="pb-kalams">
        <div className="pb-kalams-label">Kalam windows (IST)</div>
        {KALAMS.map(({ key, english, start, end }) => (
          <div className="pb-kalam" key={key}>
            <span className="pb-kalam-name">{english}</span>
            <span className="pb-kalam-native">{MALAYALAM_KALAM_SCRIPT[key]} · {TAMIL_KALAM_SCRIPT[key]}</span>
            <span className="pb-kalam-time">{day[start]}-{day[end]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
