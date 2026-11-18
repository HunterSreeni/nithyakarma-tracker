// Local birth date/time at a place -> the UTC instant, using the device's own
// time-zone database (Intl), which knows India's historical offsets.
//
// AI-DEV NOTE: never hard-code +05:30. Asia/Kolkata itself was +06:30 for war time
// (1942-1945) and older dates used other local times; Intl's tzdata has those rules.

function offsetMinutes(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(utcMs))
  const get = (t) => Number(parts.find((p) => p.type === t).value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000)
}

// { year, month (1-12), day, hour (0-23), minute } in timeZone -> Date.
// offsetOverrideMin replaces the zone's rule when the user knows the recorded offset.
export function zonedToUtc({ year, month, day, hour, minute }, timeZone, offsetOverrideMin = null) {
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  if (offsetOverrideMin !== null) return new Date(wall - offsetOverrideMin * 60000)
  // Two passes settle the offset even when the guess lands across a change.
  let guess = wall - offsetMinutes(wall, timeZone) * 60000
  guess = wall - offsetMinutes(guess, timeZone) * 60000
  return new Date(guess)
}

export function utcOffsetLabel(minutes) {
  const sign = minutes < 0 ? '-' : '+'
  const a = Math.abs(minutes)
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

export function offsetAt(date, timeZone) {
  return offsetMinutes(date.getTime(), timeZone)
}

// Saved form values ({ date: "YYYY-MM-DD", hour12, minute, ampm, place, offsetOverride }) -> Date.
export function birthDetailsToUtc(d) {
  const [year, month, day] = d.date.split('-').map(Number)
  const hour = (d.hour12 % 12) + (d.ampm === 'PM' ? 12 : 0)
  let override = null
  if (d.offsetOverride) {
    const sign = d.offsetOverride.startsWith('-') ? -1 : 1
    const [h, m] = d.offsetOverride.slice(1).split(':').map(Number)
    override = sign * (h * 60 + m)
  }
  return zonedToUtc({ year, month, day, hour, minute: d.minute }, d.place.tz, override)
}
