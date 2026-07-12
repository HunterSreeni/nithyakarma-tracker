import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const profile = { referral_code: 'ref123', ad_free_until: null }
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ profile }),
}))
const showInterstitial = vi.fn().mockResolvedValue(true)
vi.mock('../../utils/ads', () => ({
  showInterstitial: (...a) => showInterstitial(...a),
}))
const shareToWhatsApp = vi.fn()
vi.mock('../../utils/share', () => ({
  shareToWhatsApp: (...a) => shareToWhatsApp(...a),
}))
vi.mock('../../utils/analytics', () => ({ track: vi.fn() }))
const maybeRequestReview = vi.fn().mockResolvedValue(false)
vi.mock('../../utils/review', () => ({
  isMilestone: (s) => [3, 7, 30, 100, 365].includes(s),
  maybeRequestReview: (...a) => maybeRequestReview(...a),
}))

import CelebrationModal from '../CelebrationModal'

const data = {
  saved: true, practice_name: 'Hanuman Chalisa', practice_done_today: true,
  day_complete: true, overall_streak: 48, tier: 'Tapasvi', subjectName: 'Sreeni H',
}

beforeEach(() => vi.clearAllMocks())

describe('CelebrationModal', () => {
  it('renders streak and share card from the verified server response', () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(screen.getByText('48 Day')).toBeInTheDocument()
    expect(screen.getByText(/Hanuman Chalisa completed/)).toBeInTheDocument()
    expect(screen.getByText('/r/ref123')).toBeInTheDocument()
  })

  it('celebrates without a day streak when the day is not complete', () => {
    render(<CelebrationModal data={{ ...data, day_complete: false }} onClose={() => {}} />)
    expect(screen.getByText('Completed!')).toBeInTheDocument()
  })

  it('fires the interstitial only on close, exactly once (celebrate -> share -> ad)', async () => {
    const onClose = vi.fn()
    render(<CelebrationModal data={data} onClose={onClose} />)
    expect(showInterstitial).not.toHaveBeenCalled() // never before/during celebration
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(showInterstitial).toHaveBeenCalledTimes(1)
    expect(showInterstitial).toHaveBeenCalledWith(profile)
  })

  it('at a streak milestone, requests a review instead of an ad (never both)', async () => {
    const onClose = vi.fn()
    maybeRequestReview.mockResolvedValueOnce(true)
    render(<CelebrationModal data={{ ...data, overall_streak: 7 }} onClose={onClose} />)
    fireEvent.click(screen.getByText('Continue'))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(maybeRequestReview).toHaveBeenCalledTimes(1)
    expect(showInterstitial).not.toHaveBeenCalled()
  })

  it('shares to WhatsApp with streak, practice, and referral code', () => {
    render(<CelebrationModal data={data} onClose={() => {}} />)
    fireEvent.click(screen.getByText('Share to WhatsApp'))
    expect(shareToWhatsApp).toHaveBeenCalledWith(expect.objectContaining({
      streak: 48, practiceName: 'Hanuman Chalisa', referralCode: 'ref123',
    }))
    expect(showInterstitial).not.toHaveBeenCalled() // sharing does not trigger the ad
  })

  it('shows the freeze message only when a freeze was used', () => {
    const { rerender } = render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(screen.queryByText(/A freeze saved your streak/)).not.toBeInTheDocument()
    rerender(<CelebrationModal data={{ ...data, freeze_used: true }} onClose={() => {}} />)
    expect(screen.getByText(/A freeze saved your streak/)).toBeInTheDocument()
  })
})
