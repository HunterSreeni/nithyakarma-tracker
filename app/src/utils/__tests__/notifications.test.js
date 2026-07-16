import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

const local = {
  requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  schedule: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
  getPending: vi.fn().mockResolvedValue({ notifications: [] }),
}
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: local }))

import { scheduleAllReminders, cancelAllReminders, suppressTodayNudgesIfScheduled } from '../notifications'

beforeEach(() => {
  vi.clearAllMocks()
  local.requestPermissions.mockResolvedValue({ display: 'granted' })
  local.getPending.mockResolvedValue({ notifications: [] })
})

describe('scheduleAllReminders', () => {
  it('is a silent no-op on web (notifications are Android-only in v1)', async () => {
    mockNative.mockReturnValue(false)
    const ok = await scheduleAllReminders({ includeSandhya: true })
    expect(ok).toBe(false)
    expect(local.schedule).not.toHaveBeenCalled()
  })

  it('schedules 3 sandhya slots + nudge + last-call for male users', async () => {
    mockNative.mockReturnValue(true)
    const ok = await scheduleAllReminders({ includeSandhya: true })
    expect(ok).toBe(true)
    const { notifications } = local.schedule.mock.calls[0][0]
    expect(notifications.map(n => n.id).sort()).toEqual([100, 200, 300, 400, 500])
    const at = Object.fromEntries(notifications.map(n => [n.id, n.schedule.at]))
    expect([at[100].getHours(), at[100].getMinutes()]).toEqual([9, 0])   // Prathakala
    expect([at[200].getHours(), at[200].getMinutes()]).toEqual([12, 30]) // Madhyanika
    expect([at[300].getHours(), at[300].getMinutes()]).toEqual([18, 30]) // Saayamkala
    expect(notifications.find(n => n.id === 100).title).toMatch(/Prathakala/)
    expect(notifications.find(n => n.id === 300).title).toMatch(/Saayamkala/)
    for (const n of notifications) expect(n.schedule.every).toBe('day')
  })

  it('schedules only streak nudge + last-call when sandhya excluded (female users)', async () => {
    mockNative.mockReturnValue(true)
    await scheduleAllReminders({ includeSandhya: false })
    const { notifications } = local.schedule.mock.calls[0][0]
    expect(notifications.map(n => n.id).sort()).toEqual([400, 500])
  })

  it('respects denied notification permission', async () => {
    mockNative.mockReturnValue(true)
    local.requestPermissions.mockResolvedValue({ display: 'denied' })
    const ok = await scheduleAllReminders({ includeSandhya: true })
    expect(ok).toBe(false)
    expect(local.schedule).not.toHaveBeenCalled()
  })

  it('always schedules for a future time (next day if slot passed)', async () => {
    mockNative.mockReturnValue(true)
    await scheduleAllReminders({ includeSandhya: true })
    const { notifications } = local.schedule.mock.calls[0][0]
    const now = new Date()
    for (const n of notifications) expect(n.schedule.at > now).toBe(true)
  })
})

describe('cancelAllReminders', () => {
  it('cancels all 5 reminder ids on native', async () => {
    mockNative.mockReturnValue(true)
    await cancelAllReminders()
    expect(local.cancel).toHaveBeenCalledWith({
      notifications: [100, 200, 300, 400, 500].map(id => ({ id })),
    })
  })
  it('no-ops on web', async () => {
    mockNative.mockReturnValue(false)
    await cancelAllReminders()
    expect(local.cancel).not.toHaveBeenCalled()
  })
})

describe('suppressTodayNudgesIfScheduled', () => {
  it('no-ops when notifications were never enabled (nothing pending)', async () => {
    mockNative.mockReturnValue(true)
    local.getPending.mockResolvedValue({ notifications: [{ id: 100 }, { id: 200 }, { id: 300 }] })
    await suppressTodayNudgesIfScheduled()
    expect(local.cancel).not.toHaveBeenCalled()
    expect(local.schedule).not.toHaveBeenCalled()
  })

  it('no-ops on web', async () => {
    mockNative.mockReturnValue(false)
    await suppressTodayNudgesIfScheduled()
    expect(local.getPending).not.toHaveBeenCalled()
  })

  it('cancels and reschedules NUDGE + LAST_CALL for tomorrow, same time-of-day, when pending', async () => {
    mockNative.mockReturnValue(true)
    local.getPending.mockResolvedValue({ notifications: [{ id: 400 }, { id: 500 }] })
    await suppressTodayNudgesIfScheduled()

    expect(local.cancel).toHaveBeenCalledWith({ notifications: [{ id: 400 }, { id: 500 }] })

    const { notifications } = local.schedule.mock.calls[0][0]
    expect(notifications.map(n => n.id).sort()).toEqual([400, 500])
    const at = Object.fromEntries(notifications.map(n => [n.id, n.schedule.at]))
    expect([at[400].getHours(), at[400].getMinutes()]).toEqual([20, 0])
    expect([at[500].getHours(), at[500].getMinutes()]).toEqual([21, 30])
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
    expect(at[400].getDate()).toBe(tomorrow.getDate())
    for (const n of notifications) expect(n.schedule.every).toBe('day')
  })

  it('only reschedules NUDGE if only NUDGE is pending (sandhya-only user with just the nudge on)', async () => {
    mockNative.mockReturnValue(true)
    local.getPending.mockResolvedValue({ notifications: [{ id: 400 }] })
    await suppressTodayNudgesIfScheduled()
    expect(local.cancel).toHaveBeenCalledWith({ notifications: [{ id: 400 }, { id: 500 }] })
    const { notifications } = local.schedule.mock.calls[0][0]
    expect(notifications.map(n => n.id).sort()).toEqual([400, 500])
  })
})
