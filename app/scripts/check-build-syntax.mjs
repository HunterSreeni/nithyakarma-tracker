// Fails the build check if the shipped JS still contains syntax that old Android
// System WebViews cannot parse (the app's floor is Chrome 90, see vite.config.js).
//
// AI-DEV NOTE: Sentry NITHYAKARMA-4 (2026-11-14) was pdf.js's class `static {}`
// block crashing WebView 90. Vite now lowers it via build.target; this scan proves
// the output (app chunks AND workers) really is clean, so a dependency upgrade or
// a target change cannot silently bring the crash back. Patterns are the minified
// forms the bundler emits.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const FORBIDDEN = [
  { name: 'class static block (Chrome 94+)', re: /\bstatic\s*\{/g },
  { name: 'private brand check `#x in obj` (Chrome 91+)', re: /#[A-Za-z_$][\w$]*\s+in\s/g },
]

export function scanSource(text) {
  const hits = []
  for (const { name, re } of FORBIDDEN) {
    const n = (text.match(re) || []).length
    if (n) hits.push({ name, count: n })
  }
  return hits
}

export function scanDir(dir) {
  const problems = []
  for (const file of readdirSync(dir)) {
    if (!/\.(m?js)$/.test(file)) continue
    for (const hit of scanSource(readFileSync(join(dir, file), 'utf8'))) problems.push({ file, ...hit })
  }
  return problems
}

function main() {
  const dir = process.argv[2] || resolve(dirname(fileURLToPath(import.meta.url)), '../dist/assets')
  const problems = scanDir(dir)
  for (const p of problems) console.log(`::error::${p.file}: ${p.count} x ${p.name}`)
  if (!problems.length) console.log(`Build syntax OK for Chrome 90 WebViews (${dir})`)
  process.exit(problems.length ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
