import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/learning-content/${path}` } }) }),
    },
  },
}))

import { useLearning } from '../useLearning'

const VERSES = [{ id: 'doha-1', type: 'doha', english: 'e1', malayalam: 'm1', sanskrit: 's1' }]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  // loadContent reads the body as text so it can compare against the cached copy
  // byte for byte and skip a pointless re-render when the file has not changed.
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    text: () => Promise.resolve(JSON.stringify(VERSES)),
  }))
})

describe('useLearning content loading', () => {
  it('fetches content and caches it in localStorage', async () => {
    const { result } = renderHook(() => useLearning('hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.verses).toEqual(VERSES)
    expect(fetch).toHaveBeenCalledWith(
      'https://cdn.test/learning-content/hanuman-chalisa.json', { cache: 'no-cache' })
    expect(JSON.parse(localStorage.getItem('nk_learning_content_hanuman-chalisa'))).toEqual(VERSES)
  })

  it('paints from cache immediately and still revalidates', async () => {
    // This previously asserted `expect(fetch).not.toHaveBeenCalled()` - a cached
    // copy was treated as permanent, so a corrected stotram never reached anyone
    // who had already loaded the old one. Cache-first is still the render path;
    // the fetch behind it is what makes corrections land.
    localStorage.setItem('nk_learning_content_hanuman-chalisa', JSON.stringify(VERSES))
    const { result } = renderHook(() => useLearning('hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.verses).toEqual(VERSES)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
  })

  it('picks up corrected content and rewrites the cache', async () => {
    const STALE = [{ id: 'doha-1', type: 'doha', english: 'old text', malayalam: 'm1', sanskrit: 's1' }]
    localStorage.setItem('nk_learning_content_hanuman-chalisa', JSON.stringify(STALE))
    const { result } = renderHook(() => useLearning('hanuman-chalisa'))
    await waitFor(() => expect(result.current.verses).toEqual(VERSES))
    expect(JSON.parse(localStorage.getItem('nk_learning_content_hanuman-chalisa'))).toEqual(VERSES)
  })

  it('keeps showing cached content when revalidation fails', async () => {
    localStorage.setItem('nk_learning_content_hanuman-chalisa', JSON.stringify(VERSES))
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    const { result } = renderHook(() => useLearning('hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.verses).toEqual(VERSES)
    expect(result.current.error).toBe('')
  })

  it('surfaces a friendly error when the fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }))
    const { result } = renderHook(() => useLearning('hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBe('')
  })

  it('loads different content when the slug changes', async () => {
    const { result, rerender } = renderHook(({ slug }) => useLearning(slug), {
      initialProps: { slug: 'hanuman-chalisa' },
    })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ slug: 'vishnu-sahasranamam' })
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      'https://cdn.test/learning-content/vishnu-sahasranamam.json', { cache: 'no-cache' }))
  })
})
