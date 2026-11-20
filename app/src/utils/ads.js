import { Capacitor } from '@capacitor/core'
import { track } from './analytics'

// AI-DEV NOTE: Protected ad-gating logic. See AGENTS.md "AdMob / ads" - do not
// change the dev/prod ad-unit split or ad_free_until honoring without
// Sreeni's explicit instruction. The only ad shown today is the opt-in
// rewarded video for an extra Jadhagam download (authorized 2026-11-18). Real ads stay blocked pre-production per
// memory admob-ads-blocked-until-production; unblocking is Google's timing,
// not a code change here.
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

// AdMob SDK init + UMP consent, shared by every ad format. Resolves { AdMob }
// when ads may be requested this session, null otherwise.
// AI-DEV NOTE: wrapped in an object on purpose. Returning the Capacitor plugin
// proxy itself from an async function makes the Promise look up its "then" method, which
// throws "not implemented on android" and no ad ever shows.
async function readyAdMob() {
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
  return adsAllowed ? { AdMob } : null
}

// AI-DEV NOTE: kept for a future, deliberate placement. Since 2026-11-18 nothing
// calls it: no ad after marking a practice (see AGENTS.md "AdMob / ads").
// No-op on web, for ad-free users, or once the per-session cap is spent.
export async function showInterstitial(profile) {
  if (!adsAvailable() || isAdFree(profile) || shownThisSession) return false
  try {
    const ready = await readyAdMob()
    if (!ready) return false
    const { AdMob } = ready
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

// Google's published test rewarded unit, used in dev builds: test ads earn
// nothing and are policy-safe to show.
export const TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917'
// AI-DEV NOTE: the real "Jadhagam_extra_download" rewarded unit (created by Sreeni
// 2026-11-20) with server-side verification pointing at the admob-ssv edge
// function. The same id is in app_config.admob_rewarded_ad_unit, which admob-ssv
// checks callbacks against; change both together.
export const REWARDED_ID = 'ca-app-pub-2677287550445019/3600927444'

export function rewardedAdUnit(testing = isTesting) {
  return { adId: testing ? TEST_REWARDED_ID : REWARDED_ID, isTesting: testing }
}

// Shows one rewarded video for a Jadhagam download. The grant id and user id
// travel as SSV custom_data/user_id, so Google's signed callback to admob-ssv
// can verify this exact grant. Resolves 'rewarded' (watched to the end),
// 'dismissed' (closed early) or 'unavailable' (web, consent refused, no fill).
// Never call it for ad-free users: their downloads are free.
export async function showRewardedVideo({ userId, grantId }) {
  if (!adsAvailable()) return 'unavailable'
  let handles = []
  try {
    const ready = await readyAdMob()
    if (!ready) return 'unavailable'
    const { AdMob } = ready
    const { RewardAdPluginEvents } = await import('@capacitor-community/admob')
    const unit = rewardedAdUnit()
    await AdMob.prepareRewardVideoAd({ ...unit, ssv: { userId, customData: grantId } })
    // showRewardVideoAd() only settles when the reward is earned; a video closed
    // early never settles it. So decide from the Rewarded/Dismissed events.
    const outcome = await new Promise((resolve) => {
      let rewarded = false
      const add = (event, fn) => AdMob.addListener(event, fn).then((h) => handles.push(h))
      Promise.all([
        add(RewardAdPluginEvents.Rewarded, () => { rewarded = true }),
        add(RewardAdPluginEvents.Dismissed, () => resolve(rewarded ? 'rewarded' : 'dismissed')),
        add(RewardAdPluginEvents.FailedToShow, () => resolve('unavailable')),
      ]).then(() => AdMob.showRewardVideoAd().catch(() => resolve('unavailable')),
        () => resolve('unavailable')) // listeners could not be registered: never hang
    })
    track('rewarded_ad', { outcome })
    return outcome
  } catch (err) {
    console.warn('[ads] rewarded video failed', err)
    return 'unavailable'
  } finally {
    for (const h of handles) h.remove?.()
  }
}
