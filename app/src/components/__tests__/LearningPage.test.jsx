import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ slug: 'hanuman-chalisa', verses: [], loading: false, error: '' }))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useParams: () => ({ slug: h.slug }) }
})
vi.mock('../../hooks/useLearning', () => ({
  useLearning: () => ({ verses: h.verses, loading: h.loading, error: h.error }),
}))

import LearningPage from '../LearningPage'

const VERSE = { id: 'doha-1', type: 'doha', english: 'english text', malayalam: 'malayalam text', sanskrit: 'sanskrit text' }

beforeEach(() => {
  vi.clearAllMocks()
  h.slug = 'hanuman-chalisa'
  h.verses = [VERSE]
  h.loading = false
  h.error = ''
})

describe('LearningPage - reading only, no per-verse marking', () => {
  it('shows English by default and switches script on language select', () => {
    render(<LearningPage />)
    expect(screen.getByText('english text')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Malayalam'))
    expect(screen.getByText('malayalam text')).toBeInTheDocument()
    expect(screen.queryByText('english text')).not.toBeInTheDocument()
  })

  it('has no "Mark Learned" button anywhere', () => {
    render(<LearningPage />)
    expect(screen.queryByText('Mark Learned')).not.toBeInTheDocument()
  })

  it('links out to YouTube', () => {
    render(<LearningPage />)
    const link = screen.getByText('Watch on YouTube').closest('a')
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=sX2bYV6nSy4')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('shows an error banner for a slug with no content mapping', () => {
    h.slug = 'not-a-real-slug'
    render(<LearningPage />)
    expect(screen.getByText("This learning content doesn't exist")).toBeInTheDocument()
  })
})

describe('LearningPage - Vishnu Sahasranamam has its own language set and video', () => {
  it('offers Tamil as a language and links its own video', async () => {
    h.slug = 'vishnu-sahasranamam'
    h.verses = [{ id: 'shloka-1', type: 'shloka', english: 'e', malayalam: 'm', tamil: 't', sanskrit: 's' }]
    render(<LearningPage />)
    fireEvent.click(screen.getByText('Tamil'))
    await waitFor(() => expect(screen.getByText('t')).toBeInTheDocument())
    expect(screen.getByText('Watch on YouTube').closest('a'))
      .toHaveAttribute('href', 'https://www.youtube.com/watch?v=5aHeprNOU3s')
  })
})
