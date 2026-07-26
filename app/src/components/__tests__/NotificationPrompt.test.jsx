import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  enabled: false, tharpanamEnabled: false, observancesEnabled: false,
  error: '', testResult: '', supported: true,
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

import NotificationPrompt from '../NotificationPrompt'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(h, {
    enabled: false, tharpanamEnabled: false, observancesEnabled: false,
    error: '', testResult: '', supported: true,
  })
})

describe('NotificationPrompt', () => {
  it('shows gender-aware copy and an Enable button before enabling', () => {
    render(<NotificationPrompt onDone={() => {}} />)
    expect(screen.getByText('Turn on reminders?')).toBeInTheDocument()
    expect(screen.getByText(/Sandhya reminders/)).toBeInTheDocument()
    expect(screen.getByText('Enable notifications')).toBeInTheDocument()
    expect(screen.getByText('Maybe later')).toBeInTheDocument()
  })

  it('calls toggle when Enable notifications is clicked', () => {
    render(<NotificationPrompt onDone={() => {}} />)
    fireEvent.click(screen.getByText('Enable notifications'))
    expect(toggle).toHaveBeenCalled()
  })

  it('sends a test notification exactly once as soon as enabled flips true', async () => {
    const { rerender } = render(<NotificationPrompt onDone={() => {}} />)
    h.enabled = true
    rerender(<NotificationPrompt onDone={() => {}} />)
    await waitFor(() => expect(sendTestNotification).toHaveBeenCalledTimes(1))
    rerender(<NotificationPrompt onDone={() => {}} />)
    expect(sendTestNotification).toHaveBeenCalledTimes(1)
  })

  it('shows the success heading and test result once enabled', async () => {
    h.enabled = true
    h.testResult = 'Sent to 1 of 1 device.'
    render(<NotificationPrompt onDone={() => {}} />)
    expect(screen.getByText('Notifications enabled!')).toBeInTheDocument()
    expect(screen.getByText('Sent to 1 of 1 device.')).toBeInTheDocument()
    expect(screen.queryByText('Enable notifications')).not.toBeInTheDocument()
    expect(screen.getByText('Continue')).toBeInTheDocument()
  })

  it('shows an error banner without blocking Maybe later', () => {
    h.error = 'Notification permission was denied.'
    render(<NotificationPrompt onDone={() => {}} />)
    expect(screen.getByText('Notification permission was denied.')).toBeInTheDocument()
    expect(screen.getByText('Maybe later')).toBeInTheDocument()
  })

  it('hides the Enable button when push is unsupported, but Skip still works', () => {
    h.supported = false
    const onDone = vi.fn()
    render(<NotificationPrompt onDone={onDone} />)
    expect(screen.queryByText('Enable notifications')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Maybe later'))
    expect(onDone).toHaveBeenCalled()
  })

  it('calls onDone when Continue is clicked after enabling', () => {
    h.enabled = true
    const onDone = vi.fn()
    render(<NotificationPrompt onDone={onDone} />)
    fireEvent.click(screen.getByText('Continue'))
    expect(onDone).toHaveBeenCalled()
  })

  it('shows the Tharpanam and Auspicious-day checkboxes, disabled until enabled', () => {
    render(<NotificationPrompt onDone={() => {}} />)
    const tharpanam = screen.getByLabelText(/Tharpanam reminders/)
    const observances = screen.getByLabelText(/Auspicious-day reminders/)
    expect(tharpanam).toBeDisabled()
    expect(observances).toBeDisabled()
    expect(tharpanam).not.toBeChecked()
    expect(observances).not.toBeChecked()
  })

  it('enables the sub-toggles once notifications are enabled, and wires their onChange', () => {
    h.enabled = true
    render(<NotificationPrompt onDone={() => {}} />)
    const tharpanam = screen.getByLabelText(/Tharpanam reminders/)
    const observances = screen.getByLabelText(/Auspicious-day reminders/)
    expect(tharpanam).not.toBeDisabled()
    expect(observances).not.toBeDisabled()

    fireEvent.click(tharpanam)
    expect(toggleTharpanam).toHaveBeenCalledWith(true)
    fireEvent.click(observances)
    expect(toggleObservances).toHaveBeenCalledWith(true)
  })

  it('hides the reminder-category checkboxes when push is unsupported', () => {
    h.supported = false
    render(<NotificationPrompt onDone={() => {}} />)
    expect(screen.queryByText(/Tharpanam reminders/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Auspicious-day reminders/)).not.toBeInTheDocument()
  })
})
