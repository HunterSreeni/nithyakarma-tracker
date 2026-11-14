import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { supabase } from '../lib/supabase'
import { capture } from '../lib/posthog'

// AI-DEV NOTE: `app_first_open` = the install step of the marketing funnel. Play
// Console / App Store Connect stay the official install counts; this is the
// per-user event PostHog can join to signups. Sent once per install (native
// only). Devices that already had a signed-in account when this shipped are app
// UPDATES, not installs, so they carry existing_user=true and must be filtered out
// of install metrics.
const KEY = 'first_open_sent_v1'

export async function trackFirstOpen(attribution = {}) {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { value } = await Preferences.get({ key: KEY })
    if (value) return false
    const { data } = await supabase.auth.getSession()
    await Preferences.set({ key: KEY, value: new Date().toISOString() })
    capture('app_first_open', { ...attribution, existing_user: !!data?.session })
    return true
  } catch {
    return false
  }
}
