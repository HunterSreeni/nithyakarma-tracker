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

async function saveToken(token) {
  if (!currentUserId) return
  await supabase.from('push_subscriptions').upsert({
    user_id: currentUserId, endpoint: token, platform: 'android',
  }, { onConflict: 'endpoint' })
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
