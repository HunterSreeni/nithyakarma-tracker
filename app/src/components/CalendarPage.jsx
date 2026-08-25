import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { withDeadline, unwrap } from '../lib/queryClient'
import { useAuth } from '../hooks/useAuth'
import { localDateString } from '../utils/cadence'
import ErrorBanner from './ErrorBanner'
import { friendlyError } from '../utils/friendlyError'
import {
  addDays, groupNativeMonths, monthCells, monthIndexContaining,
  traditionOf, TRADITIONS, weekDates, weekStartOf, windowFor,
} from '../utils/nativeCalendar'
import { matchingRules } from '../../supabase/functions/_shared/observanceMatch.ts'
import {
  TAMIL_MONTH_SCRIPT, MALAYALAM_MONTH_SCRIPT,
  TAMIL_NAKSHATRA_SCRIPT, MALAYALAM_NAKSHATRA_SCRIPT,
  TAMIL_SAMVATSARA_SCRIPT, TAMIL_KALAM_SCRIPT, MALAYALAM_KALAM_SCRIPT,
  TAMIL_WEEKDAY_SCRIPT, MALAYALAM_WEEKDAY_SCRIPT,
  TAMIL_WEEKDAY_SHORT, MALAYALAM_WEEKDAY_SHORT,
  tamilThithi, malayalamThithi, kollavarshamLabel,
} from '../utils/panchangamScript'

// Calendar page (Intent 2.11) - replaces the Referrals tab, which moved wholly
// into the Profile page's invite card.
//
// The month this page steps through is the NATIVE month (Aavani, Chingam),
// not the Gregorian one, so a month spans two Gregorian months and the fetch
// is a date range rather than a month filter. WINDOW_DAYS is sized so the
// anchor's whole native month plus both neighbours are always in one fetch:
// a native month runs at most ~32 days, so 62 covers the anchor's month from
// either end plus enough of the next to know where it starts (which is how
// nativeCalendar derives a month's length).
const WINDOW_DAYS = 62

const KALAMS = [
  { key: 'rahu', english: 'Rahu Kalam', start: 'rahu_kalam_start', end: 'rahu_kalam_end' },
  { key: 'yamagandam', english: 'Yamagandam', start: 'yamagandam_start', end: 'yamagandam_end' },
  { key: 'gulika', english: 'Gulika Kalam', start: 'gulika_kalam_start', end: 'gulika_kalam_end' },
]

const VIEWS = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
]

const SCRIPT = {
  tamil: {
    month: TAMIL_MONTH_SCRIPT, nakshatra: TAMIL_NAKSHATRA_SCRIPT,
    kalam: TAMIL_KALAM_SCRIPT, weekday: TAMIL_WEEKDAY_SCRIPT,
    weekdayShort: TAMIL_WEEKDAY_SHORT, thithi: tamilThithi,
  },
  malayalam: {
    month: MALAYALAM_MONTH_SCRIPT, nakshatra: MALAYALAM_NAKSHATRA_SCRIPT,
    kalam: MALAYALAM_KALAM_SCRIPT, weekday: MALAYALAM_WEEKDAY_SCRIPT,
    weekdayShort: MALAYALAM_WEEKDAY_SHORT, thithi: malayalamThithi,
  },
}

const gregShort = (date) => new Date(`${date}T00:00:00Z`)
  .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const gregLong = (date) => new Date(`${date}T00:00:00Z`)
  .toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const gregDayOfMonth = (date) => Number(date.slice(8, 10))
const weekdayIndex = (date) => new Date(`${date}T00:00:00Z`).getUTCDay()

// Kerala counts the Kollavarsham, Tamil Nadu names the year from the 60-year
// samvatsara cycle - different facts, not a translation pair, same as the
// Today box treats them.
function yearLabel(tradition, row) {
  if (!row) return null
  if (tradition === 'malayalam') return kollavarshamLabel(row.kollavarsham_year) ?? row.varsham_name
  const native = TAMIL_SAMVATSARA_SCRIPT[row.varsham_name]
  return native ? `${native} வருடம்` : row.varsham_name
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const tradition = traditionOf(profile)
  const script = SCRIPT[tradition]
  const today = localDateString()

  const [view, setView] = useState('day')
  const [selected, setSelected] = useState(today)
  const [weekStart, setWeekStart] = useState(() => weekStartOf(today))

  // Anchored on whichever date the user is looking at, quantised so that
  // stepping within a month reuses one fetch (see windowFor) and only crossing
  // a bucket boundary goes back to the network.
  const anchor = view === 'week' ? weekStart : selected
  const { from, to } = windowFor(anchor, WINDOW_DAYS)

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['panchangam-window', from, to],
    queryFn: async () => {
      const [daysResult, rulesResult] = await withDeadline(Promise.all([
        supabase.from('panchangam_days').select('*').gte('date', from).lte('date', to).order('date'),
        supabase.from('panchangam_observances').select('*'),
      ]), 'Calendar panchangam')
      return { rows: unwrap(daysResult) ?? [], rules: unwrap(rulesResult) ?? [] }
    },
    // A month of panchangam never changes once published, so a revisit should
    // paint from cache rather than re-fetch and flash.
    staleTime: 60 * 60_000,
    // Crossing a bucket boundary keeps the previous window on screen while the
    // next one loads, rather than dropping back to the page-level spinner.
    placeholderData: keepPreviousData,
  })

  const rows = data?.rows
  const rules = data?.rules

  const byDate = useMemo(() => new Map((rows ?? []).map(row => [row.date, row])), [rows])
  const months = useMemo(() => groupNativeMonths(rows ?? [], tradition), [rows, tradition])

  // Same matcher the reminder edge function and the Today banner use, so the
  // calendar cannot drift from what the notifications actually fire on.
  const observancesFor = useMemo(() => (date) => matchingRules({
    [-1]: byDate.get(addDays(date, -1)),
    0: byDate.get(date),
    1: byDate.get(addDays(date, 1)),
  }, rules ?? []), [byDate, rules])

  if (isPending) return <div className="spinner-wrap">Loading...</div>
  if (error) {
    return (
      <>
        <CalendarHeading />
        <ErrorBanner message={friendlyError(error)} onRetry={refetch} />
      </>
    )
  }

  const shared = { tradition, script, today, byDate, months, observancesFor }
  return (
    <>
      <CalendarHeading />
      {view === 'day' && (
        <DayView {...shared} selected={selected} onSelect={setSelected}
          onSwitchView={setView} view={view} />
      )}
      {view === 'week' && (
        <WeekView {...shared} weekStart={weekStart} onWeekStart={setWeekStart}
          onSwitchView={setView} view={view} />
      )}
      {view === 'month' && (
        <MonthView {...shared} selected={selected} onSelect={setSelected}
          onOpenDay={(date) => { setSelected(date); setView('day') }}
          onSwitchView={setView} view={view} />
      )}
    </>
  )
}

function CalendarHeading() {
  return <h1 className="greet cal-page-h">Panchangam</h1>
}

function CalHeader({ native, roman, onStep, canPrev, canNext, view, onSwitchView }) {
  return (
    <>
      <div className="cal-head">
        <div className="cal-title">
          <div className="cal-native">{native}</div>
          <div className="cal-roman">{roman}</div>
        </div>
        <div className="cal-stepper">
          <button type="button" className="cal-step" onClick={() => onStep(-1)}
            disabled={!canPrev} aria-label="Previous">
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <button type="button" className="cal-step" onClick={() => onStep(1)}
            disabled={!canNext} aria-label="Next">
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div className="cal-viewseg" role="group" aria-label="Calendar view">
        {VIEWS.map(v => (
          <button key={v.key} type="button" onClick={() => onSwitchView(v.key)}
            aria-pressed={view === v.key}>{v.label}</button>
        ))}
      </div>
    </>
  )
}

// A date with no panchangam_days row is a normal, silent case, not an error -
// the dataset is generated a year at a time, so the far edge of any window is
// simply not loaded yet.
function NotLoaded({ title, children }) {
  return (
    <div className="cal-notloaded">
      <div className="cal-nl-title">{title}</div>
      <div className="cal-nl-sub">{children}</div>
    </div>
  )
}

function ObservanceChips({ matches }) {
  if (matches.length === 0) return null
  return (
    <div className="card cal-card">
      <h2 className="cal-card-h">Observances</h2>
      <div className="cal-chips">
        {matches.map(match => (
          <span key={match.key} className={`cal-chip ${match.category === 'tharpanam' ? 'tharpanam' : ''}`}>
            <i className="cal-chip-dot" />{match.title}
          </span>
        ))}
      </div>
    </div>
  )
}

function DayView({ tradition, script, byDate, months, observancesFor, selected, onSelect, view, onSwitchView }) {
  const { dayField } = TRADITIONS[tradition]
  const row = byDate.get(selected)
  const first = months[0]
  const last = months[months.length - 1]
  const canPrev = !!first && selected > first.startDate
  const canNext = !!last && selected < addDays(last.startDate, last.dayCount - 1)
  const step = (n) => onSelect(addDays(selected, n))

  if (!row) {
    return (
      <>
        <CalHeader native={gregShort(selected)} roman="Not loaded" onStep={step}
          canPrev={canPrev} canNext={canNext} view={view} onSwitchView={onSwitchView} />
        <NotLoaded title="Panchangam not loaded yet">
          There is no panchangam for {gregLong(selected)} yet. It appears here once
          that year's panchangam is generated.
        </NotLoaded>
      </>
    )
  }

  const monthName = row[TRADITIONS[tradition].monthField]
  const nativeMonth = script.month[monthName] ?? monthName
  const nativeThithi = script.thithi(row.thithi) ?? row.thithi
  const nativeNakshatra = script.nakshatra[row.nakshatra] ?? row.nakshatra
  const year = yearLabel(tradition, row)

  return (
    <>
      <CalHeader native={`${nativeMonth} ${row[dayField]}`} roman={`${monthName} ${row[dayField]}`}
        onStep={step} canPrev={canPrev} canNext={canNext} view={view} onSwitchView={onSwitchView} />

      <div className="cal-hero">
        <div className="cal-hero-day">
          <span className="cal-hero-num">{row[dayField]}</span>
          <span className="cal-hero-month">{nativeMonth}</span>
        </div>
        {year && <div className="cal-hero-year">{year}</div>}
        <div className="cal-hero-greg">{gregLong(selected)}</div>
      </div>

      <ObservanceChips matches={observancesFor(selected)} />

      <div className="card cal-card">
        <h2 className="cal-card-h">Panchangam</h2>
        <div className="cal-kv">
          <span className="cal-kv-k">Thithi</span>
          <span className="cal-kv-v">{nativeThithi}<small>{row.thithi}</small></span>
        </div>
        <div className="cal-kv">
          <span className="cal-kv-k">Nakshatram</span>
          <span className="cal-kv-v">{nativeNakshatra}<small>{row.nakshatra}</small></span>
        </div>
        {year && (
          <div className="cal-kv">
            <span className="cal-kv-k">Varsham</span>
            <span className="cal-kv-v">{year}<small>{row.varsham_name}</small></span>
          </div>
        )}
      </div>

      <div className="card cal-card">
        <h2 className="cal-card-h">Kalams to avoid</h2>
        {KALAMS.map(({ key, english, start, end }) => (
          <div className="cal-kalam" key={key}>
            <span className="cal-kalam-native">{script.kalam[key]}</span>
            <span className="cal-kalam-name">{english}</span>
            <span className="cal-kalam-time">{row[start]}-{row[end]}</span>
          </div>
        ))}
        <div className="cal-ist">Times shown in IST</div>
      </div>
    </>
  )
}

function WeekView({ tradition, script, today, byDate, months, observancesFor, weekStart, onWeekStart, view, onSwitchView }) {
  const { monthField, dayField } = TRADITIONS[tradition]
  const dates = weekDates(weekStart)
  const loaded = dates.filter(date => byDate.has(date))
  const first = months[0]
  const last = months[months.length - 1]
  const canPrev = !!first && weekStart > weekStartOf(first.startDate)
  const canNext = !!last && weekStart < weekStartOf(addDays(last.startDate, last.dayCount - 1))

  const anchorRow = loaded.length ? byDate.get(loaded[0]) : null
  const lastRow = loaded.length ? byDate.get(loaded[loaded.length - 1]) : null
  const native = anchorRow
    ? `${script.month[anchorRow[monthField]] ?? anchorRow[monthField]} ${anchorRow[dayField]} - ${lastRow[dayField]}`
    : gregShort(weekStart)

  return (
    <>
      <CalHeader native={native} roman={`${gregShort(dates[0])} - ${gregShort(dates[6])}`}
        onStep={(n) => onWeekStart(addDays(weekStart, n * 7))}
        canPrev={canPrev} canNext={canNext} view={view} onSwitchView={onSwitchView} />

      {dates.map(date => {
        const row = byDate.get(date)
        const weekday = script.weekday[weekdayIndex(date)]
        if (!row) {
          return (
            <div className="cal-wk-row empty" key={date}>
              <div className="cal-wk-date">
                <div className="cal-wk-wd">{weekday}</div>
                <div className="cal-wk-nd">-</div>
                <div className="cal-wk-greg">{gregShort(date)}</div>
              </div>
              <div className="cal-wk-body"><div className="cal-wk-none">Panchangam not loaded yet</div></div>
            </div>
          )
        }
        return (
          <div className={`cal-wk-row ${date === today ? 'today' : ''}`} key={date}>
            <div className="cal-wk-date">
              <div className="cal-wk-wd">{weekday}</div>
              <div className="cal-wk-nd">{row[dayField]}</div>
              <div className="cal-wk-greg">{gregShort(date)}</div>
            </div>
            <div className="cal-wk-body">
              <div className="cal-wk-thithi">{script.thithi(row.thithi) ?? row.thithi}</div>
              <div className="cal-wk-nak">{script.nakshatra[row.nakshatra] ?? row.nakshatra}</div>
              {observancesFor(date).map(match => (
                <span key={match.key} className={`cal-wk-obs ${match.category === 'tharpanam' ? 'tharpanam' : ''}`}>
                  {match.title}
                </span>
              ))}
            </div>
          </div>
        )
      })}

      {loaded.length < 7 && (
        <NotLoaded title="Panchangam not loaded yet">
          {7 - loaded.length} of these days have no panchangam yet.
        </NotLoaded>
      )}
    </>
  )
}

function MonthView({ tradition, script, today, months, observancesFor, selected, onSelect, onOpenDay, view, onSwitchView }) {
  const { dayField } = TRADITIONS[tradition]
  const found = monthIndexContaining(months, selected)
  const index = found === -1 ? months.length - 1 : found
  const month = months[index]

  if (!month) {
    return (
      <>
        <CalHeader native="Panchangam" roman="Not loaded" onStep={() => {}}
          canPrev={false} canNext={false} view={view} onSwitchView={onSwitchView} />
        <NotLoaded title="Panchangam not loaded yet">
          No panchangam has been loaded for these dates yet.
        </NotLoaded>
      </>
    )
  }

  const cells = monthCells(month, tradition)
  const missing = cells.filter(cell => !cell.row).length
  const nativeMonth = script.month[month.name] ?? month.name
  const year = yearLabel(tradition, cells.find(cell => cell.row)?.row)
  const lead = weekdayIndex(month.startDate)

  return (
    <>
      <CalHeader native={year ? `${nativeMonth} (${year})` : nativeMonth}
        roman={`${month.name} - ${gregShort(month.startDate)} to ${gregShort(addDays(month.startDate, month.dayCount - 1))}`}
        onStep={(n) => onSelect(months[index + n].startDate)}
        canPrev={index > 0} canNext={index < months.length - 1}
        view={view} onSwitchView={onSwitchView} />

      <div className="cal-grid-head">
        {script.weekdayShort.map((day, i) => (
          <div className={`cal-gh ${i === 0 ? 'sun' : ''}`} key={day}
            aria-label={script.weekday[i]}>{day}</div>
        ))}
      </div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => <div className="cal-cell blank" key={`blank-${i}`} />)}
        {cells.map(cell => {
          if (!cell.row) {
            return (
              <div className="cal-cell empty" key={cell.date}
                aria-label={`${month.name} ${cell.nativeDay}, ${gregShort(cell.date)}, panchangam not loaded`}>
                <span className="cal-cell-nd">{cell.nativeDay}</span>
                <span className="cal-cell-gd">{gregDayOfMonth(cell.date)}</span>
                <span className="cal-cell-marks" />
              </div>
            )
          }
          const matches = observancesFor(cell.date)
          return (
            <button type="button" key={cell.date} onClick={() => onOpenDay(cell.date)}
              aria-label={`${month.name} ${cell.nativeDay}, ${gregShort(cell.date)}`}
              className={`cal-cell ${cell.date === today ? 'today' : ''} ${cell.date === selected && cell.date !== today ? 'sel' : ''}`}>
              <span className="cal-cell-nd">{cell.nativeDay}</span>
              <span className="cal-cell-gd">{gregDayOfMonth(cell.date)}</span>
              <span className="cal-cell-marks">
                {matches.some(m => m.category === 'observance') && <i className="cal-m obs" />}
                {matches.some(m => m.category === 'tharpanam') && <i className="cal-m thar" />}
              </span>
            </button>
          )
        })}
      </div>

      <div className="cal-legend">
        <span className="cal-lg"><i className="cal-m obs" />Observance</span>
        <span className="cal-lg"><i className="cal-m thar" />Tharpanam</span>
      </div>

      {missing > 0 && (
        <NotLoaded title="Panchangam not loaded yet">
          {missing} of {month.dayCount} days in {month.name} have no panchangam yet, so they show empty.
        </NotLoaded>
      )}
      {missing === 0 && index === months.length - 1 && (
        <NotLoaded title="End of the loaded panchangam">
          {month.name} is the last month with data. The next month appears here once
          its panchangam is generated.
        </NotLoaded>
      )}

      <MonthObservances cells={cells} dayField={dayField} observancesFor={observancesFor} monthName={month.name} />
    </>
  )
}

function MonthObservances({ cells, dayField, observancesFor, monthName }) {
  const withMatches = cells
    .filter(cell => cell.row)
    .map(cell => ({ cell, matches: observancesFor(cell.date) }))
    .filter(entry => entry.matches.length > 0)
  if (withMatches.length === 0) return null

  return (
    <div className="card cal-card">
      <h2 className="cal-card-h">{monthName} observances</h2>
      {withMatches.map(({ cell, matches }) => (
        <div className="cal-obs-row" key={cell.date}>
          <div className="cal-obs-day">{cell.row[dayField]}</div>
          <div>
            <div className="cal-obs-title">{matches.map(m => m.title).join(', ')}</div>
            <div className="cal-obs-sub">{gregShort(cell.date)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
