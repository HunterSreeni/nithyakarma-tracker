import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ ups: [], logs: [], failNext: false }))

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
  },
}))

import { useToday } from '../useToday'

beforeEach(() => {
  h.ups = []; h.logs = []; h.failNext = false
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
