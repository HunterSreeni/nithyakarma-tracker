import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ progressRows: [], insertError: null }))

function progressChain() {
  const b = {
    select: () => b, eq: () => b, is: () => b,
    then: (resolve, reject) => Promise.resolve({ data: h.progressRows }).then(resolve, reject),
  }
  return b
}

const insertMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table) => {
      if (table === 'learning_progress') {
        return { ...progressChain(), insert: (...a) => insertMock(...a) }
      }
      return progressChain()
    }),
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
  h.progressRows = []
  h.insertError = null
  insertMock.mockImplementation(() => Promise.resolve({ error: h.insertError }))
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(VERSES) }))
})

describe('useLearning content loading', () => {
  it('fetches content and caches it in localStorage', async () => {
    const { result } = renderHook(() => useLearning('owner1', null, 'hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.verses).toEqual(VERSES)
    expect(fetch).toHaveBeenCalledWith('https://cdn.test/learning-content/hanuman-chalisa.json')
    expect(JSON.parse(localStorage.getItem('nk_learning_content_hanuman-chalisa'))).toEqual(VERSES)
  })

  it('serves from cache on a later mount without re-fetching', async () => {
    localStorage.setItem('nk_learning_content_hanuman-chalisa', JSON.stringify(VERSES))
    const { result } = renderHook(() => useLearning('owner1', null, 'hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.verses).toEqual(VERSES)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('surfaces a friendly error when the fetch fails', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false }))
    const { result } = renderHook(() => useLearning('owner1', null, 'hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).not.toBe('')
  })
})

describe('useLearning progress', () => {
  it('marks a verse learned and reflects it in the learned set', async () => {
    const { result } = renderHook(() => useLearning('owner1', null, 'hanuman-chalisa'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const wasNew = await result.current.markLearned('doha-1')
    expect(wasNew).toBe(true)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      owner_id: 'owner1', family_member_id: null, content_slug: 'hanuman-chalisa', verse_id: 'doha-1',
    }))
    await waitFor(() => expect(result.current.learned.has('doha-1')).toBe(true))
  })

  it('is a no-op and does not insert when the verse is already learned', async () => {
    h.progressRows = [{ verse_id: 'doha-1' }]
    const { result } = renderHook(() => useLearning('owner1', null, 'hanuman-chalisa'))
    await waitFor(() => expect(result.current.learned.has('doha-1')).toBe(true))

    const wasNew = await result.current.markLearned('doha-1')
    expect(wasNew).toBe(false)
    expect(insertMock).not.toHaveBeenCalled()
  })
})
