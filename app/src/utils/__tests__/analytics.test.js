import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn().mockResolvedValue({ error: null })
const getSession = vi.fn()
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => getSession() },
    from: () => ({ insert }),
  },
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

import { track } from '../analytics'

beforeEach(() => vi.clearAllMocks())

describe('track', () => {
  it('inserts the event for a signed-in user with no PII', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } })
    await track('practice_marked', { day_complete: true, overall_streak: 6 })
    expect(insert).toHaveBeenCalledWith({
      user_id: 'u-1',
      event: 'practice_marked',
      props: { day_complete: true, overall_streak: 6 },
      platform: 'web',
    })
    // guard against accidental PII leakage in the payload
    const payload = JSON.stringify(insert.mock.calls[0][0])
    expect(payload).not.toMatch(/@|display_name|email|name/i)
  })

  it('is a no-op when no session (never inserts anonymously)', async () => {
    getSession.mockResolvedValue({ data: { session: null } })
    await track('practice_marked', { day_complete: true })
    expect(insert).not.toHaveBeenCalled()
  })

  it('never throws if the insert fails', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u-1' } } } })
    insert.mockRejectedValueOnce(new Error('network'))
    await expect(track('share_clicked', { from: 'profile' })).resolves.toBeUndefined()
  })
})
