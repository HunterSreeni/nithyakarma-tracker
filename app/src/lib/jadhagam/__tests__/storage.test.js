import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({ store: {} }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }) => ({ value: h.store[key] ?? null }),
    set: async ({ key, value }) => { h.store[key] = value },
    remove: async ({ key }) => { delete h.store[key] },
  },
}))

import { loadCharts, saveChart, deleteChart, deleteAllCharts } from '../storage'

const v1 = { date: '1981-02-10', hour12: 9, minute: 15, ampm: 'AM', place: { name: 'Thrissur', state: 'Kerala', lat: 10.517, lon: 76.217, tz: 'Asia/Kolkata' }, offsetOverride: '' }

beforeEach(() => { h.store = {} })

describe('birth chart storage', () => {
  it('starts empty', async () => {
    expect(await loadCharts('u1')).toEqual([])
  })

  it('moves a v1 single chart into the list once, as the account owner, with its place tradition', async () => {
    h.store['birth-details:u1'] = JSON.stringify(v1)
    const [c] = await loadCharts('u1', { selfName: 'Sreeni' })
    expect(c).toMatchObject({ ...v1, name: 'Sreeni', relation: 'self', tradition: 'kerala' })
    expect(c.id).toMatch(/^c/)
    expect(h.store['birth-details:u1']).toBeUndefined()
    // A second load reads the list, not a fresh migration.
    expect(await loadCharts('u1', { selfName: 'Other' })).toEqual([c])
  })

  it('keeps a waiting v1 chart when the first save happens before any load', async () => {
    h.store['birth-details:u1'] = JSON.stringify(v1)
    const list = await saveChart('u1', { id: 'n', name: 'New' }, { selfName: 'Sreeni' })
    expect(list.map((c) => c.name)).toEqual(['Sreeni', 'New'])
    expect(h.store['birth-details:u1']).toBeUndefined()
  })

  it('adds, replaces and deletes by id, per account', async () => {
    await saveChart('u1', { id: 'a', name: 'A' })
    await saveChart('u1', { id: 'b', name: 'B' })
    await saveChart('u2', { id: 'z', name: 'Z' })
    await saveChart('u1', { id: 'a', name: 'A2' })
    expect((await loadCharts('u1')).map((c) => c.name)).toEqual(['A2', 'B'])
    expect(await deleteChart('u1', 'a')).toEqual([{ id: 'b', name: 'B' }])
    expect(await loadCharts('u2')).toEqual([{ id: 'z', name: 'Z' }])
  })

  it('removes every chart for an account on account deletion, v1 key included', async () => {
    await saveChart('u1', { id: 'a', name: 'A' })
    h.store['birth-details:u1'] = JSON.stringify(v1)
    await saveChart('u2', { id: 'z', name: 'Z' })
    await deleteAllCharts('u1')
    expect(h.store['birth-charts:u1']).toBeUndefined()
    expect(h.store['birth-details:u1']).toBeUndefined()
    expect(await loadCharts('u2')).toEqual([{ id: 'z', name: 'Z' }])
  })

  it('treats unreadable storage as no charts', async () => {
    h.store['birth-charts:u1'] = '{not json'
    expect(await loadCharts('u1')).toEqual([])
  })
})
