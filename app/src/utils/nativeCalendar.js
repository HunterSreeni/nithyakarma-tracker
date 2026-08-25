// Pure helpers for the Calendar page (Intent 2.11). The unit the calendar
// steps through is the NATIVE month - Aavani, Chingam - not the Gregorian
// one, so a "month" here is derived from the panchangam_days rows themselves
// rather than from the JS Date month.
//
// Kept free of React and Supabase, same reasoning as observanceMatch.ts: the
// month-boundary arithmetic is the part worth testing, and it is testable
// only if it doesn't need a client.
import { addDays } from '../../supabase/functions/_shared/observanceMatch.ts'

export const TRADITIONS = {
  tamil: { monthField: 'tamil_month', dayField: 'tamil_day' },
  malayalam: { monthField: 'malayalam_month', dayField: 'malayalam_day' },
}

// profile.panchangam_tradition, defaulting the way PanchangamBox does.
export function traditionOf(profile) {
  return profile?.panchangam_tradition === 'malayalam' ? 'malayalam' : 'tamil'
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000)
}

// Sunday-anchored, matching the weekday header order the grid renders.
export function weekStartOf(date) {
  return addDays(date, -new Date(`${date}T00:00:00Z`).getUTCDay())
}

export function weekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// Groups loaded rows into the native months they belong to, in date order.
//
// startDate is projected backwards from the first loaded row's native day
// rather than read from a row, so a month whose opening days were never
// loaded still reports its real first date - that projection is what lets the
// grid render "day 1 to 26 are missing" instead of silently starting the
// month at day 27.
//
// dayCount is only knowable when the following month is also in the window
// (its start is this month's end + 1). For the last group there is nothing to
// measure against, so it falls back to the highest native day actually seen,
// which under-reports rather than inventing days that may not exist.
export function groupNativeMonths(rows, tradition) {
  const { monthField, dayField } = TRADITIONS[tradition]
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date))

  const groups = []
  for (const row of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.name === row[monthField]) last.rows.push(row)
    else groups.push({ name: row[monthField], rows: [row] })
  }

  return groups.map((group, index) => {
    const first = group.rows[0]
    const startDate = addDays(first.date, -(first[dayField] - 1))
    const next = groups[index + 1]
    const nextFirst = next?.rows[0]
    const dayCount = nextFirst
      ? daysBetween(startDate, addDays(nextFirst.date, -(nextFirst[dayField] - 1)))
      : group.rows[group.rows.length - 1][dayField]
    return {
      name: group.name,
      startDate,
      dayCount,
      rowsByDate: new Map(group.rows.map(row => [row.date, row])),
    }
  })
}

export function monthIndexContaining(months, date) {
  return months.findIndex(m => date >= m.startDate && date <= addDays(m.startDate, m.dayCount - 1))
}

// One entry per day of the native month, loaded or not. A missing row is a
// normal, silent case (the same convention usePanchangam follows) - the cell
// renders empty rather than erroring.
export function monthCells(month, tradition) {
  const { dayField } = TRADITIONS[tradition]
  return Array.from({ length: month.dayCount }, (_, i) => {
    const date = addDays(month.startDate, i)
    const row = month.rowsByDate.get(date) ?? null
    return { date, nativeDay: row ? row[dayField] : i + 1, row }
  })
}

// The fetch window is quantised into fixed buckets rather than recentred on
// whatever date the user is looking at. Recentring per date gave every arrow
// press a new query key, which blanked the page to a spinner on each step.
// Any anchor inside a bucket produces the same window, so stepping through a
// month is one fetch, and the window still extends WINDOW_DAYS past the
// bucket on both sides so a month's neighbours are always present.
export const BUCKET_DAYS = 31

export function windowFor(anchor, windowDays) {
  const epochDay = Math.floor(Date.parse(`${anchor}T00:00:00Z`) / 86400000)
  const bucketStart = addDays('1970-01-01', Math.floor(epochDay / BUCKET_DAYS) * BUCKET_DAYS)
  return {
    from: addDays(bucketStart, -windowDays),
    to: addDays(bucketStart, BUCKET_DAYS + windowDays),
  }
}

export { addDays }
