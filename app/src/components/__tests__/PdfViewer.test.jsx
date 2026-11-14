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

class FakeWorker { static created = 0; constructor() { FakeWorker.created++ } }
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?worker', () => ({ default: FakeWorker }))

import PdfViewer, { isOldEngineError, WEBVIEW_STORE_URL } from '../PdfViewer'
import * as pdfjsLib from 'pdfjs-dist'

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

  it('hands pdf.js one bundled worker (not a copied ?url file), shared across renders', async () => {
    h.numPages = 1
    h.rejectWith = null
    const { container, rerender } = render(<PdfViewer src="https://example.com/a.pdf" title="A" />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    rerender(<PdfViewer src="https://example.com/b.pdf" title="B" />)
    await waitFor(() => expect(container.querySelectorAll('canvas')).toHaveLength(1))
    expect(pdfjsLib.GlobalWorkerOptions.workerPort).toBeInstanceOf(FakeWorker)
    expect(FakeWorker.created).toBe(1)
  })

  it('asks the user to update Android System WebView when the engine cannot parse pdf.js', async () => {
    h.numPages = 1
    h.rejectWith = new SyntaxError("Unexpected token '{'")
    render(<PdfViewer src="https://example.com/c.pdf" title="C" />)
    await waitFor(() => expect(screen.getByRole('link', { name: 'Update it on Google Play' })).toHaveAttribute('href', WEBVIEW_STORE_URL))
    expect(screen.queryByText('Could not load this page.')).not.toBeInTheDocument()
  })
})

describe('isOldEngineError', () => {
  it('recognises SyntaxErrors only', () => {
    expect(isOldEngineError(new SyntaxError('x'))).toBe(true)
    expect(isOldEngineError({ name: 'SyntaxError' })).toBe(true)
    expect(isOldEngineError(new Error('network'))).toBe(false)
    expect(isOldEngineError(null)).toBe(false)
  })
})
