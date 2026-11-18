import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  native: false,
  toJpeg: vi.fn(async () => 'data:image/jpeg;base64,QUJD'),
  addPage: vi.fn(),
  addImage: vi.fn(),
  output: vi.fn(() => 'data:application/pdf;base64,UERG'),
  jsPDF: vi.fn(),
  writeFile: vi.fn(async () => ({})),
  getUri: vi.fn(async () => ({ uri: 'file:///cache/jadhagam-meera.pdf' })),
  share: vi.fn(async () => ({})),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => h.native } }))
vi.mock('html-to-image', () => ({ toJpeg: h.toJpeg }))
vi.mock('jspdf', () => ({
  jsPDF: function (opts) {
    h.jsPDF(opts)
    return { addPage: h.addPage, addImage: h.addImage, output: h.output }
  },
}))
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: h.writeFile, getUri: h.getUri },
  Directory: { Cache: 'CACHE' },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: h.share } }))

import { renderJpg, renderPdf, deliver, A4_PT } from '../exportFile'

const page = (over = {}) => ({ scrollHeight: 100, clientHeight: 100, scrollWidth: 100, clientWidth: 100, ...over })

beforeEach(() => {
  vi.clearAllMocks()
  h.native = false
})

describe('renderJpg', () => {
  it('captures the node 1:1 on white at high quality', async () => {
    const node = page()
    expect(await renderJpg(node)).toBe('data:image/jpeg;base64,QUJD')
    expect(h.toJpeg).toHaveBeenCalledWith(node, { quality: 0.92, pixelRatio: 1, backgroundColor: '#ffffff', cacheBust: false })
  })

  it('refuses an overflowing layout before capturing anything', async () => {
    await expect(renderJpg(page({ scrollHeight: 300 }))).rejects.toThrow(/did not fit/)
    await expect(renderJpg(page({ scrollWidth: 300 }))).rejects.toThrow(/did not fit/)
    expect(h.toJpeg).not.toHaveBeenCalled()
  })

  it('allows one pixel of rounding slack', async () => {
    await expect(renderJpg(page({ scrollHeight: 101, scrollWidth: 101 }))).resolves.toBeTruthy()
  })
})

describe('renderPdf', () => {
  it('puts each page on its own full A4 sheet', async () => {
    const pages = [page(), page(), page()]
    expect(await renderPdf(pages)).toBe('data:application/pdf;base64,UERG')
    expect(h.jsPDF).toHaveBeenCalledWith({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
    expect(h.toJpeg).toHaveBeenCalledTimes(3)
    expect(h.toJpeg.mock.calls[0][1].quality).toBe(0.88)
    expect(h.addPage).toHaveBeenCalledTimes(2)
    expect(h.addPage).toHaveBeenCalledWith('a4', 'portrait')
    expect(h.addImage).toHaveBeenCalledTimes(3)
    expect(h.addImage).toHaveBeenCalledWith('data:image/jpeg;base64,QUJD', 'JPEG', 0, 0, A4_PT.w, A4_PT.h, undefined, 'FAST')
    expect(h.output).toHaveBeenCalledWith('datauristring')
  })

  it('checks every page fits before capturing any of them', async () => {
    await expect(renderPdf([page(), page({ scrollHeight: 999 })])).rejects.toThrow(/did not fit/)
    expect(h.toJpeg).not.toHaveBeenCalled()
  })
})

describe('deliver', () => {
  it('on the web, downloads through a temporary link', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await deliver('data:image/jpeg;base64,QUJD', 'jadhagam-meera.jpg')
    expect(click).toHaveBeenCalledTimes(1)
    const a = click.mock.instances[0]
    expect(a.download).toBe('jadhagam-meera.jpg')
    expect(a.href).toBe('data:image/jpeg;base64,QUJD')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(h.writeFile).not.toHaveBeenCalled()
    click.mockRestore()
  })

  it('on Android, saves the base64 body to the cache and opens the share sheet', async () => {
    h.native = true
    await deliver('data:application/pdf;base64,UERG', 'jadhagam-meera.pdf')
    expect(h.writeFile).toHaveBeenCalledWith({ path: 'jadhagam-meera.pdf', data: 'UERG', directory: 'CACHE' })
    expect(h.getUri).toHaveBeenCalledWith({ path: 'jadhagam-meera.pdf', directory: 'CACHE' })
    expect(h.share).toHaveBeenCalledWith({ files: ['file:///cache/jadhagam-meera.pdf'], title: 'jadhagam-meera.pdf' })
  })
})
