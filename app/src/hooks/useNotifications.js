import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { scheduleAllReminders, cancelAllReminders } from '../utils/notifications'
import { registerFCM, unregisterFCM } from '../utils/pushAndroid'
import { isPushSupported, setupWebPush, deleteWebPushSubscription } from '../utils/webPush'

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
      .catch(() => setLoading(false))
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

      // Confirm the subscription is actually persisted BEFORE the pref flips
      // on - a silent save failure here used to leave enabled=true with
      // nothing to send to, which is exactly why push never fired.
      if (native) {
        const ok = await scheduleAllReminders({ includeSandhya })
        if (!ok) {
          setError('Notification permission was denied.')
          return
        }
        try {
          await registerFCM(user.id)
        } catch {
          await cancelAllReminders()
          setError('Could not register this device for push. Try again.')
          return
        }
      } else {
        try {
          await setupWebPush(user.id)
        } catch {
          setError('Could not subscribe this browser to push. Try again.')
          return
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
  }, [user, native, enabled, includeSandhya])

  return { enabled, loading, error, supported: native || isPushSupported(), toggle }
}
