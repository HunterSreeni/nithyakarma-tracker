import { Capacitor } from '@capacitor/core'
import { track } from './analytics'

// Google's public TEST interstitial ad unit. Replace with the real AdMob unit id
// once the AdMob account is created (Intent 0.2). Never ship the test id to Play.
const INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712'

let initialized = false
// Launch is intentionally LIGHT: at most one interstitial per app session. The
// aggressive-ads + ₹99/year ad-free upgrade come later (Intent 2.6).
let shownThisSession = false

export function adsAvailable() {
  return Capacitor.isNativePlatform()
}

// Test-only: reset the module's ad state (per-session cap + SDK init) between cases.
export function _resetAdSession() {
  shownThisSession = false
  initialized = false
}

export function isAdFree(profile, today = new Date()) {
  if (!profile?.ad_free_until) return false
  return new Date(profile.ad_free_until) >= new Date(today.toDateString())
}

// Show one interstitial. Called ONLY after submit_practice_log returned
// {saved: true} and BEFORE the celebration reward (Intent 0.2). No-op on web,
// for ad-free users, or once the per-session cap is spent.
export async function showInterstitial(profile) {
  if (!adsAvailable() || isAdFree(profile) || shownThisSession) return false
  try {
    const { AdMob, MaxAdContentRating } = await import('@capacitor-community/admob')
    if (!initialized) {
      await AdMob.initialize({
        initializeForTesting: true,
        // Family/devotional audience: only G-rated ads (never gambling, dating, etc.).
        maxAdContentRating: MaxAdContentRating.General,
      })
      initialized = true
    }
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting: true })
    await AdMob.showInterstitial()
    shownThisSession = true
    track('ad_shown', {})
    return true
  } catch (err) {
    console.warn('[ads] interstitial failed', err)
    return false
  }
}
