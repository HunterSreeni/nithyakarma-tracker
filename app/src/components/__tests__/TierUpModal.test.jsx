import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const celebrationHaptic = vi.fn()
vi.mock('../../utils/haptics', () => ({ celebrationHaptic: (...a) => celebrationHaptic(...a) }))

import TierUpModal from '../TierUpModal'

beforeEach(() => vi.clearAllMocks())

describe('TierUpModal', () => {
  it('fires the native haptic exactly once when it opens', () => {
    const { rerender } = render(<TierUpModal tier="Yogi" onClose={() => {}} />)
    rerender(<TierUpModal tier="Yogi" onClose={() => {}} />)
    expect(celebrationHaptic).toHaveBeenCalledTimes(1)
  })

  it('shows the tier and its message', () => {
    render(<TierUpModal tier="Rishi" onClose={() => {}} />)
    expect(screen.getByText('Rishi')).toBeInTheDocument()
    expect(screen.getByText('Rare devotion. You are walking the path of the sages.')).toBeInTheDocument()
  })

  it('falls back to a generic message for a tier without one', () => {
    render(<TierUpModal tier="Shishya" onClose={() => {}} />)
    expect(screen.getByText('Your punya keeps growing. Keep at it.')).toBeInTheDocument()
  })

  it('closes on Continue, Escape and the backdrop, but not on a click inside', () => {
    const onClose = vi.fn()
    const { container } = render(<TierUpModal tier="Yogi" onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(container.querySelector('.modal-dim'))
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
