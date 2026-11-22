import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const listeners = vi.hoisted(() => ({ appState: null }))
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' },
}))
vi.mock('@capacitor/app', () => ({
  App: { addListener: (event, cb) => { if (event === 'appStateChange') listeners.appState = cb; return Promise.resolve({ remove: () => {} }) } },
}))
const check = vi.hoisted(() => ({ fn: null }))
vi.mock('../../utils/appUpdate', () => ({ checkAppUpdate: (...a) => check.fn(...a) }))

import { startAppUpdateChecks, useAppUpdate, _resetAppUpdate } from '../useAppUpdate'
import { UpdateCard, UpdateRequired } from '../../components/UpdatePrompts'

const SUGGESTED = { status: 'suggested', installed: '1.5.0', target: '1.10.1', storeUrl: 'https://apps.apple.com/app/id6837318179', storeName: 'the App Store' }
const flush = () => act(() => new Promise((r) => setTimeout(r, 0)))

function Status() {
  const u = useAppUpdate()
  return <div data-testid="status">{u.status}</div>
}

beforeEach(() => {
  _resetAppUpdate()
  listeners.appState = null
  check.fn = vi.fn().mockResolvedValue({ status: 'ok' })
})

describe('useAppUpdate', () => {
  it('checks once at start-up and again when the app comes back to the foreground', async () => {
    check.fn.mockResolvedValueOnce({ status: 'ok' }).mockResolvedValueOnce({ ...SUGGESTED, status: 'required' })
    render(<Status />)
    startAppUpdateChecks()
    startAppUpdateChecks() // a second call is a no-op
    await flush()
    expect(check.fn).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('status').textContent).toBe('ok')
    await act(async () => { listeners.appState({ isActive: false }) })
    expect(check.fn).toHaveBeenCalledTimes(1)
    await act(async () => { listeners.appState({ isActive: true }) })
    await flush()
    expect(check.fn).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('status').textContent).toBe('required')
  })

  it('ignores a slower older answer that lands after a newer one', async () => {
    let resolveFirst
    check.fn
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockResolvedValueOnce({ status: 'ok' })
    render(<Status />)
    startAppUpdateChecks()
    await flush()
    await act(async () => { listeners.appState({ isActive: true }) })
    await flush()
    await act(async () => { resolveFirst({ ...SUGGESTED, status: 'required' }) })
    await flush()
    expect(screen.getByTestId('status').textContent).toBe('ok')
  })
})

describe('first check on start-up', () => {
  it('holds the app in "checking" until the first answer', async () => {
    let resolve
    check.fn.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
    render(<Status />)
    act(() => { startAppUpdateChecks() })
    expect(screen.getByTestId('status').textContent).toBe('checking')
    await act(async () => { resolve({ ...SUGGESTED, status: 'required' }) })
    await flush()
    expect(screen.getByTestId('status').textContent).toBe('required')
  })

  it('opens the app anyway after 3 s without an answer, and a late "required" still takes over', async () => {
    vi.useFakeTimers()
    try {
      let resolve
      check.fn.mockImplementationOnce(() => new Promise((r) => { resolve = r }))
      render(<Status />)
      act(() => { startAppUpdateChecks() })
      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(screen.getByTestId('status').textContent).toBe('ok')
      await act(async () => { resolve({ ...SUGGESTED, status: 'required' }) })
      expect(screen.getByTestId('status').textContent).toBe('required')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('UpdateCard', () => {
  it('shows the suggested update with the store link and hides it once dismissed', async () => {
    check.fn.mockResolvedValue(SUGGESTED)
    render(<UpdateCard />)
    startAppUpdateChecks()
    await flush()
    expect(screen.getByText('New version available')).toBeInTheDocument()
    expect(screen.getByText('Version 1.10.1 is ready. You have 1.5.0.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Update on the App Store' })).toHaveAttribute('href', SUGGESTED.storeUrl)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('New version available')).toBeNull()
    // still dismissed after a foreground re-check in the same session
    await act(async () => { listeners.appState({ isActive: true }) })
    await flush()
    expect(screen.queryByText('New version available')).toBeNull()
  })

  it('renders nothing when no update is suggested', async () => {
    const { container } = render(<UpdateCard />)
    startAppUpdateChecks()
    await flush()
    expect(container.innerHTML).toBe('')
  })
})

describe('UpdateRequired', () => {
  it('explains, shows both versions, links to the store and to support, with no dismiss', () => {
    render(<UpdateRequired update={{ ...SUGGESTED, status: 'required', storeName: 'Google Play', storeUrl: 'https://play.google.com/x' }} />)
    expect(screen.getByRole('heading', { name: 'Please update Nithyakarma' })).toBeInTheDocument()
    expect(screen.getByText('You have 1.5.0. Needed: 1.10.1 or later.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Update on Google Play' })).toHaveAttribute('href', 'https://play.google.com/x')
    expect(screen.getByRole('link', { name: /support@nithyakarma.org/ })).toHaveAttribute('href', 'mailto:support@nithyakarma.org')
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull()
  })
})
