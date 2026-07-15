import { Capacitor } from '@capacitor/core'

// Ported pattern from the Sandhyavandhanam app's notifications.js.
// Native-only (Capacitor LocalNotifications); silent no-op on web.

const SLOT_CONFIG = {
  morning: { id: 100, hour: 9, minute: 0, title: 'Prathakala Sandhyavandhanam', body: 'Time for your morning sandhya. Open the app!' },
  afternoon: { id: 200, hour: 12, minute: 30, title: 'Madhyanika Sandhyavandhanam', body: 'Time for your noon sandhya. Open the app!' },
  evening: { id: 300, hour: 18, minute: 30, title: 'Saayamkala Sandhyavandhanam', body: 'Time for your evening sandhya. Open the app!' },
}

const NUDGE = { id: 400, hour: 20, minute: 0, title: 'Your streak is waiting', body: 'Namaskaram! Today\'s anushtanams are not all marked yet. 2 minutes is all it takes.' }
const LAST_CALL = { id: 500, hour: 21, minute: 30, title: 'Last call before midnight', body: 'Your streak ends at midnight. Mark today\'s anushtanam to keep it alive.' }

function dailyAt(hour, minute) {
  const at = new Date()
  at.setHours(hour, minute, 0, 0)
  if (at <= new Date()) at.setDate(at.getDate() + 1)
  return { every: 'day', at, allowWhileIdle: true }
}

export async function scheduleAllReminders({ includeSandhya }) {
  if (!Capacitor.isNativePlatform()) return false
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const perm = await LocalNotifications.requestPermissions()
  if (perm.display !== 'granted') return false

  await cancelAllReminders()
  const notifications = []
  if (includeSandhya) {
    for (const slot of Object.values(SLOT_CONFIG)) {
      notifications.push({
        id: slot.id, title: slot.title, body: slot.body,
        schedule: dailyAt(slot.hour, slot.minute),
      })
    }
  }
  notifications.push({ id: NUDGE.id, title: NUDGE.title, body: NUDGE.body, schedule: dailyAt(NUDGE.hour, NUDGE.minute) })
  notifications.push({ id: LAST_CALL.id, title: LAST_CALL.title, body: LAST_CALL.body, schedule: dailyAt(LAST_CALL.hour, LAST_CALL.minute) })
  await LocalNotifications.schedule({ notifications })
  return true
}

export async function cancelAllReminders() {
  if (!Capacitor.isNativePlatform()) return
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const ids = [100, 200, 300, 400, 500].map(id => ({ id }))
  await LocalNotifications.cancel({ notifications: ids }).catch(() => {})
}
