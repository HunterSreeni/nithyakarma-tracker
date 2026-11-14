// Uploads a signed AAB to a Google Play testing track (android-release.yml,
// input play_track=internal).
//
// AI-DEV NOTE: Uses Google's own androidpublisher client so the service-account
// key never reaches a third-party action. The service account only has "Release
// to testing tracks" on this app in Play Console, so it cannot touch production;
// ALLOWED_TRACKS is a second guard here. One Play "edit" per run: insert ->
// upload bundle -> set track -> commit. Any failure deletes the edit, so nothing
// half-done is ever published.
import { readFileSync, createReadStream } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const PACKAGE_NAME = 'org.nithyakarma.app'
export const ALLOWED_TRACKS = ['internal']
const NOTES_LIMIT = 500 // Play's per-language release-notes limit
const FALLBACK_NOTES = 'Bug fixes and improvements.'

// Release notes from the release-please CHANGELOG section for this version.
export function releaseNotesFor(changelog, versionName) {
  const lines = changelog.split(/\r?\n/)
  const start = lines.findIndex(l => new RegExp(`^##\\s+\\[?${versionName.replace(/\./g, '\\.')}\\]?[\\s(]`).test(l))
  if (start < 0) return FALLBACK_NOTES
  const bullets = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    const m = line.match(/^\*\s+(.*)$/)
    if (!m) continue
    const text = m[1]
      .replace(/\s*\(\[[0-9a-f]{7,}\]\([^)]*\)\)\s*$/, '') // trailing ([abc1234](url))
      .replace(/\*\*([^*]+):\*\*\s*/, '$1: ')              // **scope:** -> scope:
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')             // [text](url) -> text
      .trim()
    if (text) bullets.push(`- ${text}`)
  }
  if (!bullets.length) return FALLBACK_NOTES
  let out = ''
  for (const b of bullets) {
    const next = out ? `${out}\n${b}` : b
    if ([...next].length > NOTES_LIMIT) break
    out = next
  }
  // Count by code points, not UTF-16 units, so an emoji is never split in half.
  return out || [...bullets[0]].slice(0, NOTES_LIMIT).join('')
}

export async function uploadToPlay({ publisher, aabPath, track, versionName, releaseNotes, openStream = createReadStream, packageName = PACKAGE_NAME }) {
  if (!ALLOWED_TRACKS.includes(track)) throw new Error(`track "${track}" is not allowed (only ${ALLOWED_TRACKS.join(', ')})`)
  const { data: edit } = await publisher.edits.insert({ packageName })
  const editId = edit.id
  try {
    const { data: bundle } = await publisher.edits.bundles.upload({
      packageName, editId, media: { mimeType: 'application/octet-stream', body: openStream(aabPath) },
    })
    const versionCode = String(bundle.versionCode)
    await publisher.edits.tracks.update({
      packageName, editId, track,
      requestBody: {
        track,
        releases: [{
          name: `${versionName} (${versionCode})`,
          versionCodes: [versionCode],
          status: 'completed',
          releaseNotes: [{ language: 'en-US', text: releaseNotes }],
        }],
      },
    })
    await publisher.edits.commit({ packageName, editId })
    return { versionCode, editId }
  } catch (e) {
    await publisher.edits.delete({ packageName, editId }).catch(() => {})
    throw e
  }
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2)))
  const { aab, track, 'version-name': versionName } = args
  if (!aab || !track || !versionName) {
    console.error('usage: node scripts/play-upload.mjs --aab=<file> --track=internal --version-name=<x.y.z>')
    process.exit(2)
  }
  if (!process.env.PLAY_SERVICE_ACCOUNT_JSON) { console.error('::error::PLAY_SERVICE_ACCOUNT_JSON is not set'); process.exit(2) }
  const { androidpublisher, auth } = await import('@googleapis/androidpublisher')
  const client = new auth.GoogleAuth({
    credentials: JSON.parse(process.env.PLAY_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  })
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  let changelog = ''
  try { changelog = readFileSync(resolve(appDir, 'CHANGELOG.md'), 'utf8') } catch { /* fallback notes */ }
  const releaseNotes = releaseNotesFor(changelog, versionName)
  try {
    const { versionCode } = await uploadToPlay({
      publisher: androidpublisher({ version: 'v3', auth: client }), aabPath: aab, track, versionName, releaseNotes,
    })
    console.log(`Uploaded ${versionName} (${versionCode}) to the ${track} track.\nRelease notes:\n${releaseNotes}`)
  } catch (e) {
    // Google API errors carry a readable message; never print the credentials.
    console.error(`::error::Play upload failed: ${e?.errors?.[0]?.message || e?.message || e}`)
    process.exit(1)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
