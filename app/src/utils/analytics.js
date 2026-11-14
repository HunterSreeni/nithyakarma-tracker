import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { capture } from '../lib/posthog'

// First-party analytics: events are written to our own analytics_events table.
// Fire-and-forget - a failure here must never block or break the UX. Keep props
// PII-free: event names + numeric/flag props only, never names, email, or
// practice content.
// AI-DEV NOTE: during the PostHog roll-out (marketing plan Phase 0a) every event
// is ALSO sent to PostHog, but only its allow-listed props (lib/posthog.js
// ALLOWED_PROPS) - ritual flags and gender stay in our own database.
export async function track(event, props = {}) {
  try { capture(event, props) } catch { /* analytics never interrupts the user */ }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await supabase.from('analytics_events').insert({
      user_id: session.user.id,
      event,
      props,
      platform: Capacitor.isNativePlatform() ? 'android' : 'web',
    })
  } catch {
    /* best-effort - analytics never interrupts the user */
  }
}
