// Birth details live on this phone only, per signed-in account.
// AI-DEV NOTE: never send these to Supabase, PostHog, Sentry or any server. The
// Android app sets allowBackup="false", so they are not copied to Google backups
// and are gone on uninstall. Keyed by user id so a shared phone keeps them apart.
import { Preferences } from '@capacitor/preferences'

const key = (userId) => `birth-details:${userId}`

export async function loadBirthDetails(userId) {
  try {
    const { value } = await Preferences.get({ key: key(userId) })
    return value ? JSON.parse(value) : null
  } catch { return null }
}

export async function saveBirthDetails(userId, details) {
  await Preferences.set({ key: key(userId), value: JSON.stringify(details) })
}

export async function deleteBirthDetails(userId) {
  await Preferences.remove({ key: key(userId) })
}
