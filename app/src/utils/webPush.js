import { supabase } from '../lib/supabase'

// Ported from the Sandhyavandhanam app's useNotifications hook.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function isPushSupported() {
  return Boolean(window.isSecureContext && 'serviceWorker' in navigator
    && 'PushManager' in window && 'Notification' in window)
}

export async function setupWebPush(userId) {
  if (!isPushSupported()) return
  // Was a silent no-op before - that let toggle() report success with no
  // subscription ever created if the build was missing the VAPID key.
  if (!VAPID_PUBLIC_KEY) throw new Error('Push is not configured for this build (missing VAPID key).')
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const sub = subscription.toJSON()
  // A shared/reused browser endpoint may still be owned by a different
  // account (e.g. a test device signed into two accounts) - the unique
  // constraint is per-user now, so reclaim it for this user first.
  await supabase.from('push_subscriptions').delete()
    .eq('endpoint', sub.endpoint).neq('user_id', userId)
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId, endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh, auth_key: sub.keys.auth, platform: 'web',
  }, { onConflict: 'user_id,endpoint' })
  if (error) throw error
}

export async function deleteWebPushSubscription(userId) {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete()
      .match({ user_id: userId, platform: 'web' })
  } catch { /* best effort */ }
}
