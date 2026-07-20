// Pure cadence logic shared by Today page, notifications, and tests.

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Is this practice scheduled on the given date? Weekly practices only appear
// on their weekday and never break streaks on off-days.
export function isScheduled(practice, date = new Date()) {
  if (practice.cadence === 'weekly') return date.getDay() === practice.weekday
  return true
}

export function cadenceLabel(practice) {
  switch (practice.cadence) {
    case 'weekly': return `${WEEKDAYS[practice.weekday]}s`
    case 'daily_count': return `daily ${practice.target_count}`
    case 'sequence':
      return practice.sequence_length ? `1 of ${practice.sequence_length} / day` : 'daily reading'
    default: return practice.is_sandhyavandhanam ? '3 sandhyas daily' : 'daily'
  }
}

export const SANDHYA_SLOTS = [
  { key: 'morning', label: 'Prathakala', short: 'Morning' },
  { key: 'afternoon', label: 'Madhyanika', short: 'Noon' },
  { key: 'evening', label: 'Saayamkala', short: 'Evening' },
]

// Done-state for a practice given today's logs for it. "Has this been logged
// today at all" - used for the per-practice tick on the Today page. NOT the
// same question as day completion; see below.
export function isDoneToday(practice, logs) {
  if (practice.is_sandhyavandhanam) {
    const slots = new Set(logs.map(l => l.slot))
    return SANDHYA_SLOTS.every(s => slots.has(s.key))
  }
  return logs.length > 0
}

// Mirrors the per-practice branch of the day-completion bool_and inside the SQL
// submit_practice_log. The difference from isDoneToday is the counts_toward_streak
// filter: a Learning-page log is written with counts_toward_streak = false, so it
// is a real log (isDoneToday true) that does not advance the streak (this false).
// Using isDoneToday for the day counter made the UI claim a day was complete while
// the server disagreed. See utils/__tests__/logic-mirrors.test.js.
export function countsTowardDayCompletion(practice, logs) {
  return isDoneToday(practice, logs.filter(l => l.counts_toward_streak !== false))
}

export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
