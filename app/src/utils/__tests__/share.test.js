import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  isNative: false,
  toPng: vi.fn().mockResolvedValue('data:image/png;base64,ZmFrZS1wbmc='),
  writeFile: vi.fn().mockResolvedValue(undefined),
  getUri: vi.fn().mockResolvedValue({ uri: 'file:///cache/nithyakarma-streak.png' }),
  shareNative: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => h.isNative },
}))
vi.mock('html-to-image', () => ({ toPng: (...a) => h.toPng(...a) }))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...a) => h.writeFile(...a), getUri: (...a) => h.getUri(...a) },
  Directory: { Cache: 'CACHE' },
}))
vi.mock('@capacitor/share', () => ({
  Share: { share: (...a) => h.shareNative(...a) },
}))

import { shareCaption, shareUrl, shareCardToWhatsApp } from '../share'

describe('shareCaption', () => {
  it('builds a short one-line caption with the streak and referral link', () => {
    const caption = shareCaption({ streak: 48, referralCode: 'abc123' })
    expect(caption).toContain('48 day streak')
    expect(caption).toContain('/r/abc123')
    expect(caption.split('\n')).toHaveLength(1)
  })
})

describe('shareUrl', () => {
  it('builds the referral url from the origin', () => {
    expect(shareUrl('xyz')).toMatch(/\/r\/xyz$/)
  })
})

// Fake <img> that resolves onload on the next microtask, like a real decoded
// data: URL image would (synchronously in practice, but never assume that).
class FakeImage {
  naturalWidth = 240
  naturalHeight = 427
  set src(_v) { queueMicrotask(() => this.onload?.()) }
}

describe('shareCardToWhatsApp', () => {
  const cardEl = { offsetWidth: 240, style: {} }
  let realCreateElement

  beforeEach(() => {
    vi.clearAllMocks()
    cardEl.style = {}
    h.toPng.mockResolvedValue('data:image/png;base64,ZmFrZS1wbmc=')
    h.getUri.mockResolvedValue({ uri: 'file:///cache/nithyakarma-streak.png' })

    // cardToDataUrl upscales html-to-image's (small, but reliably correct -
    // see share.js's header comment) natural-size capture via a plain
    // canvas, entirely past html-to-image's own scaling options - every one
    // of which silently dropped content on real Android WebView. Stub the
    // canvas/Image pair that step uses; jsdom's own <canvas> has no real
    // getContext (needs the optional `canvas` npm package).
    vi.stubGlobal('Image', FakeImage)
    realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag !== 'canvas') return realCreateElement(tag)
      return {
        width: 0, height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toDataURL: () => 'data:image/png;base64,dXBzY2FsZWQ=',
      }
    })
  })

  it('native: writes the PNG to the cache directory and shares the file:// uri with the caption', async () => {
    h.isNative = true
    await shareCardToWhatsApp(cardEl, { streak: 48, referralCode: 'abc123' })

    expect(h.toPng).toHaveBeenCalledWith(cardEl, { pixelRatio: 1 })
    // The margin override is applied for the capture, then reset afterwards
    // - not left on the (hidden, reused) export node between shares.
    expect(cardEl.style.margin).toBe('')
    // 'dXBzY2FsZWQ=' = base64 for 'upscaled' - the canvas-upscaled result,
    // not html-to-image's raw (small) output.
    expect(h.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      data: 'dXBzY2FsZWQ=', directory: 'CACHE',
    }))
    expect(h.shareNative).toHaveBeenCalledWith({
      files: ['file:///cache/nithyakarma-streak.png'],
      text: expect.stringContaining('48 day streak'),
    })
  })

  it('web with file-share support: uses the Web Share API with the image file', async () => {
    h.isNative = false
    const shareMock = vi.fn().mockResolvedValue(undefined)
    const canShareMock = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { share: shareMock, canShare: canShareMock })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }))
    vi.stubGlobal('open', vi.fn())

    await shareCardToWhatsApp(cardEl, { streak: 48, referralCode: 'abc123' })

    expect(canShareMock).toHaveBeenCalled()
    expect(shareMock).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('48 day streak'),
      files: expect.arrayContaining([expect.any(File)]),
    }))
    expect(window.open).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('web without file-share support: falls back to the text-only wa.me link', async () => {
    h.isNative = false
    vi.stubGlobal('navigator', { canShare: undefined })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'])) }))
    const openMock = vi.fn()
    vi.stubGlobal('open', openMock)

    await shareCardToWhatsApp(cardEl, { streak: 48, referralCode: 'abc123' })

    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/?text='), '_blank', 'noopener',
    )
    vi.unstubAllGlobals()
  })
})
