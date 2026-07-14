import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  enabled: false, loading: false, error: '', testResult: '', supported: true,
}))
const toggle = vi.fn()
const sendTestNotification = vi.fn()
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ session: { user: { id: 'u1' } }, profile: { gender: 'male' } }),
}))
vi.mock('../../hooks/useNotifications', () => ({
  useNotifications: () => ({ ...h, toggle, sendTestNotification }),
}))

import NotificationSettings from '../NotificationSettings'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(h, { enabled: false, loading: false, error: '', testResult: '', supported: true })
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

  it('toggling the checkbox calls toggle', () => {
    render(<NotificationSettings />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(toggle).toHaveBeenCalled()
  })
})
