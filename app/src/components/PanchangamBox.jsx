import { usePanchangam } from '../hooks/usePanchangam'
import { useAuth } from '../hooks/useAuth'
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
// Shows only the user's preferred tradition (profile.panchangam_tradition,
// default 'tamil') - Kerala and Tamil Nadu are structurally different facts
// here (Kollavarsham has no Tamil twin, the 60-cycle name has no Malayalam
// twin), not the same fact shown twice, so showing both to a single-tradition
// household is clutter, not redundant-but-harmless. Native-script lookups
// fall back to the stored transliteration rather than blanking, so an
// unmapped value degrades to English.
export default function PanchangamBox() {
  const { day, loading } = usePanchangam()
  const { profile } = useAuth()
  if (loading || !day) return null

  const tradition = profile?.panchangam_tradition === 'malayalam' ? 'malayalam' : 'tamil'

  if (tradition === 'malayalam') {
    const kollavarsham = kollavarshamLabel(day.kollavarsham_year)
    const mlThithi = malayalamThithi(day.thithi)
    const mlNakshatra = MALAYALAM_NAKSHATRA_SCRIPT[day.nakshatra]
    return (
      <div className="panchangam-box">
        <div className="pb-line">
          <b>{kollavarsham ?? day.varsham_name}</b>
        </div>
        <div className="pb-line">
          {MALAYALAM_MONTH_SCRIPT[day.malayalam_month] ?? day.malayalam_month} [{day.malayalam_month}] {day.malayalam_day}
        </div>
        <div className="pb-line">
          {mlThithi ?? day.thithi} [{day.thithi}]
        </div>
        <div className="pb-line">
          {mlNakshatra ?? day.nakshatra} [{day.nakshatra}] Nakshatram
        </div>
        <div className="pb-kalams">
          <div className="pb-kalams-label">Times shown in IST</div>
          {KALAMS.map(({ key, english, start, end }) => (
            <div className="pb-kalam" key={key}>
              <span className="pb-kalam-name">{english}</span>
              <span className="pb-kalam-native">{MALAYALAM_KALAM_SCRIPT[key]}</span>
              <span className="pb-kalam-time">{day[start]}-{day[end]}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const tamilVarsham = TAMIL_SAMVATSARA_SCRIPT[day.varsham_name]
  const taThithi = tamilThithi(day.thithi)
  const taNakshatra = TAMIL_NAKSHATRA_SCRIPT[day.nakshatra]
  return (
    <div className="panchangam-box">
      <div className="pb-line">
        <b>{tamilVarsham ?? day.varsham_name} வருடம்</b> [{day.varsham_name}]
      </div>
      <div className="pb-line">
        {TAMIL_MONTH_SCRIPT[day.tamil_month] ?? day.tamil_month} [{day.tamil_month}] {day.tamil_day}
      </div>
      <div className="pb-line">
        {taThithi ?? day.thithi} [{day.thithi}]
      </div>
      <div className="pb-line">
        {taNakshatra ?? day.nakshatra} [{day.nakshatra}] Nakshatram
      </div>
      <div className="pb-kalams">
        <div className="pb-kalams-label">Times shown in IST</div>
        {KALAMS.map(({ key, english, start, end }) => (
          <div className="pb-kalam" key={key}>
            <span className="pb-kalam-name">{english}</span>
            <span className="pb-kalam-native">{TAMIL_KALAM_SCRIPT[key]}</span>
            <span className="pb-kalam-time">{day[start]}-{day[end]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
