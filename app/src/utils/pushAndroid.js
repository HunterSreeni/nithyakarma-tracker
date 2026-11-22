import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// AI-DEV NOTE: Protected FCM registration/token-rotation logic. See AGENTS.md
// "Notifications & reminders" - do not change without Sreeni's explicit
// instruction; this is the surface behind a prior push-notification prod
// incident (memory nithyakarma-push-fixes-2026-07).
// FCM push for Android (ported from Sandhyavandhanam, hardened) and iOS.
// Requires google-services.json in android/app/ and GoogleService-Info.plist in
// ios/App/App/.
// AI-DEV NOTE: iOS uses the same plugin and the same FCM token as Android
// (AppDelegate.swift swaps Apple's APNs token for the FCM one), so the server
// sends to both with sendFCM; rows are saved with platform 'ios' (Sreeni,
// 2026-11-22).

// Kept at module scope so the FCM token is saved even when it *rotates* long
// after the initial register() call. FCM refreshes tokens periodically; if we
// only listened during registerFCM() the new token would be dropped, the old
// one would go stale, the server would prune it on UNREGISTERED, and push would
// silently stop forever.
let currentUserId = null
let listenersReady = false
// Last token saved for currentUserId, so sign-out can drop just THIS device.
let currentToken = null
// AI-DEV NOTE: registerFCM() resolves only once the device token is SAVED, not
// when registration merely starts. On iOS the token arrives 2-3 s after
// register() (APNs, then Firebase swaps it for an FCM token); returning early
// let the pref flip on and the first-run test push run before any row existed
// ("No active notification subscription found", TestFlight 2026-11-22).
// Settled by the next saveToken() or registrationError.
let pendingRegistration = null
const TOKEN_TIMEOUT_MS = 20000

// Distinct from the scheduled-reminder ids (100-500) in utils/notifications.js -
// this one just relays whatever push just arrived, so re-using it across
// receives is fine (each call replaces the last unactioned one).
const FOREGROUND_PUSH_ID = 600

const PUSH_PLATFORMS = ['android', 'ios']
const nativePushPlatform = () =>
  (Capacitor.isNativePlatform() && PUSH_PLATFORMS.includes(Capacitor.getPlatform()))
    ? Capacitor.getPlatform() : null

async function saveToken(token) {
  const pending = pendingRegistration
  pendingRegistration = null
  if (!currentUserId) { pending?.reject(new Error('Push registration was cancelled')); return }
  currentToken = token
  // AI-DEV NOTE: no client-side "reclaim" delete here - RLS scopes it to our
  // own rows, so it never removed a previous account's row for this token
  // (the duplicate-push bug). The push_subscriptions_single_owner trigger
  // hands the token to this account server-side on insert.
  let error
  try {
    ({ error } = await supabase.from('push_subscriptions').upsert({
      user_id: currentUserId, endpoint: token, platform: nativePushPlatform(),
    }, { onConflict: 'user_id,endpoint' }))
  } catch (err) {
    error = err
  }
  if (error) {
    console.warn('[push] failed to save FCM token', error.message)
    pending?.reject(new Error('Could not save this device for push'))
    return
  }
  pending?.resolve()
}

async function ensureListeners(PushNotifications) {
  if (listenersReady) return
  listenersReady = true
  // Persistent: fires on first register AND on every token rotation.
  await PushNotifications.addListener('registration', (data) => { saveToken(data.value) })
  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] FCM registration error', err?.error)
    const pending = pendingRegistration
    pendingRegistration = null
    pending?.reject(new Error('Push registration failed'))
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
  // AI-DEV NOTE: Android only. iOS already shows it (presentationOptions in
  // capacitor.config.ts), so re-raising there would show it twice.
  await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    if (Capacitor.getPlatform() !== 'android') return
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
  if (!nativePushPlatform()) return 'granted'
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const status = await PushNotifications.checkPermissions()
  return status.receive
}

// AI-DEV NOTE: one registration at a time per account. The plugin's events carry
// no attempt id, so two overlapping register() calls (mount self-heal + a toggle
// tap) could settle each other's wait; the second caller shares the first's.
let inFlight = null
let inFlightUser = null

export function registerFCM(userId) {
  if (inFlight && inFlightUser === userId) return inFlight
  inFlightUser = userId
  const attempt = registerOnce(userId).finally(() => {
    if (inFlight === attempt) { inFlight = null; inFlightUser = null }
  })
  inFlight = attempt
  return attempt
}

async function registerOnce(userId) {
  const platform = nativePushPlatform()
  if (!platform) return
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
  if (platform === 'android') {
    await PushNotifications.createChannel({
      id: 'reminders',
      name: 'Reminders',
      description: 'Daily anushtanam reminders',
      importance: 5,
      visibility: 1,
    }).catch(() => { /* older Android / non-fatal */ })
  }

  await ensureListeners(PushNotifications)
  // A newer call supersedes an older one still waiting for its token.
  pendingRegistration?.reject(new Error('Push registration was superseded'))
  let timer
  let mine
  const saved = new Promise((resolve, reject) => {
    mine = { resolve, reject }
    pendingRegistration = mine
    timer = setTimeout(() => reject(new Error('Timed out waiting for the push token')), TOKEN_TIMEOUT_MS)
  })
  saved.catch(() => {}) // register() may throw first; never leave this rejection unhandled
  try {
    await PushNotifications.register()
    await saved
  } finally {
    clearTimeout(timer)
    if (pendingRegistration === mine) pendingRegistration = null
  }
}

export async function unregisterFCM(userId) {
  const platform = nativePushPlatform()
  if (!platform) return
  currentUserId = null // stop persisting rotated tokens once disabled
  currentToken = null
  await supabase.from('push_subscriptions').delete()
    .match({ user_id: userId, platform })
}

// Sign-out cleanup: drop only this device's row (the account may still want
// push on its other devices) and stop saving rotated tokens for it. Best
// effort - the single-owner trigger still reassigns the token when the next
// account registers, even if this never reaches the server (e.g. offline).
export async function releaseFCMToken() {
  const userId = currentUserId
  const token = currentToken
  currentUserId = null
  currentToken = null
  if (!Capacitor.isNativePlatform() || !userId || !token) return
  await supabase.from('push_subscriptions').delete()
    .match({ user_id: userId, endpoint: token })
}
