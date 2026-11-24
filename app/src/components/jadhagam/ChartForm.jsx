import { useMemo, useState } from 'react'
import { searchPlaces, traditionForPlace } from '../../lib/jadhagam/places'

// Real-world UTC offsets run from -12:00 to +14:00.
const validOffset = (s) => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(s)
  if (!m || Number(m[3]) > 59) return false
  const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
  return minutes >= -720 && minutes <= 840
}

const TRADITIONS = [{ id: 'tamil', label: 'Tamil' }, { id: 'kerala', label: 'Kerala (Malayalam)' }]

// initial: the chart being edited, or null for a new one (defaultWhose preselects 'self' or 'other').
// whose: 'self' | 'other' | a family_members id.
export default function ChartForm({ initial, defaultWhose = 'self', selfName, familyMembers, onSave, onCancel, onDelete }) {
  const [whose, setWhose] = useState(initial ? (initial.familyMemberId ?? initial.relation) : defaultWhose)
  const [name, setName] = useState(initial?.name ?? (defaultWhose === 'self' ? selfName ?? '' : ''))
  const [date, setDate] = useState(initial?.date ?? '')
  const [hour, setHour] = useState(initial ? String(initial.hour12) : '')
  const [minute, setMinute] = useState(initial ? String(initial.minute).padStart(2, '0') : '')
  const [ampm, setAmpm] = useState(initial?.ampm ?? 'AM')
  const [query, setQuery] = useState(initial?.place?.name ?? '')
  const [place, setPlace] = useState(initial?.place ?? null)
  const [tradition, setTradition] = useState(initial?.tradition ?? 'tamil')
  // AI-DEV NOTE: picking a place suggests its tradition only until the user picks
  // one themselves - a Kerala family born in Chennai keeps a Kerala jathakam.
  const [traditionPicked, setTraditionPicked] = useState(!!initial)
  const [offset, setOffset] = useState(initial?.offsetOverride ?? '')
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const results = useMemo(() => (place && query === place.name ? [] : searchPlaces(query)), [query, place])

  const pickWhose = (value, presetName) => {
    setWhose(value)
    if (presetName !== undefined) setName(presetName)
  }

  const pickPlace = (p) => {
    setPlace(p); setQuery(p.name)
    if (!traditionPicked) setTradition(traditionForPlace(p))
  }

  const submit = (e) => {
    e.preventDefault()
    const h = Number(hour), m = Number(minute)
    if (!name.trim()) return setError('Enter a name for this chart.')
    if (!date) return setError('Enter the date of birth.')
    if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(m) || m < 0 || m > 59 || minute === '') return setError('Enter the time as hour 1-12 and minutes 0-59.')
    if (!place) return setError('Pick the birth place from the list.')
    if (offset && !validOffset(offset)) return setError('Write the offset like +05:30 (between -12:00 and +14:00), or leave it empty.')
    setError(null)
    const isFamily = whose !== 'self' && whose !== 'other'
    onSave({
      ...(initial ?? {}),
      name: name.trim(),
      relation: isFamily ? 'family' : whose,
      familyMemberId: isFamily ? whose : null,
      tradition, date, hour12: h, minute: m, ampm, place, offsetOverride: offset || '',
    })
  }

  const chip = (on) => `radio-chip ${on ? 'on' : ''}`

  return (
    <form onSubmit={submit} noValidate>
      <div className="card">
        <label className="field-label" htmlFor="bc-name">Name</label>
        <input id="bc-name" className="field-input" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />

        <span className="field-label" id="bc-whose">Whose chart</span>
        <div className="radio-row bc-chips" role="group" aria-labelledby="bc-whose">
          <button type="button" className={chip(whose === 'self')} aria-pressed={whose === 'self'} onClick={() => pickWhose('self', selfName ?? '')}>Me</button>
          {familyMembers.map((f) => (
            <button key={f.id} type="button" className={chip(whose === f.id)} aria-pressed={whose === f.id} onClick={() => pickWhose(f.id, f.name)}>{f.name}</button>
          ))}
          <button type="button" className={chip(whose === 'other')} aria-pressed={whose === 'other'} onClick={() => pickWhose('other', '')}>Someone else</button>
        </div>
        {whose === 'other' && <p className="greet-sub">Only add someone else's birth details with their permission.</p>}
      </div>

      <div className="card">
        <label className="field-label" htmlFor="bc-date">Date of birth</label>
        {/* AI-DEV NOTE: the wrapper carries the field's padding and border, not the
            input - see the bc-date-field note in index.css (iOS WebKit bug 301648). */}
        <div className="field-input bc-date-field">
          <input id="bc-date" type="date" value={date} max="2100-12-31" min="1900-01-01" onChange={(e) => setDate(e.target.value)} />
        </div>

        <label className="field-label" htmlFor="bc-hour">Time of birth</label>
        <div className="bc-time">
          <input id="bc-hour" className="field-input" inputMode="numeric" placeholder="hh" aria-label="Hour" value={hour} maxLength={2} onChange={(e) => setHour(e.target.value.replace(/\D/g, ''))} />
          <span aria-hidden="true">:</span>
          <input id="bc-minute" className="field-input" inputMode="numeric" placeholder="mm" aria-label="Minutes" value={minute} maxLength={2} onChange={(e) => setMinute(e.target.value.replace(/\D/g, ''))} />
          <div className="radio-row bc-ampm" role="group" aria-label="AM or PM">
            {['AM', 'PM'].map((v) => (
              <button key={v} type="button" className={chip(ampm === v)} aria-pressed={ampm === v} onClick={() => setAmpm(v)}>{v}</button>
            ))}
          </div>
        </div>

        <label className="field-label" htmlFor="bc-place">Place of birth (India)</label>
        <input id="bc-place" className="field-input" autoComplete="off" placeholder="Start typing a town" value={query}
          onChange={(e) => { setQuery(e.target.value); setPlace(null) }} aria-describedby="bc-place-hint" />
        <div id="bc-place-hint" className="greet-sub">
          {place ? `${place.state} - ${place.lat.toFixed(2)} N, ${place.lon.toFixed(2)} E` : 'Births outside India are coming in a later update. Pick the nearest town if yours is not listed.'}
        </div>
        {results.length > 0 && (
          <ul className="bc-places" role="listbox" aria-label="Matching places">
            {results.map((p) => (
              <li key={`${p.name}-${p.lat}-${p.lon}`}>
                <button type="button" role="option" aria-selected="false" onClick={() => pickPlace(p)}>
                  {p.name}<span className="greet-sub">{p.state}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <span className="field-label" id="bc-tradition">Calendar tradition</span>
        <div className="radio-row bc-chips" role="group" aria-labelledby="bc-tradition">
          {TRADITIONS.map((t) => (
            <button key={t.id} type="button" className={chip(tradition === t.id)} aria-pressed={tradition === t.id}
              onClick={() => { setTradition(t.id); setTraditionPicked(true) }}>{t.label}</button>
          ))}
        </div>
        <p className="greet-sub">Decides the month and date shown (Tamil month or Kollam month). Suggested from the birth place; change it if your family follows the other.</p>

        <details className="bc-advanced">
          <summary>My paper jathagam records a different time offset</summary>
          <label className="field-label" htmlFor="bc-offset">UTC offset, for example +05:30</label>
          <input id="bc-offset" className="field-input" placeholder="+05:30" value={offset} onChange={(e) => setOffset(e.target.value.trim())} />
        </details>
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="bc-actions">
        <button type="submit" className="btn-primary">{initial ? 'Save chart' : 'Make chart'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
      <p className="greet-sub bc-privacy">Saved only on this phone. Never sent to Nithyakarma or anyone else.</p>

      {onDelete && (
        <div className="bc-actions bc-delete">
          {!confirmDelete
            ? <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(true)}>Delete this chart</button>
            : <button type="button" className="btn-danger" onClick={onDelete}>Yes, delete it from this phone</button>}
        </div>
      )}
    </form>
  )
}
