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

describe('shareCardToWhatsApp', () => {
  const cardEl = {}

  beforeEach(() => {
    vi.clearAllMocks()
    h.toPng.mockResolvedValue('data:image/png;base64,ZmFrZS1wbmc=')
    h.getUri.mockResolvedValue({ uri: 'file:///cache/nithyakarma-streak.png' })
  })

  it('native: writes the PNG to the cache directory and shares the file:// uri with the caption', async () => {
    h.isNative = true
    await shareCardToWhatsApp(cardEl, { streak: 48, referralCode: 'abc123' })

    expect(h.toPng).toHaveBeenCalledWith(cardEl, { pixelRatio: 2 })
    expect(h.writeFile).toHaveBeenCalledWith(expect.objectContaining({
      data: 'ZmFrZS1wbmc=', directory: 'CACHE',
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
