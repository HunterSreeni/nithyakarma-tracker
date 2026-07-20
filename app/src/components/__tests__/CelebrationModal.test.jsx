import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const profile = { referral_code: 'ref123', ad_free_until: null }
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile }),
}))
const shareCardToWhatsApp = vi.fn().mockResolvedValue(undefined)
vi.mock('../../utils/share', () => ({
  shareCardToWhatsApp: (...a) => shareCardToWhatsApp(...a),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))

import CelebrationModal from '../CelebrationModal'

const data = {
  saved: true, practice_name: 'Hanuman Chalisa', practice_done_today: true,
  day_complete: true, overall_streak: 48, tier: 'Yogi', subjectName: 'Sreeni H',
}

beforeEach(() => vi.clearAllMocks())

describe('CelebrationModal', () => {
  it('renders streak and share card from the verified server response', () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(screen.getByText('48 Days')).toBeInTheDocument()
    expect(screen.getByText(/Hanuman Chalisa completed/)).toBeInTheDocument()
  })

  it('does not show the referral code/link on the card itself (kept in the share caption instead)', () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(screen.queryByText(/ref123/)).not.toBeInTheDocument()
  })

  it('keeps "Day" singular at a streak of 1', () => {
    render(<CelebrationModal data={{ ...data, overall_streak: 1 }} onClose={() => {}} />)
    expect(screen.getByText('1 Day')).toBeInTheDocument()
  })

  it('celebrates without a day streak when the day is not complete', () => {
    render(<CelebrationModal data={{ ...data, day_complete: false }} onClose={() => {}} />)
    expect(screen.getByText('Completed!')).toBeInTheDocument()
  })

  it('Continue dismisses the modal (the ad already fired before this, in TodayPage)', async () => {
    const onClose = vi.fn()
    render(<CelebrationModal data={data} onClose={onClose} />)
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('shares the rendered card with streak and referral code', async () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Share to WhatsApp'))
    await waitFor(() => expect(shareCardToWhatsApp).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ streak: 48, referralCode: 'ref123' }),
    ))
  })

  it('shows "Preparing..." while the share is in flight, then resets', async () => {
    let resolveShare
    shareCardToWhatsApp.mockReturnValueOnce(new Promise(r => { resolveShare = r }))
    render(<CelebrationModal data={data} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Share to WhatsApp'))
    await waitFor(() => expect(screen.getByText('Preparing...')).toBeInTheDocument())
    resolveShare()
    await waitFor(() => expect(screen.getByText('Share to WhatsApp')).toBeInTheDocument())
  })

  it('swallows an AbortError from a cancelled native share sheet without surfacing an error', async () => {
    const abortErr = Object.assign(new Error('cancelled'), { name: 'AbortError' })
    shareCardToWhatsApp.mockRejectedValueOnce(abortErr)
    render(<CelebrationModal data={data} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Share to WhatsApp'))
    await waitFor(() => expect(screen.getByText('Share to WhatsApp')).toBeInTheDocument())
  })

  it('shows the freeze message only when a freeze was used', () => {
    const { rerender } = render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(screen.queryByText(/A freeze saved your streak/)).not.toBeInTheDocument()
    rerender(<CelebrationModal data={{ ...data, freeze_used: true }} onClose={() => {}} />)
    expect(screen.getByText(/A freeze saved your streak/)).toBeInTheDocument()
  })

  it('Escape dismisses the modal', async () => {
    const onClose = vi.fn()
    render(<CelebrationModal data={data} onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('moves focus into the modal on open and traps Tab within it', () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    const whatsapp = screen.getByText('Share to WhatsApp')
    const continueBtn = screen.getByText('Continue')
    expect(document.activeElement).toBe(whatsapp)
    continueBtn.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(whatsapp)
  })

  it('returns focus to the triggering element on close', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const { unmount } = render(<CelebrationModal data={data} onClose={() => {}} />)
    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
