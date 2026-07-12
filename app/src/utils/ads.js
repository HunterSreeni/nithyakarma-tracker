import { Capacitor } from '@capacitor/core'
import { track } from './analytics'

// Google's public TEST interstitial ad unit. Replace with the real AdMob
// unit id once the AdMob account is created. Never ship test id to Play Store.
const INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'

let initialized = false

export function adsAvailable() {
  return Capacitor.isNativePlatform()
}

export function isAdFree(profile, today = new Date()) {
  if (!profile?.ad_free_until) return false
  return new Date(profile.ad_free_until) >= new Date(today.toDateString())
}

// Show one interstitial. Called ONLY after submit_practice_log returned
// {saved: true} and the celebration was dismissed. No-op on web / ad-free.
export async function showInterstitial(profile) {
  if (!adsAvailable() || isAdFree(profile)) return false
  try {
    const { AdMob } = await import('@capacitor-community/admob')
    if (!initialized) {
      await AdMob.initialize({ initializeForTesting: true })
      initialized = true
    }
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: true })
    await AdMob.showInterstitial()
    track('ad_shown', {})
    return true
  } catch (err) {
    console.warn('[ads] interstitial failed', err)
    return false
  }
}
