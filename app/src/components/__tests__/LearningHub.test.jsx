import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LearningHub from '../LearningHub'

describe('LearningHub', () => {
  it('lists every learning-enabled practice, linking to its own reader route', () => {
    render(<MemoryRouter><LearningHub /></MemoryRouter>)
    expect(screen.getByText('Hanuman Chalisa').closest('a')).toHaveAttribute('href', '/learning/hanuman-chalisa')
    expect(screen.getByText('Vishnu Sahasranamam').closest('a')).toHaveAttribute('href', '/learning/vishnu-sahasranamam')
  })
})
