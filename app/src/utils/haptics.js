import { Capacitor } from '@capacitor/core'

// A short haptic pulse on the celebration moment (Intent 2.2). No-op on web -
// dynamically imported so the plugin never lands in the web bundle, and any
// SDK failure is swallowed (this is a nice-to-have, never worth blocking the
// already-saved celebration over).
export async function celebrationHaptic() {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch (err) {
    console.warn('[haptics] impact failed', err)
  }
}
