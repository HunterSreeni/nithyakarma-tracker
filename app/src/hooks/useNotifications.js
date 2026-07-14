import { useState, useEffect, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../lib/supabase'
import { scheduleAllReminders, cancelAllReminders } from '../utils/notifications'
import { registerFCM, unregisterFCM, checkFCMPermission } from '../utils/pushAndroid'
import { isPushSupported, setupWebPush, deleteWebPushSubscription, hasActiveSubscription } from '../utils/webPush'
import { friendlyError } from '../utils/friendlyError'

const WEB_BLOCKED_MESSAGE =
  'Notifications are blocked in this browser. Click the padlock icon next to the address bar, allow notifications, then try again.'
const ANDROID_BLOCKED_MESSAGE =
  'Notifications are blocked for this app. Enable them in your device Settings > Apps > Nithyakarma > Notifications.'

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
  const [testResult, setTestResult] = useState('')
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

  // Self-heal: the DB `enabled` flag can go stale without the app knowing -
  // browser storage cleared (subscription gone, permission untouched) or the
  // Android registration silently lost. Never prompt here (that would be a
  // surprise permission dialog on page load) - only act on ALREADY-granted
  // permission, and proactively explain an ALREADY-denied one instead of
  // just showing a checked-but-dead box.
  useEffect(() => {
    if (!user || !enabled) return
    if (native) {
      checkFCMPermission().then((status) => {
        if (status === 'denied') setError(ANDROID_BLOCKED_MESSAGE)
        else if (status === 'granted') registerFCM(user.id).catch(() => {})
      })
      return
    }
    if (!isPushSupported()) return
    if (Notification.permission === 'denied') { setError(WEB_BLOCKED_MESSAGE); return }
    if (Notification.permission !== 'granted') return
    hasActiveSubscription().then((has) => {
      if (!has) setupWebPush(user.id).catch(() => {})
    })
  }, [user, native, enabled])

  // Reactively clear a stale "blocked" error the moment the user fixes the
  // permission in the browser's own site-settings UI, without a page reload.
  // Not all browsers support the Permissions API for 'notifications' - no-op
  // where absent.
  useEffect(() => {
    if (native || !navigator.permissions?.query) return
    let status
    let cancelled = false
    navigator.permissions.query({ name: 'notifications' }).then((s) => {
      if (cancelled) return
      status = s
      status.onchange = () => {
        if (status.state === 'granted') setError('')
      }
    }).catch(() => {})
    return () => { cancelled = true; if (status) status.onchange = null }
  }, [native])

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
          setError(WEB_BLOCKED_MESSAGE)
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

  // Sends a real push through the full server round-trip right now, instead
  // of waiting for a scheduled reminder window - the fastest way to confirm
  // whether a given account's subscription actually works.
  const sendTestNotification = useCallback(async () => {
    setError('')
    setTestResult('')
    try {
      const { data, error: fnError } = await supabase.functions.invoke('send-test-notification')
      if (fnError) throw fnError
      if (data?.error) { setError(data.error); return }
      setTestResult(`Sent to ${data.sent} of ${data.total} device${data.total === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(friendlyError(err))
    }
  }, [])

  return {
    enabled, loading, error, testResult, supported: native || isPushSupported(),
    toggle, sendTestNotification,
  }
}
