import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { scheduleAllReminders, cancelAllReminders } from '../utils/notifications'
import { registerFCM, unregisterFCM } from '../utils/pushAndroid'

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

function isPushSupported() {
  return Boolean(window.isSecureContext && 'serviceWorker' in navigator
    && 'PushManager' in window && 'Notification' in window)
}

async function setupWebPush(userId) {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }
  const sub = subscription.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId, endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh, auth_key: sub.keys.auth, platform: 'web',
  }, { onConflict: 'endpoint' })
}

async function deleteWebPushSubscription(userId) {
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete()
      .match({ user_id: userId, platform: 'web' })
  } catch { /* best effort */ }
}

async function savePref(userId, enabled) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { error } = await supabase.from('notification_preferences')
    .upsert({ user_id: userId, enabled, timezone, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error
}

export function useNotifications(user, { includeSandhya } = { includeSandhya: false }) {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const native = Capacitor.isNativePlatform()

  useEffect(() => {
    if (!user) { setLoading(false); return }
    supabase.from('notification_preferences')
      .select('enabled').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        setEnabled(data?.enabled ?? false)
        setLoading(false)
      })
  }, [user])

  // Keep local reminders scheduled on native when enabled
  useEffect(() => {
    if (!native || !enabled) return
    scheduleAllReminders({ includeSandhya }).catch(() => {})
  }, [native, enabled, includeSandhya])

  const toggle = useCallback(async () => {
    setError('')
    const next = !enabled

    if (next) {
      if (!native) {
        if (!isPushSupported()) {
          setError('Push notifications are not supported in this browser.')
          return
        }
        if (Notification.permission === 'denied') {
          setError('Notifications are blocked. Enable them in your browser settings.')
          return
        }
        if (Notification.permission === 'default') {
          const result = await Notification.requestPermission()
          if (result !== 'granted') {
            setError('Notification permission was denied.')
            return
          }
        }
      }
    } else {
      if (native) {
        await cancelAllReminders()
        await unregisterFCM(user.id).catch(() => {})
      } else {
        await deleteWebPushSubscription(user.id)
      }
    }

    const saveError = await savePref(user.id, next)
    if (saveError) { setError(saveError.message); return }
    setEnabled(next)

    if (next) {
      if (native) {
        const ok = await scheduleAllReminders({ includeSandhya })
        if (!ok) {
          setError('Notification permission was denied.')
          setEnabled(false)
          await savePref(user.id, false)
          return
        }
        // FCM push (needs Firebase config); local reminders already cover the device
        await registerFCM(user.id).catch(() => {})
      } else {
        try {
          await setupWebPush(user.id)
        } catch {
          setError('Could not subscribe this browser to push. Try again.')
        }
      }
    }
  }, [user, native, enabled, includeSandhya])

  return { enabled, loading, error, supported: native || isPushSupported(), toggle }
}
