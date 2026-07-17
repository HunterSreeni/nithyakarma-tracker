import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// FCM push for Android (ported from Sandhyavandhanam, hardened).
// Requires google-services.json in android/app/.

// Kept at module scope so the FCM token is saved even when it *rotates* long
// after the initial register() call. FCM refreshes tokens periodically; if we
// only listened during registerFCM() the new token would be dropped, the old
// one would go stale, the server would prune it on UNREGISTERED, and push would
// silently stop forever.
let currentUserId = null
let listenersReady = false

// Distinct from the scheduled-reminder ids (100-500) in utils/notifications.js -
// this one just relays whatever push just arrived, so re-using it across
// receives is fine (each call replaces the last unactioned one).
const FOREGROUND_PUSH_ID = 600

async function saveToken(token) {
  if (!currentUserId) return
  // A device token can be left over from a previous account signed into the
  // same device (e.g. shared test hardware) - reclaim it for this user since
  // the unique constraint is now per-user, not global.
  await supabase.from('push_subscriptions').delete()
    .eq('endpoint', token).neq('user_id', currentUserId)
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: currentUserId, endpoint: token, platform: 'android',
  }, { onConflict: 'user_id,endpoint' })
  if (error) console.warn('[push] failed to save FCM token', error.message)
}

async function ensureListeners(PushNotifications) {
  if (listenersReady) return
  listenersReady = true
  // Persistent: fires on first register AND on every token rotation.
  await PushNotifications.addListener('registration', (data) => { saveToken(data.value) })
  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] FCM registration error', err?.error)
  })
  // Tap on a delivered push -> bring app to the URL from the data payload.
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = action?.notification?.data?.url
    if (url) { try { window.location.href = url } catch { /* noop */ } }
  })
  // Android only auto-displays a push's system notification while the app is
  // backgrounded - in the foreground it hands the payload to this event and
  // shows nothing on its own, so a reminder that lands while the app is open
  // used to look like it silently did nothing. Raise it ourselves.
  await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [{
          id: FOREGROUND_PUSH_ID,
          title: notification.title ?? 'Nithyakarma',
          body: notification.body ?? '',
        }],
      })
    } catch { /* best-effort - never let a receive handler throw */ }
  })
}

// Reads current permission status WITHOUT prompting - used for the mount-time
// self-heal so a stale checked box doesn't silently re-trigger a permission
// dialog the user never asked for.
export async function checkFCMPermission() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return 'granted'
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const status = await PushNotifications.checkPermissions()
  return status.receive
}

export async function registerFCM(userId) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return
  currentUserId = userId

  const { PushNotifications } = await import('@capacitor/push-notifications')
  const permStatus = await PushNotifications.checkPermissions()
  if (permStatus.receive !== 'granted') {
    const requested = await PushNotifications.requestPermissions()
    if (requested.receive !== 'granted') throw new Error('Notification permission denied')
  }

  // The edge function sends android.notification.channel_id = "reminders".
  // On Android 8+ a push to a non-existent channel is silently dropped, so the
  // channel MUST exist on the device before any push arrives.
  await PushNotifications.createChannel({
    id: 'reminders',
    name: 'Reminders',
    description: 'Daily anushtanam reminders',
    importance: 5,
    visibility: 1,
  }).catch(() => { /* older Android / non-fatal */ })

  await ensureListeners(PushNotifications)
  await PushNotifications.register()
}

export async function unregisterFCM(userId) {
  if (!Capacitor.isNativePlatform()) return
  currentUserId = null // stop persisting rotated tokens once disabled
  await supabase.from('push_subscriptions').delete()
    .match({ user_id: userId, platform: 'android' })
}
