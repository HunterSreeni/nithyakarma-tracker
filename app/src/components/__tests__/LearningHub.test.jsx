import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../hooks/useLearning', () => ({
  useLearning: () => ({ verses: [], loading: false, error: '' }),
}))

import LearningHub from '../LearningHub'

describe('LearningHub', () => {
  it('lists every learning-enabled practice, linking to its own reader route', () => {
    render(<MemoryRouter><LearningHub /></MemoryRouter>)
    expect(screen.getByText('Hanuman Chalisa').closest('a')).toHaveAttribute('href', '/learning/hanuman-chalisa')
    expect(screen.getByText('Vishnu Sahasranamam').closest('a')).toHaveAttribute('href', '/learning/vishnu-sahasranamam')
    expect(screen.getByText('Ramayanam').closest('a')).toHaveAttribute('href', '/learning/ramayanam')
    expect(screen.getByText('Sai Baba Aarti').closest('a')).toHaveAttribute('href', '/learning/sai-baba-aarti')
    expect(screen.getByText('Lalitha Sahasranamam').closest('a')).toHaveAttribute('href', '/learning/lalitha-sahasranamam')
    expect(screen.getByText('Soundarya Lahari').closest('a')).toHaveAttribute('href', '/learning/soundarya-lahari')
    expect(screen.getByText('Devi Mahatmyam').closest('a')).toHaveAttribute('href', '/learning/devi-mahatmyam')
  })
})
