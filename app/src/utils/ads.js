import { Capacitor } from '@capacitor/core'
import { track } from './analytics'

const INTERSTITIAL_ID = 'ca-app-pub-2677287550445019/1140728797'
// Dev builds only: use Google's test ad serving so local/CI runs never request
// or render real ads. Prod builds always use the real ad unit above for real.
const isTesting = import.meta.env.DEV

let initialized = false
// null = not yet resolved this session; true/false once UMP consent is known.
let adsAllowed = null
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
  adsAllowed = null
}

// Google UMP consent (required to serve ads to EEA/UK users). Runs once per
// session: fetch the latest consent info, show the form if the SDK says one is
// required and available, then report whether ads may be requested at all.
// Returns true when ads are allowed, false when consent forbids them.
async function ensureConsent(AdMob, AdmobConsentStatus) {
  const info = await AdMob.requestConsentInfo()
  if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
    const after = await AdMob.showConsentForm()
    return after.canRequestAds !== false
  }
  return info.canRequestAds !== false
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
    const { AdMob, MaxAdContentRating, AdmobConsentStatus } = await import('@capacitor-community/admob')
    if (!initialized) {
      await AdMob.initialize({
        initializeForTesting: isTesting,
        // Family/devotional audience: only G-rated ads (never gambling, dating, etc.).
        maxAdContentRating: MaxAdContentRating.General,
      })
      initialized = true
    }
    // Gate ads behind UMP consent (EEA/UK requirement). Resolved once per
    // session; if the user declines or consent can't be obtained, no ad is ever
    // shown this session.
    if (adsAllowed === null) {
      adsAllowed = await ensureConsent(AdMob, AdmobConsentStatus)
    }
    if (!adsAllowed) return false
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_ID, isTesting })
    await AdMob.showInterstitial()
    shownThisSession = true
    track('ad_shown', {})
    return true
  } catch (err) {
    console.warn('[ads] interstitial failed', err)
    return false
  }
}
