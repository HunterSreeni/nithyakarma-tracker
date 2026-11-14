import { useEffect, useRef, useState } from 'react'
import ErrorBanner from './ErrorBanner'

export const WEBVIEW_STORE_URL = 'https://play.google.com/store/apps/details?id=com.google.android.webview'

// AI-DEV NOTE: pdf.js and its worker load lazily, and the worker comes in through
// Vite's `?worker` so it is bundled and down-levelled with the app's build target
// (a `?url` worker was copied untouched and crashed old WebViews, Sentry
// NITHYAKARMA-4). If the engine still cannot parse the code (SyntaxError), the
// reader shows an "update Android System WebView" message instead of the whole
// page crashing into the app's error boundary.
let pdfjsPromise = null
export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
    ]).then(([lib, { default: PdfWorker }]) => {
      lib.GlobalWorkerOptions.workerPort = new PdfWorker()
      return lib
    }).catch((err) => {
      pdfjsPromise = null
      throw err
    })
  }
  return pdfjsPromise
}

export const isOldEngineError = err => err instanceof SyntaxError || err?.name === 'SyntaxError'

// Android's WebView (what this app runs in via Capacitor) has no built-in PDF
// plugin, unlike desktop Chrome - an <iframe src="....pdf"> just renders
// blank there. pdf.js draws pages onto <canvas> in pure JS instead, which
// works identically everywhere (desktop, mobile browsers, WebViews).
// Renders every page stacked in one scrolling column, matching how a sarga
// PDF reads top to bottom - no toolbar/thumbnail chrome, this is a reader,
// not a general-purpose PDF viewer.
//
// Pinned to pdfjs-dist 4.x, not the current 6.x: 6.x moved JBIG2/OpenJPEG
// image decoding to WASM (needing an explicit wasmUrl) and started calling
// brand-new JS engine methods unconditionally (Uint8Array.prototype.toHex,
// Map.prototype.getOrInsertComputed, ...) for basic document parsing, not
// just decoding. Confirmed missing on a real Android emulator's WebView
// despite it self-reporting as Chromium 133 - every PDF failed to load, not
// just scanned ones. 4.x's decoders are pure JS with no such dependency.
export default function PdfViewer({ src, title }) {
  const containerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [outdated, setOutdated] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    setOutdated(false)
    const container = containerRef.current
    if (container) container.replaceChildren()

    loadPdfjs().then(lib => lib.getDocument({ url: src }).promise).then(async (pdf) => {
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
      if (isOldEngineError(err)) setOutdated(true)
      else setError('Could not load this page.')
      console.error('PDF render failed', err)
    })

    return () => { cancelled = true }
  }, [src])

  return (
    <div className="pdf-viewer">
      {loading && <div className="spinner-wrap">Loading...</div>}
      <ErrorBanner message={error} />
      {outdated && (
        <div className="auth-error" role="alert">
          This reader needs a newer version of Android System WebView.{' '}
          <a href={WEBVIEW_STORE_URL} target="_blank" rel="noopener noreferrer">Update it on Google Play</a>
          , then reopen this page.
        </div>
      )}
      <div className="pdf-page-list" ref={containerRef} aria-label={title} />
    </div>
  )
}
