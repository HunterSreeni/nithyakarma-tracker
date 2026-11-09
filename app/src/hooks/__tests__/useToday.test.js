import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ ups: [], logs: [], failNext: false, rpcResult: null, existing: null, isCalls: [], inserts: [] }))

function chain(resolveValue, shouldFail) {
  const b = {
    select: () => b, eq: () => b, in: () => b,
    is: (col, val) => { h.isCalls.push([col, val]); return b },
    maybeSingle: () => chain({ data: h.existing }, false),
    insert: (row) => { h.inserts.push(row); return chain({ data: null, error: null }, false) },
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
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

beforeEach(() => {
  queryClient.clear()
  h.ups = []; h.logs = []; h.failNext = false; h.rpcResult = null
  h.existing = null; h.isCalls = []; h.inserts = []
  supabase.rpc.mockClear()
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

describe('useToday submit - awardStreak passthrough', () => {
  it('defaults p_award_streak to true when not specified', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: true }, error: null }
    await result.current.submit('up1', { slot: 'morning' })
    expect(supabase.rpc).toHaveBeenCalledWith('submit_practice_log', expect.objectContaining({ p_award_streak: true }))
  })

  it('passes p_award_streak: false through when awardStreak is disabled', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    h.rpcResult = { data: { saved: true }, error: null }
    await result.current.submit('up1', { awardStreak: false })
    expect(supabase.rpc).toHaveBeenCalledWith('submit_practice_log', expect.objectContaining({ p_award_streak: false }))
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

describe('useToday remove / re-add (soft archive)', () => {
  it('only loads practices that are not removed', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(h.isCalls).toContainEqual(['archived_at', null])
  })

  it('removePractice archives through the RPC (never a hard delete that would cascade logs)', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    h.rpcResult = { data: null, error: null }
    await result.current.removePractice('up7')
    expect(supabase.rpc).toHaveBeenCalledWith('set_practice_archived', { p_user_practice_id: 'up7', p_archived: true })
  })

  it('re-adding a removed practice restores the same row instead of inserting a duplicate', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    h.existing = { id: 'up7', archived_at: '2026-11-01T00:00:00Z' }
    h.rpcResult = { data: null, error: null }
    await result.current.addPractice(5)
    expect(supabase.rpc).toHaveBeenCalledWith('set_practice_archived', { p_user_practice_id: 'up7', p_archived: false })
    expect(h.inserts).toEqual([])
  })

  it('adding a never-added practice inserts it', async () => {
    const { result } = renderHook(() => useToday('owner1', 'fm1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await result.current.addPractice(5)
    expect(h.inserts).toEqual([{ owner_id: 'owner1', family_member_id: 'fm1', practice_id: 5 }])
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('adding a practice that is already active (e.g. weekly, off-day) neither inserts nor restores', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    h.existing = { id: 'up8', archived_at: null }
    await result.current.addPractice(6)
    expect(h.inserts).toEqual([])
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('surfaces a restore rejected by the eligibility gate', async () => {
    const { result } = renderHook(() => useToday('owner1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    h.existing = { id: 'up9', archived_at: '2026-11-01T00:00:00Z' }
    h.rpcResult = { data: null, error: new Error('Samidhadhanam is available for unmarried male users only') }
    await expect(result.current.addPractice(7)).rejects.toThrow(/unmarried/)
  })
})
