import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GuidedTour, { tourSeen } from '../GuidedTour'

beforeEach(() => localStorage.clear())

describe('GuidedTour', () => {
  it('shows on first run and includes the sandhya step for male users', () => {
    render(<GuidedTour showSandhya={true} />)
    expect(screen.getByText('Namaskaram 🙏')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Next'))
    expect(screen.getByText('Sandhyavandhanam is three sandhyas')).toBeInTheDocument()
    expect(screen.getByText(/Prathakala.*Madhyanika.*Saayamkala/)).toBeInTheDocument()
  })

  it('omits the sandhya step when Sandhyavandhanam does not apply', () => {
    render(<GuidedTour showSandhya={false} />)
    fireEvent.click(screen.getByText('Next'))
    expect(screen.queryByText('Sandhyavandhanam is three sandhyas')).not.toBeInTheDocument()
    // straight to the final step
    expect(screen.getByText("You're all set")).toBeInTheDocument()
  })

  it('marks itself seen and closes on Begin, and never shows again', () => {
    const { unmount } = render(<GuidedTour showSandhya={false} />)
    fireEvent.click(screen.getByText('Next'))
    fireEvent.click(screen.getByText('Begin 🪔'))
    expect(tourSeen()).toBe(true)
    unmount()
    render(<GuidedTour showSandhya={false} />)
    expect(screen.queryByText('Namaskaram 🙏')).not.toBeInTheDocument()
  })

  it('Skip dismisses immediately and marks seen', () => {
    render(<GuidedTour showSandhya={true} />)
    fireEvent.click(screen.getByText('Skip'))
    expect(screen.queryByText('Namaskaram 🙏')).not.toBeInTheDocument()
    expect(tourSeen()).toBe(true)
  })
})
