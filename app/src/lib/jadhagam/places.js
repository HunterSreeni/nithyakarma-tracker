// Offline birth-place search over Indian towns (GeoNames, CC BY 4.0).
// AI-DEV NOTE: v1 covers India only (all Asia/Kolkata); births abroad are v1.1.
// The list never leaves the device and searching sends nothing anywhere.
import data from './places-in.json'

export const PLACES_ATTRIBUTION = data.source
export const INDIA_TZ = 'Asia/Kolkata'

// Default calendar tradition for a birth place. The user can always change it:
// a Kerala family living in Chennai still keeps a Kerala jathakam.
export const traditionForPlace = (place) => (place?.state === 'Kerala' ? 'kerala' : 'tamil')

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
const index = data.places.map(([name, state, lat, lon]) => ({ name, state: data.states[state] || '', lat, lon, key: fold(name) }))

// Prefix matches first, then matches inside the name; each keeps population order.
export function searchPlaces(query, limit = 8) {
  const q = fold(query || '')
  if (q.length < 2) return []
  const starts = [], inside = []
  for (const p of index) {
    if (p.key.startsWith(q)) starts.push(p)
    else if (p.key.includes(q)) inside.push(p)
    if (starts.length >= limit) break
  }
  return starts.concat(inside).slice(0, limit).map((p) => ({ name: p.name, state: p.state, lat: p.lat, lon: p.lon, tz: INDIA_TZ }))
}
