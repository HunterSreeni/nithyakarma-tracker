import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'

// First-party analytics: events are written to our own analytics_events table
// (no third-party analytics vendor). Fire-and-forget - a failure here must never
// block or break the UX. Keep props PII-free: event names + numeric/flag props
// only, never names, email, or practice content.
export async function track(event, props = {}) {
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
