import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// AI-DEV NOTE: update prompts (Sreeni, 2026-11-22). The installed NATIVE app
// version (App.getInfo, not package.json's APP_VERSION) is compared with
// public.app_min_versions: below suggested_version shows a dismissible card,
// below required_version a blocking screen. Fail open: anything that goes wrong
// (offline, no row, a malformed version) means "no prompt", never a lock-out.
// The web app never checks; it is always the latest deploy.

// Strict x.y.z -> [x, y, z]; anything else -> null.
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? '').trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

// -1 / 0 / 1, or null when either side is not x.y.z.
export function compareVersions(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1
  }
  return 0
}

// The decision alone, so it is testable without Capacitor or Supabase.
export function updateStatus(installed, row) {
  if (!row) return 'ok'
  if (compareVersions(installed, row.required_version) === -1) return 'required'
  if (compareVersions(installed, row.suggested_version) === -1) return 'suggested'
  return 'ok'
}

const NO_PROMPT = { status: 'ok' }

export async function checkAppUpdate() {
  try {
    const platform = Capacitor.getPlatform()
    if (!Capacitor.isNativePlatform() || (platform !== 'android' && platform !== 'ios')) return NO_PROMPT
    const { App } = await import('@capacitor/app')
    const { version } = await App.getInfo()
    const { data, error } = await supabase.from('app_min_versions')
      .select('suggested_version, required_version, store_url').eq('platform', platform).maybeSingle()
    if (error || !data) return NO_PROMPT
    const status = updateStatus(version, data)
    if (status === 'ok') return NO_PROMPT
    return {
      status,
      installed: version,
      target: status === 'required' ? data.required_version : data.suggested_version,
      storeUrl: data.store_url,
      storeName: platform === 'ios' ? 'the App Store' : 'Google Play',
    }
  } catch {
    return NO_PROMPT
  }
}
