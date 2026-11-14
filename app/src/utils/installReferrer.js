import { Capacitor, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// AI-DEV NOTE: Play Install Referrer (marketing funnel Phase 0a). The Play Store
// link on nithyakarma.org carries `referrer=utm_source%3D...`; Play hands that
// string back once per install via Google's Install Referrer API (native plugin
// InstallReferrerPlugin.java). We read it on launch until one answer is stored,
// then never again, so later launches can never overwrite first touch.
// A transient failure (service unavailable) stores nothing and retries next launch.
const KEY = 'install_referrer_v1'
const InstallReferrer = registerPlugin('InstallReferrer')

export function parseReferrer(raw) {
  const out = {}
  if (typeof raw !== 'string' || !raw) return out
  for (const [k, v] of new URLSearchParams(raw)) {
    if (/^utm_(source|medium|campaign|content|term)$/.test(k) && v) out[`install_${k}`] = v.slice(0, 100)
  }
  return out
}

const TIMEOUT_MS = 5000
let inflight = null

async function lookup() {
  const { value } = await Preferences.get({ key: KEY })
  if (value) return JSON.parse(value)
  // A hung Play service connection must not stall startup forever: time out,
  // store nothing, and try again on the next launch.
  const { referrer } = await Promise.race([
    InstallReferrer.getReferrer(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('install referrer timeout')), TIMEOUT_MS)),
  ])
  const parsed = parseReferrer(referrer)
  const attribution = Object.keys(parsed).length ? parsed : { install_utm_source: 'unknown' }
  await Preferences.set({ key: KEY, value: JSON.stringify(attribution) })
  return attribution
}

// Returns the stored install attribution ({} if none / not Android). Concurrent
// callers (app start + sign-in) share one lookup.
export function getInstallAttribution() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return Promise.resolve({})
  if (!inflight) inflight = lookup().catch(() => ({})).finally(() => { inflight = null })
  return inflight
}
