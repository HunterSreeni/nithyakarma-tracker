import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import CopyLinkButton from '../CopyLinkButton'

beforeEach(() => {
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('CopyLinkButton', () => {
  it('copies the referral link built from the referral code', async () => {
    render(<CopyLinkButton referralCode="ref123" />)
    fireEvent.click(screen.getByText('Copy link'))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/r/ref123'),
      )
    })
  })

  it('shows a transient "Copied" confirmation, then reverts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<CopyLinkButton referralCode="ref123" />)
    fireEvent.click(screen.getByText('Copy link'))
    await waitFor(() => expect(screen.getByText('Copied')).toBeInTheDocument())
    vi.advanceTimersByTime(2000)
    await waitFor(() => expect(screen.getByText('Copy link')).toBeInTheDocument())
  })

  it('uses the outline variant class on a dark background', () => {
    render(<CopyLinkButton referralCode="ref123" variant="outline" />)
    expect(screen.getByRole('button')).toHaveClass('btn-ref-outline')
  })

  it('defaults to the secondary variant class', () => {
    render(<CopyLinkButton referralCode="ref123" />)
    expect(screen.getByRole('button')).toHaveClass('btn-secondary')
  })
})
