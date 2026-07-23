import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  enabled: false, tharpanamEnabled: false, observancesEnabled: false,
  loading: false, error: '', testResult: '', supported: true,
}))
const toggle = vi.fn()
const toggleTharpanam = vi.fn()
const toggleObservances = vi.fn()
const sendTestNotification = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, profile: { gender: 'male' } }),
}))
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ ...h, toggle, toggleTharpanam, toggleObservances, sendTestNotification }),
}))

import NotificationSettings from '../NotificationSettings'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(h, {
    enabled: false, tharpanamEnabled: false, observancesEnabled: false,
    loading: false, error: '', testResult: '', supported: true,
  })
})

describe('NotificationSettings', () => {
  it('shows an unsupported message instead of the controls when push is unsupported', () => {
    h.supported = false
    render(<NotificationSettings />)
    expect(screen.getByText(/not supported in this browser/)).toBeInTheDocument()
    expect(screen.queryByText('Send test notification')).not.toBeInTheDocument()
  })

  it('calls sendTestNotification when the test button is clicked', () => {
    render(<NotificationSettings />)
    fireEvent.click(screen.getByText('Send test notification'))
    expect(sendTestNotification).toHaveBeenCalled()
  })

  it('shows the test result once it comes back', async () => {
    const { rerender } = render(<NotificationSettings />)
    h.testResult = 'Sent to 1 of 1 device.'
    rerender(<NotificationSettings />)
    await waitFor(() => expect(screen.getByText('Sent to 1 of 1 device.')).toBeInTheDocument())
  })

  it('shows an error banner when present (e.g. no active subscription)', async () => {
    const { rerender } = render(<NotificationSettings />)
    h.error = 'No active notification subscription found. Enable notifications first.'
    rerender(<NotificationSettings />)
    await waitFor(() => expect(screen.getByText(/No active notification subscription/)).toBeInTheDocument())
  })

  it('toggling the master checkbox calls toggle', () => {
    render(<NotificationSettings />)
    fireEvent.click(screen.getByText('Reminder notifications').closest('label').querySelector('input'))
    expect(toggle).toHaveBeenCalled()
  })

  it('tharpanam and observance checkboxes are disabled when the master toggle is off', () => {
    h.enabled = false
    render(<NotificationSettings />)
    expect(screen.getByText(/Tharpanam reminders/).closest('label').querySelector('input')).toBeDisabled()
    expect(screen.getByText(/Auspicious-day reminders/).closest('label').querySelector('input')).toBeDisabled()
  })

  it('tharpanam and observance checkboxes are enabled and toggle independently when the master toggle is on', () => {
    h.enabled = true
    render(<NotificationSettings />)
    const tharpanamBox = screen.getByText(/Tharpanam reminders/).closest('label').querySelector('input')
    const observancesBox = screen.getByText(/Auspicious-day reminders/).closest('label').querySelector('input')
    expect(tharpanamBox).not.toBeDisabled()
    expect(observancesBox).not.toBeDisabled()
    fireEvent.click(tharpanamBox)
    expect(toggleTharpanam).toHaveBeenCalledWith(true)
    fireEvent.click(observancesBox)
    expect(toggleObservances).toHaveBeenCalledWith(true)
  })
})
