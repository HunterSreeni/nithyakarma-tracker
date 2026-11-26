import { Preferences } from '@capacitor/preferences'

// Sabha names a user chose to hide (or reported) on this phone, per signed-in
// account. AI-DEV NOTE: kept on the device on purpose - hiding changes only what
// this user sees and never touches get_leaderboard, so the protected leaderboard
// rules (opt-in, scoring, scopes) stay exactly as they are. Apple guideline 1.2
// asks for a way to block abusive users; this is it.
const key = (userId) => `sabha-hidden:${userId}`

export async function getHiddenNames(userId) {
  const { value } = await Preferences.get({ key: key(userId) })
  try {
    const list = JSON.parse(value ?? '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export async function hideName(userId, subjectId) {
  const list = await getHiddenNames(userId)
  if (!list.includes(subjectId)) list.push(subjectId)
  await Preferences.set({ key: key(userId), value: JSON.stringify(list) })
  return list
}

export async function showAllNames(userId) {
  await Preferences.remove({ key: key(userId) })
  return []
}
