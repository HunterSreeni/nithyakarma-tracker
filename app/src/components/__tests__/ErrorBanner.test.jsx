import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorBanner from '../ErrorBanner'

describe('ErrorBanner', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<ErrorBanner message="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the message and no Retry button when onRetry is not given', () => {
    render(<ErrorBanner message="Something went wrong." />)
    expect(screen.getByText('Something went wrong.')).toBeInTheDocument()
    expect(screen.queryByText('Retry')).not.toBeInTheDocument()
  })

  it('calls onRetry when the Retry button is clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorBanner message="Could not load." onRetry={onRetry} />)
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })
})
