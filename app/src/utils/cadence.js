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

// Done-state for a practice given today's logs for it.
export function isDoneToday(practice, logs) {
  if (practice.is_sandhyavandhanam) {
    const slots = new Set(logs.map(l => l.slot))
    return SANDHYA_SLOTS.every(s => slots.has(s.key))
  }
  return logs.length > 0
}

export function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
