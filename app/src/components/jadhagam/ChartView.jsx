import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { buildChart, RASIS, NAKSHATRAS, GRAHAS, RASI_LORDS, NAK_SPAN, formatDeg } from '../../lib/jadhagam/chart'
import { dasaTimeline, currentPeriod, formatYears, DASA_LORDS } from '../../lib/jadhagam/dasa'
import { birthDetailsToUtc as toUtc, offsetAt, utcOffsetLabel, formatBirthDate } from '../../lib/jadhagam/time'
import { PLACES_ATTRIBUTION } from '../../lib/jadhagam/places'
import { birthPanchangam, tithiYogaKarana, localDate, WEEKDAYS, TAMIL_MONTHS, MALAYALAM_MONTHS } from '../../lib/jadhagam/panchangam'
import { antarams, saturnNow, jupiterNow, chandrashtamam, nextStarBirthday, ageOn } from '../../lib/jadhagam/now'
import { siderealLon } from '../../lib/jadhagam/astro'

const GRAHA = Object.fromEntries(GRAHAS.map((g) => [g.key, g]))
// English plus the script of the chart's tradition: Malayalam for Kerala, Tamil otherwise.
const bothFor = (tradition) => (x) => `${x.en} (${tradition === 'kerala' ? x.ml : x.ta})`
const nativeFor = (tradition) => (x) => (tradition === 'kerala' ? x.ml : x.ta)
const monthYear = (ms) => new Date(ms).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

// South Indian chart: the signs stay fixed round the edge, Meenam top-left.
// [row, column] on a 4x4 grid for Mesham..Meenam; the middle 2x2 holds the title.
const CELL = [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [3, 1], [2, 1], [1, 1]]

const TABS = [
  { id: 'chart', label: 'Chart' },
  { id: 'panchangam', label: 'Panchangam' },
  { id: 'planets', label: 'Planets' },
  { id: 'dasa', label: 'Dasa' },
]

// AI-DEV NOTE: label languages for the chart grid. The Malayalam names were checked
// by Sreeni on 2026-11-18; Kerala charts open in Malayalam, the rest in Tamil.
const LANGS = [{ id: 'en', label: 'English' }, { id: 'ta', label: 'தமிழ்' }, { id: 'ml', label: 'മലയാളം' }]
const L = {
  en: { rasi: 'Rasi', amsam: 'Amsam', rasiChart: 'Rasi chart', amsamChart: 'Amsam (navamsa) chart', legend: 'La marks the lagna. (R) = vakra (retrograde).', vakra: '(R)', rasiName: (r) => r.en, graha: (g) => g.abbr },
  ml: { rasi: 'രാശി', amsam: 'നവാംശം', rasiChart: 'രാശിചക്രം', amsamChart: 'നവാംശകം', legend: 'ല = ലഗ്നം. (വ) = വക്രം.', vakra: '(വ)', rasiName: (r) => r.ml, graha: (g) => g.mlShort },
  ta: { rasi: 'ராசி', amsam: 'அம்சம்', rasiChart: 'ராசி கட்டம்', amsamChart: 'அம்சம் கட்டம்', legend: 'ல = லக்னம். (வ) = வக்கிரம்.', vakra: '(வ)', rasiName: (r) => r.ta, graha: (g) => g.short },
}

export function Disclaimer() {
  return (
    <div className="bc-disclaimer" role="note">
      <strong>ASTROLOGY IS NOT SCIENCE</strong>
      <p>
        This chart is not a fact and not a prediction of your future. It is calculated from the
        birth date, time and place you entered, using the astronomy-engine ephemeris, the Lahiri
        ayanamsa and Vimshottari dasa rules. Traditions differ, and your family astrologer may use
        other methods. Do not make marriage, health, money or legal decisions based on it.
      </p>
    </div>
  )
}

// One line by default, the full disclaimer a tap away.
export function DisclaimerLine() {
  const [open, setOpen] = useState(false)
  return (
    <div className="bc-disclaimer-line">
      <div className="bc-disclaimer-row">
        <span>Calculated, not a prediction.</span>
        <button type="button" className="bc-link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Show less' : 'Read more'}</button>
      </div>
      {open && <Disclaimer />}
    </div>
  )
}

export function RasiGrid({ title, caption, grahas, field, lang }) {
  const t = L[lang]
  const byRasi = Array.from({ length: 12 }, () => [])
  for (const g of grahas) byRasi[g[field]].push(g)
  return (
    <figure className="bc-grid" aria-label={title}>
      {RASIS.map((r, i) => (
        <div key={r.en} className="bc-cell" style={{ gridRow: CELL[i][0], gridColumn: CELL[i][1] }}>
          <span className="bc-sr">{`${r.en}: ${byRasi[i].length ? byRasi[i].map((g) => g.en + (g.vakra ? ' (retrograde)' : '')).join(', ') : 'empty'}`}</span>
          <span className="bc-cell-rasi" aria-hidden="true">{t.rasiName(r)}</span>
          <span className="bc-cell-grahas" aria-hidden="true">
            {byRasi[i].map((g) => <span key={g.key} className={g.key === 'Lagna' ? 'bc-lagna' : undefined}>{t.graha(g)}{g.vakra ? t.vakra : ''}</span>)}
          </span>
        </div>
      ))}
      <figcaption className="bc-grid-title">{caption}</figcaption>
    </figure>
  )
}

const ORD = (n) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`
const dayFmt = (ms, tz) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz })
const dayTimeFmt = (ms, tz) => new Date(ms).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: tz })
const isoFmt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

function NowCard({ chart, details, utc, timeline }) {
  const tz = details.place.tz
  const data = useMemo(() => {
    const nowMs = Date.now()
    const rasi = chart.star.rasi
    const period = currentPeriod(timeline, nowMs)
    const antaram = period ? antarams(period.bhukti).find((a) => nowMs >= a.start && nowMs < a.end) : null
    const birthMonth = birthPanchangam(utc, details.place, details.tradition).solar.month
    const sun = siderealLon('Sun', new Date(nowMs))
    const moon = siderealLon('Moon', new Date(nowMs))
    return {
      period, antaram, birthMonth,
      saturn: saturnNow(rasi, nowMs),
      jupiter: jupiterNow(rasi, nowMs),
      spells: chandrashtamam(rasi, nowMs),
      starBirthday: nextStarBirthday({ birthStar: chart.star.nakshatra, birthMonth, tradition: details.tradition, place: details.place }, nowMs),
      age: ageOn(details.date, localDate(new Date(nowMs), tz)),
      today: { tithi: tithiYogaKarana(sun, moon).tithi, star: NAKSHATRAS[Math.floor(moon / NAK_SPAN)].en },
    }
  }, [chart, details, utc, timeline, tz])
  const { period, antaram, saturn, jupiter, spells, starBirthday, age, today } = data
  const monthName = details.tradition === 'kerala' ? MALAYALAM_MONTHS[data.birthMonth] : TAMIL_MONTHS[data.birthMonth].en
  const change = saturn.signChange ? `Saturn changes sign on ${dayFmt(saturn.signChange, tz)}.` : ''
  const sat = saturn.kind === 'ezharai'
    ? { title: `Ezharai sani, phase ${saturn.phase} of 3 (${saturn.phaseName})`, sub: `From ${monthYear(saturn.start)} to about ${monthYear(saturn.end)}. ${change}` }
    : saturn.kind === 'ashtama'
      ? { title: 'Ashtama sani (Saturn in the 8th from your rasi)', sub: change }
      : saturn.kind === 'arthashtama'
        ? { title: 'Arthashtama sani (Saturn in the 4th from your rasi)', sub: change }
        : { title: `Saturn in the ${ORD(saturn.house)} from your rasi`, sub: change }

  return (
    <section className="card bc-nowcard" aria-labelledby="bc-now-h">
      <h2 className="card-h" id="bc-now-h">Now</h2>
      <dl className="bc-now-list">
        {period && (
          <div>
            <dt>Dasa</dt>
            <dd>
              <b>{GRAHA[period.md.lord].en} dasa, {GRAHA[period.bhukti.lord].en} bhukti{antaram ? `, ${GRAHA[antaram.lord].en} antaram` : ''}</b>
              <span>{antaram ? `Antaram until ${dayFmt(antaram.end, tz)}. ` : ''}Bhukti until {dayFmt(period.bhukti.end, tz)}. Dasa until {monthYear(period.md.end)}.</span>
            </dd>
          </div>
        )}
        <div><dt>Saturn</dt><dd><b>{sat.title}</b><span>{sat.sub}</span></dd></div>
        <div>
          <dt>Jupiter</dt>
          <dd><b>Guru in the {ORD(jupiter.house)} from your rasi</b><span>{jupiter.signChange ? `Changes sign on ${dayFmt(jupiter.signChange, tz)}.` : ''}</span></dd>
        </div>
        <div>
          <dt>Chandrashtamam</dt>
          <dd>
            <b>Moon in the 8th from your rasi</b>
            <ul className="bc-spells">
              {spells.map((x) => <li key={x.start}>{dayTimeFmt(x.start, tz)} to {dayTimeFmt(x.end, tz)}</li>)}
            </ul>
          </dd>
        </div>
        {starBirthday && (
          <div>
            <dt>Star birthday</dt>
            <dd><b>{isoFmt(starBirthday)}</b><span>{NAKSHATRAS[chart.star.nakshatra].en} in {monthName}, by the star {details.tradition === 'kerala' ? '6 nazhigai after sunrise' : 'at sunrise'} at {details.place.name}.</span></dd>
          </div>
        )}
        <div><dt>Age</dt><dd><b>{age.years} years {age.months} months</b></dd></div>
        <div><dt>Today</dt><dd><b>{today.tithi}, {today.star}</b><span>Tithi and star right now.</span></dd></div>
      </dl>
      <p className="greet-sub">Transits are counted from your birth rasi (Moon sign). These are traditional labels, not predictions.</p>
    </section>
  )
}

function ChartTab({ chart, lang, setLang, details, utc, timeline }) {
  const t = L[lang]
  return (
    <>
      <NowCard chart={chart} details={details} utc={utc} timeline={timeline} />
      <div className="bc-langs" role="group" aria-label="Label language">
        <span>Labels</span>
        {LANGS.map((l) => (
          <button key={l.id} type="button" className={`bc-lang ${lang === l.id ? 'on' : ''}`} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
        ))}
      </div>
      <div className="card">
        <h2 className="card-h">{t.rasiChart}</h2>
        <RasiGrid title="Rasi chart" caption={t.rasi} grahas={chart.grahas} field="rasi" lang={lang} />
      </div>
      <div className="card">
        <h2 className="card-h">{t.amsamChart}</h2>
        <RasiGrid title="Amsam chart" caption={t.amsam} grahas={chart.grahas} field="navamsa" lang={lang} />
        <div className="greet-sub bc-legend">{t.legend}</div>
      </div>
    </>
  )
}

const PAKSHA = { Shukla: 'Shukla (வளர்பிறை)', Krishna: 'Krishna (தேய்பிறை)' }
const PAKSHA_ML = { Shukla: 'Shukla (ശുക്ലപക്ഷം)', Krishna: 'Krishna (കൃഷ്ണപക്ഷം)' }
const clock = (d, tz) => (d ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: tz }) : '-')

function Rows({ title, rows }) {
  return (
    <div className="card">
      <h2 className="card-h">{title}</h2>
      <dl className="bc-rows">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </div>
  )
}

function PanchangamTab({ chart, details, utc }) {
  const p = useMemo(() => birthPanchangam(utc, details.place, details.tradition), [utc, details])
  const star = NAKSHATRAS[chart.star.nakshatra]
  const kerala = details.tradition === 'kerala'
  const both = bothFor(details.tradition)
  const tz = details.place.tz
  const day = [
    ['Weekday', both(WEEKDAYS[p.weekday])],
    kerala ? ['Kollam year', `ME ${p.kollamYear}`] : ['Tamil year', p.samvatsara],
    kerala
      ? ['Malayalam month, date', `${MALAYALAM_MONTHS[p.solar.month]} ${p.solar.day} (${RASIS[p.solar.month].ml} ${p.solar.day})`]
      : ['Tamil month, date', `${TAMIL_MONTHS[p.solar.month].en} ${p.solar.day} (${TAMIL_MONTHS[p.solar.month].ta} ${p.solar.day})`],
    ['Paksha', kerala ? PAKSHA_ML[p.paksha] : PAKSHA[p.paksha]],
    ['Tithi', p.tithi],
    ['Nakshatra', `${both(star)}, pada ${chart.star.pada}`],
    ['Yogam', p.yoga],
    ['Karanam', p.karana],
    ['Sunrise / sunset', `${clock(p.sunrise, tz)} / ${clock(p.sunset, tz)}`],
    ['Born after sunrise', p.nazhigai ? `${p.nazhigai.nazhigai} nazhigai ${p.nazhigai.vinadi} vinadi` : '-'],
    ['Ayanamsa (Lahiri)', formatDeg(chart.ayanamsa)],
  ]
  const lords = [
    ['Star lord', both(GRAHA[DASA_LORDS[chart.star.nakshatra % 9].key])],
    ['Rasi', both(RASIS[chart.star.rasi])],
    ['Rasi lord', both(GRAHA[RASI_LORDS[chart.star.rasi]])],
    ['Lagna', both(RASIS[chart.lagna])],
    ['Lagna lord', both(GRAHA[RASI_LORDS[chart.lagna]])],
  ]
  return (
    <>
      <Rows title="Birth-day panchangam" rows={day} />
      <Rows title="Star details" rows={lords} />
      <p className="greet-sub bc-note">
        {kerala ? 'Kerala tradition: a month starts on the sankranti day only if the Sun enters the sign before aparahna (3/5 of daylight).'
          : 'Tamil tradition: a month starts on the sankranti day only if the Sun enters the sign before sunset.'}
        {' '}The day runs sunrise to sunrise, so a birth before sunrise takes the previous day. 1 nazhigai = 24 minutes, 1 vinadi = 24 seconds.
      </p>
    </>
  )
}

const DIGNITY = { exalted: 'Exalted', debilitated: 'Debilitated', own: 'Own sign' }

function PlanetsTab({ chart, tradition }) {
  const native = nativeFor(tradition)
  return (
    <>
      <div className="card">
        <h2 className="card-h">Planets</h2>
        <div className="bc-table-wrap">
          <table className="bc-table">
            <thead><tr><th scope="col">Graha</th><th scope="col">Rasi</th><th scope="col">Degree</th><th scope="col">Star, pada</th><th scope="col">House</th></tr></thead>
            <tbody>
              {chart.grahas.map((g) => (
                <tr key={g.key}>
                  <th scope="row">
                    {g.en}<span className="bc-ta">{native(g)}</span>
                    {(g.vakra || g.dignity) && (
                      <span className="bc-badges">
                        {g.vakra && <span className="bc-badge bc-badge-vakra">Vakra</span>}
                        {g.dignity && <span className={`bc-badge bc-badge-${g.dignity}`}>{DIGNITY[g.dignity]}</span>}
                      </span>
                    )}
                  </th>
                  <td>{RASIS[g.rasi].en}</td>
                  <td className="bc-num">{formatDeg(g.degInRasi)}</td>
                  <td>{NAKSHATRAS[g.nakshatra].en}, {g.pada}</td>
                  <td className="bc-num">{g.house}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="greet-sub bc-note">Vakra = retrograde, from the planet's motion at birth. Exalted, debilitated and own sign follow the classical Parashari sign table. Rahu and Ketu use the mean node, as Tamil jathagams do.</p>
    </>
  )
}

function DasaTab({ timeline, utc, tz, tradition }) {
  const native = nativeFor(tradition)
  const nowMs = Date.now()
  const now = currentPeriod(timeline, nowMs)
  const [open, setOpen] = useState(() => new Set(now ? [now.md.start] : []))
  const toggle = (key) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const nowAntaram = now ? antarams(now.bhukti).find((a) => nowMs >= a.start && nowMs < a.end) : null
  return (
    <>
      {now && (
        <div className="bc-now-banner">
          <span className="bc-now-label">Now</span>
          <b>{GRAHA[now.md.lord].en} dasa, {GRAHA[now.bhukti.lord].en} bhukti</b>
          <span>{monthYear(Math.max(now.bhukti.start, utc.getTime()))} to {monthYear(now.bhukti.end)}</span>
        </div>
      )}
      <div className="card">
        <p className="bc-now">Dasa balance at birth: <b>{GRAHA[timeline.balance.lord].en} {formatYears(timeline.balance.years)}</b></p>
        <ol className="bc-dasas">
          {timeline.periods.map((p) => {
            const isNow = now?.md === p
            const isOpen = open.has(p.start)
            return (
              <li key={p.start} className={isNow ? 'on' : undefined}>
                <button type="button" className="bc-dasa-row" aria-expanded={isOpen} onClick={() => toggle(p.start)}>
                  <span>{GRAHA[p.lord].en}{isNow ? ' (now)' : ''} <span className="bc-ta">{native(GRAHA[p.lord])}</span></span>
                  <span className="bc-num">{monthYear(Math.max(p.start, utc.getTime()))} to {monthYear(p.end)} <span aria-hidden="true">{isOpen ? '-' : '+'}</span></span>
                </button>
                {isOpen && (
                  <ol className="bc-bhuktis" aria-label={`Bhuktis of ${GRAHA[p.lord].en} dasa`}>
                    {p.bhuktis.filter((b) => b.end > utc.getTime()).map((b) => {
                      const bNow = now?.bhukti === b
                      return (
                        <li key={b.start} className={bNow ? 'on' : undefined}>
                          <div className="bc-bhukti-row">
                            <span>{GRAHA[b.lord].en}{bNow ? ' (now)' : ''}</span>
                            <span className="bc-num">{monthYear(Math.max(b.start, utc.getTime()))} to {monthYear(b.end)}</span>
                          </div>
                          {bNow && (
                            <ol className="bc-antarams" aria-label={`Antarams of ${GRAHA[b.lord].en} bhukti`}>
                              {antarams(b).filter((a) => a.end > utc.getTime()).map((a) => (
                                <li key={a.start} className={nowAntaram && a.start === nowAntaram.start ? 'on' : undefined}>
                                  <span>{GRAHA[a.lord].en}</span>
                                  <span className="bc-num">{dayFmt(Math.max(a.start, utc.getTime()), tz)} to {dayFmt(a.end, tz)}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
        <div className="greet-sub">
          Tap a dasa for its bhuktis. Vimshottari, longitude method, 365.25-day years. Family jathagams often
          take the star's end time from a panchangam, so their dates can differ by a few months.
        </div>
      </div>
    </>
  )
}

export default function ChartView({ details }) {
  const utc = useMemo(() => toUtc(details), [details])
  const chart = useMemo(() => buildChart({ utc, lat: details.place.lat, lon: details.place.lon }), [utc, details])
  const timeline = useMemo(() => dasaTimeline(chart.moonLon, utc.getTime()), [chart, utc])
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'chart'
  const [lang, setLang] = useState(details.tradition === 'kerala' ? 'ml' : 'ta')
  const offsetUsed = details.offsetOverride || utcOffsetLabel(offsetAt(utc, details.place.tz)).slice(3)
  const star = NAKSHATRAS[chart.star.nakshatra]
  const name = (x) => (lang === 'en' ? x.en : x[lang])

  return (
    <>
      <div className="bc-head">
        <div className="bc-head-top">
          <h1 className="bc-head-name">{details.name}</h1>
          <Link to={`/birth-chart/${details.id}/edit`} className="bc-head-edit">Edit</Link>
        </div>
        <p className="bc-head-sub">
          {formatBirthDate(details.date)}, {details.hour12}:{String(details.minute).padStart(2, '0')} {details.ampm} - {details.place.name} (UTC{offsetUsed})
        </p>
        <div className="bc-chips-row">
          <span className="bc-chip">Star: <b>{name(star)} {chart.star.pada}</b></span>
          <span className="bc-chip">Rasi: <b>{name(RASIS[chart.star.rasi])}</b></span>
          <span className="bc-chip">Lagna: <b>{name(RASIS[chart.lagna])}</b></span>
        </div>
      </div>

      <DisclaimerLine />

      {chart.warnings.length > 0 && (
        <div className="bc-warning" role="status">
          <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />
          <div>
            {chart.warnings.includes('moon-edge') && <p>The Moon is close to the edge of a pada. A family jathagam made with a traditional panchangam may show the neighbouring pada or star. Check your paper jathagam.</p>}
            {chart.warnings.includes('lagna-edge') && <p>The lagna is close to the edge of a sign. A few minutes' difference in birth time changes it. Check your paper jathagam.</p>}
          </div>
        </div>
      )}

      <nav className="bc-tabs" aria-label="Chart sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`bc-tab ${tab === t.id ? 'on' : ''}`} aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setParams({ tab: t.id }, { replace: true })}>{t.label}</button>
        ))}
      </nav>

      {tab === 'chart' && <ChartTab chart={chart} lang={lang} setLang={setLang} details={details} utc={utc} timeline={timeline} />}
      {tab === 'panchangam' && <PanchangamTab chart={chart} details={details} utc={utc} />}
      {tab === 'planets' && <PlanetsTab chart={chart} tradition={details.tradition} />}
      {tab === 'dasa' && <DasaTab timeline={timeline} utc={utc} tz={details.place.tz} tradition={details.tradition} />}

      <p className="greet-sub bc-method">
        Method: drik positions from astronomy-engine, Lahiri (Chitrapaksha) ayanamsa, mean Rahu and Ketu,
        houses counted from the lagna sign. Places: {PLACES_ATTRIBUTION}.
      </p>
    </>
  )
}
