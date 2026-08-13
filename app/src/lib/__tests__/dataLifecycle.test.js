import { beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  appStateCallback: null,
  networkCallback: null,
  connected: true,
  getSession: vi.fn(),
  startAutoRefresh: vi.fn(),
  stopAutoRefresh: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event, callback) => {
      if (event === 'appStateChange') h.appStateCallback = callback
      return Promise.resolve({ remove: vi.fn() })
    }),
  },
}))
vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn(() => Promise.resolve({ connected: h.connected, connectionType: 'wifi' })),
    addListener: vi.fn((_event, callback) => {
      h.networkCallback = callback
      return Promise.resolve({ remove: vi.fn() })
    }),
  },
}))
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => h.getSession(...args),
      startAutoRefresh: (...args) => h.startAutoRefresh(...args),
      stopAutoRefresh: (...args) => h.stopAutoRefresh(...args),
    },
  },
}))

import { getDataLifecycleSnapshot, recoverDataSession, setupDataLifecycle } from '../dataLifecycle'
import { withDeadline } from '../queryClient'

beforeEach(() => {
  h.connected = true
  h.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null })
  h.startAutoRefresh.mockClear()
  h.stopAutoRefresh.mockClear()
})

describe('mobile data lifecycle', () => {
  it('stops refresh in the background and performs one bounded recovery when active', async () => {
    const cleanup = setupDataLifecycle()
    await waitFor(() => expect(h.appStateCallback).toBeTypeOf('function'))

    h.appStateCallback({ isActive: false })
    expect(h.stopAutoRefresh).toHaveBeenCalledOnce()
    expect(getDataLifecycleSnapshot().status).toBe('background')

    h.appStateCallback({ isActive: true })
    await waitFor(() => expect(getDataLifecycleSnapshot().status).toBe('ready'))
    expect(h.startAutoRefresh).toHaveBeenCalledOnce()
    expect(h.getSession).toHaveBeenCalledOnce()

    h.networkCallback({ connected: false, connectionType: 'none' })
    expect(getDataLifecycleSnapshot().status).toBe('offline')
    h.networkCallback({ connected: true, connectionType: 'cellular' })
    await waitFor(() => expect(h.getSession).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(getDataLifecycleSnapshot().status).toBe('ready'))
    cleanup()
  })

  it('coalesces simultaneous foreground recovery requests', async () => {
    let resolveSession
    h.getSession.mockReturnValue(new Promise(resolve => { resolveSession = resolve }))
    const first = recoverDataSession({ invalidate: false })
    const second = recoverDataSession({ invalidate: false })
    expect(second).toBe(first)
    await waitFor(() => expect(h.getSession).toHaveBeenCalledOnce())
    resolveSession({ data: { session: { user: { id: 'u1' } } }, error: null })
    await expect(first).resolves.toMatchObject({ data: { session: { user: { id: 'u1' } } } })
  })
})

describe('operation deadline', () => {
  it('times out work that stalls before fetch is ever created', async () => {
    await expect(withDeadline(new Promise(() => {}), 'Locked query', 5))
      .rejects.toMatchObject({ name: 'TimeoutError' })
  })
})
