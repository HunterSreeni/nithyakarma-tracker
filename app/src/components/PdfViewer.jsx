import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import ErrorBanner from './ErrorBanner'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Android's WebView (what this app runs in via Capacitor) has no built-in PDF
// plugin, unlike desktop Chrome - an <iframe src="....pdf"> just renders
// blank there. pdf.js draws pages onto <canvas> in pure JS instead, which
// works identically everywhere (desktop, mobile browsers, WebViews).
// Renders every page stacked in one scrolling column, matching how a sarga
// PDF reads top to bottom - no toolbar/thumbnail chrome, this is a reader,
// not a general-purpose PDF viewer.
export default function PdfViewer({ src, title }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const container = containerRef.current
    if (container) container.replaceChildren()

    pdfjsLib.getDocument({ url: src }).promise.then(async (pdf) => {
      const width = container?.clientWidth || 360
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return
        const page = await pdf.getPage(i)
        const scale = width / page.getViewport({ scale: 1 }).width
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.className = 'pdf-page-canvas'
        canvas.width = viewport.width
        canvas.height = viewport.height
        container?.appendChild(canvas)
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        if (i === 1 && !cancelled) setLoading(false)
      }
    }).catch((err) => {
      if (cancelled) return
      setLoading(false)
      setError('Could not load this page.')
      console.error('PDF render failed', err)
    })

    return () => { cancelled = true }
  }, [src])

  return (
    <div className="pdf-viewer">
      {loading && <div className="spinner-wrap">Loading...</div>}
      <ErrorBanner message={error} />
      <div className="pdf-page-list" ref={containerRef} aria-label={title} />
    </div>
  )
}
