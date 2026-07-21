// Downloads the per-sarga Ramayanam PDFs (Sanskrit + Malayalam) that
// KandamPage.jsx embeds via iframe. prapatti.com's own PDFs send
// `X-Frame-Options: SAMEORIGIN`, so they can't be framed directly from this
// app - these get re-hosted in the `learning-content` Supabase Storage
// bucket instead (this script only downloads to disk; upload is a manual
// step via the Supabase dashboard, since no MCP/API tool covers Storage
// uploads).
//
// Source: prapatti.com, compiled by Sunder Kidambi. Each kandam is a
// separate per-sarga PDF set, but the folder name, file prefix and
// zero-padding width in their URLs vary per kandam (larger kandams pad to
// 3 digits instead of 2) - confirmed by hand against the live site, not
// guessed. Uttara Kandam isn't published there under any name tried, so
// it's not included - see src/utils/ramayanam.js for the kandam list this
// app actually offers.
//
// This app's own Storage layout is simpler and consistent across kandams:
// no source zero-padding is preserved, just ramayanam/{kandamSlug}/
// {sanskrit,malayalam}/{sarga}.pdf - see KandamPage.jsx's pdfUrl().
// Sundara Kandam was downloaded separately before this script existed
// (see the superseded download-ramayana-sundara-kandam-pdfs.cjs) and its
// files were copied straight into this script's output layout, so it's
// left out of SOURCES below rather than re-fetched.
//
// Run: node scripts/download-ramayanam-pdfs.cjs
// Output: scripts/content/ramayanam-pdfs/{kandamSlug}/{sanskrit,malayalam}/{sarga}.pdf
// Upload the whole ramayanam-pdfs folder to Storage - dragging it in as-is
// (rather than into a pre-made "ramayanam" folder) lands it at
// learning-content/ramayanam-pdfs/{kandamSlug}/{sanskrit,malayalam}/{sarga}.pdf,
// which is what KandamPage.jsx's pdfUrl() actually expects.
const fs = require('fs')
const path = require('path')

const BASE_URL = 'https://www.prapatti.com/slokas'
const LANGUAGES = ['sanskrit', 'malayalam']
const REQUEST_DELAY_MS = 1500 // polite rate-limit - this is someone else's server, not a CDN
const OUT_DIR = path.join(__dirname, 'content', 'ramayanam-pdfs')

// folder/prefix are this site's own naming (Raamaayanam/<folder>/<prefix>_<padded-N>.pdf),
// padWidth is how many digits that specific kandam's files are zero-padded to.
const SOURCES = [
  { slug: 'bala', folder: 'Baalakaandam', prefix: 'baalakaandam', totalSargas: 77, padWidth: 2 },
  { slug: 'ayodhya', folder: 'Ayodhyaakaandam', prefix: 'ayodhyaakaandam', totalSargas: 119, padWidth: 3 },
  { slug: 'aranya', folder: 'Aranyakaandam', prefix: 'aranyakaandam', totalSargas: 75, padWidth: 2 },
  { slug: 'kishkindha', folder: 'Kishkindhaakaandam', prefix: 'kishkindhaakaandam', totalSargas: 67, padWidth: 2 },
  { slug: 'yuddha', folder: 'Yuddhakaandam', prefix: 'yuddhakaandam', totalSargas: 128, padWidth: 3 },
]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function downloadOne(source, language, sarga) {
  const padded = String(sarga).padStart(source.padWidth, '0')
  const url = `${BASE_URL}/${language}/Raamaayanam/${source.folder}/${source.prefix}_${padded}.pdf`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/pdf')) throw new Error(`Unexpected content-type "${contentType}" for ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 1000) throw new Error(`Suspiciously small response (${buf.length} bytes) for ${url}`)
  // Storage layout drops the source's own zero-padding - always plain {sarga}.pdf.
  const outPath = path.join(OUT_DIR, source.slug, language, `${sarga}.pdf`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, buf)
  return buf.length
}

async function run() {
  const failures = []
  const totalFiles = SOURCES.reduce((sum, s) => sum + s.totalSargas, 0) * LANGUAGES.length
  let done = 0
  for (const source of SOURCES) {
    for (const language of LANGUAGES) {
      for (let sarga = 1; sarga <= source.totalSargas; sarga++) {
        done++
        process.stdout.write(`[${done}/${totalFiles}] ${source.slug} ${language} sarga ${sarga}/${source.totalSargas}... `)
        try {
          const bytes = await downloadOne(source, language, sarga)
          console.log(`${bytes} bytes`)
        } catch (err) {
          console.log(`FAILED: ${err.message}`)
          failures.push({ source: source.slug, language, sarga, message: err.message })
        }
        await sleep(REQUEST_DELAY_MS)
      }
    }
  }
  console.log(`\nDone. ${totalFiles - failures.length}/${totalFiles} downloaded to ${OUT_DIR}`)
  if (failures.length) {
    console.log('Failures (re-run the script - it overwrites, so a partial re-run is safe):')
    for (const f of failures) console.log(`  ${f.source} ${f.language} sarga ${f.sarga}: ${f.message}`)
    process.exitCode = 1
  }
}

run()
