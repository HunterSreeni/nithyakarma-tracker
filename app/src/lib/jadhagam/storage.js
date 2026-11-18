// Birth charts live on this phone only, per signed-in account.
// AI-DEV NOTE: never send these to Supabase, PostHog, Sentry or any server. The
// Android app sets allowBackup="false", so they are not copied to Google backups
// and are gone on uninstall. Keyed by user id so a shared phone keeps them apart.
import { Preferences } from '@capacitor/preferences'
import { traditionForPlace } from './places'

const listKey = (userId) => `birth-charts:${userId}`
// v1 kept one chart per account under this key. It is moved into the list on
// first load and then removed, so older installs keep their saved chart.
const legacyKey = (userId) => `birth-details:${userId}`

// Not crypto.randomUUID: the old Android WebViews we support do not have it.
export const newChartId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

async function readList(userId) {
  const { value } = await Preferences.get({ key: listKey(userId) })
  return value ? JSON.parse(value) : null
}

const writeList = (userId, charts) => Preferences.set({ key: listKey(userId), value: JSON.stringify(charts) })

// The list, migrating a v1 chart into it first. Throws if storage fails, so a
// write never starts from an empty list while the v1 chart is still waiting.
async function currentList(userId, selfName) {
  const list = await readList(userId)
  if (list) return list
  const { value } = await Preferences.get({ key: legacyKey(userId) })
  if (!value) return []
  const old = JSON.parse(value)
  const charts = [{ ...old, id: newChartId(), name: selfName || 'Me', relation: 'self', tradition: traditionForPlace(old.place) }]
  await writeList(userId, charts)
  await Preferences.remove({ key: legacyKey(userId) })
  return charts
}

// Returns the account's charts, oldest first. selfName names a migrated v1 chart.
export async function loadCharts(userId, { selfName } = {}) {
  try { return await currentList(userId, selfName) } catch { return [] }
}

// Adds the chart, or replaces the one with the same id.
export async function saveChart(userId, chart, { selfName } = {}) {
  const list = [...(await currentList(userId, selfName))]
  const i = list.findIndex((c) => c.id === chart.id)
  if (i === -1) list.push(chart)
  else list[i] = chart
  await writeList(userId, list)
  return list
}

export async function deleteChart(userId, id) {
  const list = (await currentList(userId)).filter((c) => c.id !== id)
  await writeList(userId, list)
  return list
}

// Account deletion: every chart for this account goes, the v1 key too.
export async function deleteAllCharts(userId) {
  await Preferences.remove({ key: listKey(userId) })
  await Preferences.remove({ key: legacyKey(userId) })
}
