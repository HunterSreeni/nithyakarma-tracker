import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { track } from '../utils/analytics'
import { buildChart, RASIS, NAKSHATRAS, GRAHAS, formatDeg } from '../lib/jadhagam/chart'
import { dasaTimeline, currentPeriod, formatYears } from '../lib/jadhagam/dasa'
import { birthDetailsToUtc as toUtc, offsetAt, utcOffsetLabel } from '../lib/jadhagam/time'
import { searchPlaces, PLACES_ATTRIBUTION } from '../lib/jadhagam/places'
import { loadBirthDetails, saveBirthDetails, deleteBirthDetails } from '../lib/jadhagam/storage'

// Real-world UTC offsets run from -12:00 to +14:00.
const validOffset = (s) => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(s)
  if (!m || Number(m[3]) > 59) return false
  const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
  return minutes >= -720 && minutes <= 840
}
const GRAHA = Object.fromEntries(GRAHAS.map((g) => [g.key, g]))
const both = (x) => `${x.en} (${x.ta})`
const monthYear = (ms) => new Date(ms).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

// South Indian chart: the signs stay fixed round the edge, Meenam top-left.
// [row, column] on a 4x4 grid for Mesham..Meenam; the middle 2x2 holds the title.
const CELL = [[1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [3, 1], [2, 1], [1, 1]]

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

export function RasiGrid({ title, grahas, field }) {
  const byRasi = Array.from({ length: 12 }, () => [])
  for (const g of grahas) byRasi[g[field]].push(g)
  return (
    <figure className="bc-grid" aria-label={`${title} chart`}>
      {RASIS.map((r, i) => (
        <div key={r.en} className="bc-cell" style={{ gridRow: CELL[i][0], gridColumn: CELL[i][1] }}>
          <span className="bc-sr">{`${r.en}: ${byRasi[i].length ? byRasi[i].map((g) => g.en).join(', ') : 'empty'}`}</span>
          <span className="bc-cell-rasi" aria-hidden="true">{r.ta}</span>
          <span className="bc-cell-grahas" aria-hidden="true">
            {byRasi[i].map((g) => <span key={g.key} className={g.key === 'Lagna' ? 'bc-lagna' : undefined}>{g.short}</span>)}
          </span>
        </div>
      ))}
      <figcaption className="bc-grid-title">{title}</figcaption>
    </figure>
  )
}

function BirthForm({ initial, onSave, onCancel }) {
  const [date, setDate] = useState(initial?.date ?? '')
  const [hour, setHour] = useState(initial ? String(initial.hour12) : '')
  const [minute, setMinute] = useState(initial ? String(initial.minute).padStart(2, '0') : '')
  const [ampm, setAmpm] = useState(initial?.ampm ?? 'AM')
  const [query, setQuery] = useState(initial?.place?.name ?? '')
  const [place, setPlace] = useState(initial?.place ?? null)
  const [offset, setOffset] = useState(initial?.offsetOverride ?? '')
  const [error, setError] = useState(null)
  const results = useMemo(() => (place && query === place.name ? [] : searchPlaces(query)), [query, place])

  const submit = (e) => {
    e.preventDefault()
    const h = Number(hour), m = Number(minute)
    if (!date) return setError('Enter the date of birth.')
    if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(m) || m < 0 || m > 59 || minute === '') return setError('Enter the time as hour 1-12 and minutes 0-59.')
    if (!place) return setError('Pick the birth place from the list.')
    if (offset && !validOffset(offset)) return setError('Write the offset like +05:30 (between -12:00 and +14:00), or leave it empty.')
    setError(null)
    onSave({ date, hour12: h, minute: m, ampm, place, offsetOverride: offset || '' })
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2 className="card-h">Your birth details</h2>
      <label className="field-label" htmlFor="bc-date">Date of birth</label>
      <input id="bc-date" className="field-input" type="date" value={date} max="2100-12-31" min="1900-01-01" onChange={(e) => setDate(e.target.value)} />

      <label className="field-label" htmlFor="bc-hour">Time of birth</label>
      <div className="bc-time">
        <input id="bc-hour" className="field-input" inputMode="numeric" placeholder="hh" aria-label="Hour" value={hour} maxLength={2} onChange={(e) => setHour(e.target.value.replace(/\D/g, ''))} />
        <span aria-hidden="true">:</span>
        <input id="bc-minute" className="field-input" inputMode="numeric" placeholder="mm" aria-label="Minutes" value={minute} maxLength={2} onChange={(e) => setMinute(e.target.value.replace(/\D/g, ''))} />
        <div className="radio-row bc-ampm" role="group" aria-label="AM or PM">
          {['AM', 'PM'].map((v) => (
            <button key={v} type="button" className={`radio-chip ${ampm === v ? 'on' : ''}`} aria-pressed={ampm === v} onClick={() => setAmpm(v)}>{v}</button>
          ))}
        </div>
      </div>

      <label className="field-label" htmlFor="bc-place">Place of birth (India)</label>
      <input id="bc-place" className="field-input" autoComplete="off" placeholder="Start typing a town" value={query}
        onChange={(e) => { setQuery(e.target.value); setPlace(null) }} aria-describedby="bc-place-hint" />
      <div id="bc-place-hint" className="greet-sub">Births outside India are coming in a later update. Pick the nearest town if yours is not listed.</div>
      {results.length > 0 && (
        <ul className="bc-places" role="listbox" aria-label="Matching places">
          {results.map((p) => (
            <li key={`${p.name}-${p.lat}-${p.lon}`}>
              <button type="button" role="option" aria-selected="false" onClick={() => { setPlace(p); setQuery(p.name) }}>
                {p.name}<span className="greet-sub">{p.state}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="bc-advanced">
        <summary>My jathagam records a different time offset</summary>
        <label className="field-label" htmlFor="bc-offset">UTC offset, for example +05:30</label>
        <input id="bc-offset" className="field-input" placeholder="+05:30" value={offset} onChange={(e) => setOffset(e.target.value.trim())} />
      </details>

      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="bc-actions">
        <button type="submit" className="btn-primary">Show my chart</button>
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
      <p className="greet-sub bc-privacy">Saved only on this phone. Never sent to Nithyakarma or anyone else.</p>
    </form>
  )
}

function ChartView({ details, onEdit, onDelete }) {
  const utc = useMemo(() => toUtc(details), [details])
  const chart = useMemo(() => buildChart({ utc, lat: details.place.lat, lon: details.place.lon }), [utc, details])
  const timeline = useMemo(() => dasaTimeline(chart.moonLon, utc.getTime()), [chart, utc])
  const now = currentPeriod(timeline, Date.now())
  const [confirm, setConfirm] = useState(false)
  const offsetUsed = details.offsetOverride || utcOffsetLabel(offsetAt(utc, details.place.tz)).slice(3)
  const star = NAKSHATRAS[chart.star.nakshatra]

  return (
    <>
      <div className="card bc-summary">
        <h2 className="card-h">Summary</h2>
        <dl>
          <div><dt>Star</dt><dd>{both(star)}, pada {chart.star.pada}</dd></div>
          <div><dt>Rasi</dt><dd>{both(RASIS[chart.star.rasi])}</dd></div>
          <div><dt>Lagna</dt><dd>{both(RASIS[chart.lagna])}</dd></div>
          <div><dt>Dasa at birth</dt><dd>{GRAHA[timeline.balance.lord].en} {formatYears(timeline.balance.years)}</dd></div>
        </dl>
        <div className="greet-sub">
          Born {details.date} at {details.hour12}:{String(details.minute).padStart(2, '0')} {details.ampm}, {details.place.name} (UTC{offsetUsed})
        </div>
      </div>

      {chart.warnings.length > 0 && (
        <div className="bc-warning" role="status">
          <AlertTriangle size={16} strokeWidth={2.5} aria-hidden="true" />
          <div>
            {chart.warnings.includes('moon-edge') && <p>The Moon is close to the edge of a pada. A family jathagam made with a traditional panchangam may show the neighbouring pada or star. Check your paper jathagam.</p>}
            {chart.warnings.includes('lagna-edge') && <p>The lagna is close to the edge of a sign. A few minutes' difference in birth time changes it. Check your paper jathagam.</p>}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="card-h">Rasi and amsam charts</h2>
        <div className="bc-grids">
          <RasiGrid title="Rasi" grahas={chart.grahas} field="rasi" />
          <RasiGrid title="Amsam" grahas={chart.grahas} field="navamsa" />
        </div>
        <div className="greet-sub">ல marks the lagna. Planets use their short Tamil names.</div>
      </div>

      <div className="card">
        <h2 className="card-h">Planets</h2>
        <div className="bc-table-wrap">
          <table className="bc-table">
            <thead><tr><th scope="col">Graha</th><th scope="col">Rasi</th><th scope="col">Degree</th><th scope="col">Star, pada</th><th scope="col">House</th></tr></thead>
            <tbody>
              {chart.grahas.map((g) => (
                <tr key={g.key}>
                  <th scope="row">{g.en}<span className="bc-ta">{g.ta}</span></th>
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

      <div className="card">
        <h2 className="card-h">Dasa periods</h2>
        {now && (
          <p className="bc-now">
            Now: <b>{GRAHA[now.md.lord].en} dasa</b>, <b>{GRAHA[now.bhukti.lord].en} bhukti</b> ({monthYear(now.bhukti.start)} to {monthYear(now.bhukti.end)})
          </p>
        )}
        <ol className="bc-dasas">
          {timeline.periods.map((p) => {
            const isNow = now?.md === p
            return (
              <li key={p.start} className={isNow ? 'on' : undefined}>
                <div className="bc-dasa-row">
                  <span>{GRAHA[p.lord].en} <span className="bc-ta">{GRAHA[p.lord].ta}</span></span>
                  <span className="bc-num">{monthYear(Math.max(p.start, utc.getTime()))} to {monthYear(p.end)}</span>
                </div>
                {isNow && (
                  <ol className="bc-bhuktis" aria-label={`Bhuktis of ${GRAHA[p.lord].en} dasa`}>
                    {p.bhuktis.map((b) => (
                      <li key={b.start} className={now.bhukti === b ? 'on' : undefined}>
                        <span>{GRAHA[b.lord].en}</span>
                        <span className="bc-num">{monthYear(b.start)} to {monthYear(b.end)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ol>
        <div className="greet-sub">
          Vimshottari, longitude method, 365.25-day years. Family jathagams often take the star's end time
          from a panchangam, so their dates can differ by a few months.
        </div>
      </div>

      <div className="card">
        <h2 className="card-h">Your saved details</h2>
        <div className="bc-actions">
          <button type="button" className="btn-secondary" onClick={onEdit}>Edit birth details</button>
          {!confirm
            ? <button type="button" className="btn-secondary" onClick={() => setConfirm(true)}>Delete my birth details</button>
            : <button type="button" className="btn-danger" onClick={onDelete}>Yes, delete them from this phone</button>}
        </div>
      </div>

      <p className="greet-sub bc-method">
        Method: drik positions from astronomy-engine, Lahiri (Chitrapaksha) ayanamsa, mean Rahu and Ketu,
        houses counted from the lagna sign. Places: {PLACES_ATTRIBUTION}.
      </p>
    </>
  )
}

export default function BirthChartPage() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const userId = session.user.id
  const [details, setDetails] = useState(undefined) // undefined = loading
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let live = true
    loadBirthDetails(userId).then((d) => { if (live) setDetails(d) })
    return () => { live = false }
  }, [userId])

  // One view per visit, not one per edit.
  const tracked = useRef(false)
  useEffect(() => {
    if (details && !tracked.current) { tracked.current = true; track('birth_chart_viewed') }
  }, [details])

  const save = async (d) => {
    try { await saveBirthDetails(userId, d) } catch { /* still show the chart; it just will not be remembered */ }
    setDetails(d); setEditing(false)
  }
  const remove = async () => {
    try { await deleteBirthDetails(userId) } catch { /* nothing stored to remove */ }
    setDetails(null)
  }

  return (
    <div className="bc-page">
      <div className="legal-head">
        <button className="legal-back" onClick={() => navigate(-1)} aria-label="Go back"><ChevronLeft size={16} strokeWidth={2.5} /> Back</button>
      </div>
      <h1 className="legal-title">My birth chart <span className="bc-ta">ஜாதகம்</span></h1>
      <Disclaimer />
      {details === undefined ? null
        : !details || editing
          ? <BirthForm initial={details} onSave={save} onCancel={details ? () => setEditing(false) : null} />
          : <ChartView details={details} onEdit={() => setEditing(true)} onDelete={remove} />}
    </div>
  )
}
