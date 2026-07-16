import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ ups: [], logs: [], failNext: false, rpcResult: null }))

function chain(resolveValue, shouldFail) {
  const b = {
    select: () => b, eq: () => b, is: () => b, in: () => b,
    then: (resolve, reject) => {
      if (shouldFail) return Promise.reject(new Error('network error')).then(resolve, reject)
      return Promise.resolve(resolveValue).then(resolve, reject)
    },
  }
  return b
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'user_practices') return chain({ data: h.ups }, h.failNext)
      if (table === 'practice_logs') return chain({ data: h.logs }, false)
      return chain({ data: [] }, false)
    }),
    rpc: vi.fn(() => Promise.resolve(h.rpcResult)),
  },
}))

const suppressTodayNudgesIfScheduled = vi.fn().mockResolvedValue(undefined)
vi.mock('../../utils/notifications', () => ({
  suppressTodayNudgesIfScheduled: (...a) => suppressTodayNudgesIfScheduled(...a),
}))

import { useToday } from '../useToday'

beforeEach(() => {
  h.ups = []; h.logs = []; h.failNext = false; h.rpcResult = null
  suppressTodayNudgesIfScheduled.mockClear()
})

describe('useToday loading', () => {
  it('resolves loading=false with items on success', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('')
    expect(result.current.items).toEqual([])
  })

  it('resolves loading=false with a friendly error instead of hanging when the fetch fails', async () => {
    h.failNext = true
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBe('')
  })

  it('reload() recovers after a failure', async () => {
    h.failNext = true
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBe('')
    h.failNext = false
    await result.current.reload()
    await waitFor(() => expect(result.current.error).toBe(''))
  })
})

describe('useToday submit - celebration only from a verified RPC response', () => {
  it('resolves with the server data when the RPC confirms saved:true', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: true, practice_streak: 1, punya: 15 }, error: null }
    const data = await result.current.submit('up1', { slot: 'morning' })
    expect(data).toEqual({ saved: true, practice_streak: 1, punya: 15 })
  })

  it('rejects and never returns data when the RPC call errors', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: null, error: new Error('rpc failed') }
    await expect(result.current.submit('up1', { slot: 'morning' })).rejects.toThrow('rpc failed')
  })

  it('rejects when the RPC resolves without error but saved is not true', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: false }, error: null }
    await expect(result.current.submit('up1', { slot: 'morning' })).rejects.toThrow('Save could not be verified')
  })
})

describe('useToday submit - suppresses today\'s local nudge once the day completes', () => {
  it('suppresses the local nudge when the RPC reports day_complete: true', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: true, day_complete: true }, error: null }
    await result.current.submit('up1')
    expect(suppressTodayNudgesIfScheduled).toHaveBeenCalled()
  })

  it('does not touch local nudges when the day is not yet complete', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: true, day_complete: false }, error: null }
    await result.current.submit('up1')
    expect(suppressTodayNudgesIfScheduled).not.toHaveBeenCalled()
  })
})
