import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({ numPages: 2, rejectWith: null }))

vi.mock('pdfjs-dist', () => {
  const page = {
    getViewport: ({ scale = 1 } = {}) => ({ width: 100 * scale, height: 140 * scale }),
    render: () => ({ promise: Promise.resolve() }),
  }
  return {
    GlobalWorkerOptions: {},
    getDocument: () => ({
      promise: h.rejectWith
        ? Promise.reject(h.rejectWith)
        : Promise.resolve({ numPages: h.numPages, getPage: () => Promise.resolve(page) }),
    }),
  }
})

import PdfViewer from '../PdfViewer'

describe('PdfViewer', () => {
  it('renders one canvas per page and clears the loading state', async () => {
    h.numPages = 3
    h.rejectWith = null
    const { container } = render(<PdfViewer src="https://example.com/a.pdf" title="Sarga 1" />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(3))
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('shows an error banner when the PDF fails to load', async () => {
    h.numPages = 1
    h.rejectWith = new Error('network error')
    render(<PdfViewer src="https://example.com/bad.pdf" title="Sarga 1" />)
    await waitFor(() => expect(screen.getByText('Could not load this page.')).toBeInTheDocument())
  })

  it('re-renders from scratch when the src changes', async () => {
    h.numPages = 2
    h.rejectWith = null
    const { container, rerender } = render(<PdfViewer src="https://example.com/a.pdf" title="Sarga 1" />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(2))

    h.numPages = 1
    rerender(<PdfViewer src="https://example.com/b.pdf" title="Sarga 2" />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
  })
})
