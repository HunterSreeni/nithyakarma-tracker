import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  identifyUser: vi.fn(), resetAnalytics: vi.fn(), registerOnce: vi.fn(), attr: {},
}))
vi.mock('../../lib/posthog', () => ({
  identifyUser: (...a) => h.identifyUser(...a),
  resetAnalytics: (...a) => h.resetAnalytics(...a),
  registerOnce: (...a) => h.registerOnce(...a),
}))
vi.mock('../../utils/installReferrer', () => ({ getInstallAttribution: async () => h.attr }))

import { useAnalyticsIdentity } from '../useAnalyticsIdentity'

const session = (id, email = `${id}@x.com`) => ({ user: { id, email } })

beforeEach(() => { vi.clearAllMocks(); h.attr = {} })

describe('useAnalyticsIdentity', () => {
  it('does nothing while signed out from the start', async () => {
    renderHook(() => useAnalyticsIdentity(null))
    await new Promise(r => setTimeout(r, 0))
    expect(h.identifyUser).not.toHaveBeenCalled()
    expect(h.resetAnalytics).not.toHaveBeenCalled()
  })

  it('identifies on sign-in and attaches install attribution once', async () => {
    h.attr = { install_utm_source: 'ig' }
    renderHook(() => useAnalyticsIdentity(session('u1')))
    await waitFor(() => expect(h.identifyUser).toHaveBeenCalledWith({ id: 'u1', email: 'u1@x.com' }, { install_utm_source: 'ig' }))
    expect(h.registerOnce).toHaveBeenCalledWith({ install_utm_source: 'ig' })
  })

  it('skips register_once when there is no install attribution', async () => {
    renderHook(() => useAnalyticsIdentity(session('u1')))
    await waitFor(() => expect(h.identifyUser).toHaveBeenCalled())
    expect(h.registerOnce).not.toHaveBeenCalled()
  })

  it('resets on sign-out and re-identifies the next account', async () => {
    const { rerender } = renderHook(({ s }) => useAnalyticsIdentity(s), { initialProps: { s: session('u1') } })
    await waitFor(() => expect(h.identifyUser).toHaveBeenCalledTimes(1))
    rerender({ s: null })
    expect(h.resetAnalytics).toHaveBeenCalledTimes(1)
    rerender({ s: session('u2') })
    await waitFor(() => expect(h.identifyUser).toHaveBeenLastCalledWith({ id: 'u2', email: 'u2@x.com' }, {}))
  })

  it('does not re-identify on a re-render with the same user', async () => {
    const { rerender } = renderHook(({ s }) => useAnalyticsIdentity(s), { initialProps: { s: session('u1') } })
    await waitFor(() => expect(h.identifyUser).toHaveBeenCalledTimes(1))
    rerender({ s: session('u1') })
    await new Promise(r => setTimeout(r, 0))
    expect(h.identifyUser).toHaveBeenCalledTimes(1)
  })
})
