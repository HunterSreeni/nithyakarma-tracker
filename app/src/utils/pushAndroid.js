import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// FCM token registration for Android (ported from Sandhyavandhanam's
// pushAndroid.js). Requires google-services.json in android/app/ - until
// that Firebase config exists, registration fails and the caller falls
// back to local notifications only.
export async function registerFCM(userId) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null

  const { PushNotifications } = await import('@capacitor/push-notifications')
  const permStatus = await PushNotifications.checkPermissions()
  if (permStatus.receive !== 'granted') {
    const requested = await PushNotifications.requestPermissions()
    if (requested.receive !== 'granted') throw new Error('Notification permission denied')
  }

  const token = await new Promise((resolve, reject) => {
    let regHandle = null
    let errHandle = null
    const cleanup = () => { regHandle?.remove(); errHandle?.remove() }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('FCM registration timed out')) }, 15000)
    Promise.all([
      PushNotifications.addListener('registration', (data) => {
        clearTimeout(timeout); cleanup(); resolve(data.value)
      }),
      PushNotifications.addListener('registrationError', (err) => {
        clearTimeout(timeout); cleanup(); reject(new Error(err.error || 'FCM registration failed'))
      }),
    ]).then(([r, e]) => { regHandle = r; errHandle = e; PushNotifications.register() })
      .catch(reject)
  })

  await supabase.from('push_subscriptions').upsert({
    user_id: userId, endpoint: token, platform: 'android',
  }, { onConflict: 'endpoint' })
  return token
}

export async function unregisterFCM(userId) {
  if (!Capacitor.isNativePlatform()) return
  await supabase.from('push_subscriptions').delete()
    .match({ user_id: userId, platform: 'android' })
}
