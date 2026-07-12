import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// Ask for a Play Store review at genuine high points (streak milestones),
// native-only and heavily rate-limited so it never nags. Google itself also
// quota-limits how often the sheet actually appears.
const MILESTONES = [3, 7, 30, 100, 365]
const KEY = 'review_last_prompt'
const MIN_DAYS_BETWEEN = 45

export function isMilestone(streak) {
  return MILESTONES.includes(streak)
}

// Returns true only if a review was actually requested (so the caller can skip
// the interstitial that turn). Never throws - a failure just means "no review".
export async function maybeRequestReview() {
  if (!Capacitor.isNativePlatform()) return false
  try {
    const { value } = await Preferences.get({ key: KEY })
    if (value && (Date.now() - Number(value)) / 86400000 < MIN_DAYS_BETWEEN) {
      return false
    }
    const { InAppReview } = await import('@capacitor-community/in-app-review')
    await InAppReview.requestReview()
    await Preferences.set({ key: KEY, value: String(Date.now()) })
    return true
  } catch {
    return false
  }
}
