import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ row: null }))

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: h.row }) }) }),
    })),
  },
}))

import { usePanchangam } from '../usePanchangam'

beforeEach(() => { h.row = null })

describe('usePanchangam', () => {
  it('resolves loading=false with null when no row exists for today', async () => {
    const { result } = renderHook(() => usePanchangam())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.day).toBeNull()
  })

  it('resolves with the row when one exists for today', async () => {
    h.row = { date: '2026-07-16', varsham_name: 'Parabhava', thithi: 'Shukla Tritiya' }
    const { result } = renderHook(() => usePanchangam())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.day).toEqual(h.row)
  })
})
