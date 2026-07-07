import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNative = vi.fn()
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => mockNative() },
}))

const local = {
  requestPermissions: vi.fn().mockResolvedValue({ display: 'granted' }),
  schedule: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: local }))

import { scheduleAllReminders, cancelAllReminders } from '../notifications'

beforeEach(() => {
  vi.clearAllMocks()
  local.requestPermissions.mockResolvedValue({ display: 'granted' })
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
