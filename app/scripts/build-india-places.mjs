// Builds src/lib/jadhagam/places-in.json from GeoNames (CC BY 4.0, geonames.org):
//   node scripts/build-india-places.mjs <cities15000.txt> <admin1CodesASCII.txt>
// Download both from https://download.geonames.org/export/dump/ first. Keeps Indian
// places with population >= 15000: name, state, lat, lon (3 decimals = ~100 m),
// most populous first so search ranks big towns higher.
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const [cities, admin1] = process.argv.slice(2)
if (!cities || !admin1) { console.error('usage: build-india-places.mjs <cities15000.txt> <admin1CodesASCII.txt>'); process.exit(1) }
const states = {}
for (const line of readFileSync(admin1, 'utf8').split('\n')) {
  const [code, , ascii] = line.split('\t')
  if (code?.startsWith('IN.')) states[code.slice(3)] = ascii
}
const rows = readFileSync(cities, 'utf8').split('\n').map((l) => l.split('\t'))
  .filter((c) => c[8] === 'IN' && c[17] === 'Asia/Kolkata')
  .map((c) => ({ name: c[2], state: c[10], lat: +(+c[4]).toFixed(3), lon: +(+c[5]).toFixed(3), pop: +c[14] }))
  .sort((a, b) => b.pop - a.pop)
const used = Object.fromEntries(Object.entries(states).filter(([k]) => rows.some((r) => r.state === k)))
const out = { source: 'GeoNames cities15000 (CC BY 4.0, geonames.org)', states: used, places: rows.map((r) => [r.name, r.state, r.lat, r.lon]) }
const dest = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/jadhagam/places-in.json')
writeFileSync(dest, JSON.stringify(out))
console.log(`${rows.length} places, ${Object.keys(used).length} states -> ${dest}`)
