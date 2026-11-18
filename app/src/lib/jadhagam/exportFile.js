// Turns the hidden export layouts into a JPG or a PDF and hands them to the user.
//
// AI-DEV NOTE: capture at the node's natural size with no html-to-image scaling
// option; every scaling knob broke text on real Android WebViews (see
// utils/share.js). So the layouts themselves are drawn at full output size
// (1080px image, A4 at 2x for PDF pages) and captured 1:1.
// AI-DEV NOTE: PDF pages are images, not PDF text: jsPDF cannot shape Tamil or
// Malayalam (conjuncts and vowel signs come out wrong), so we keep the browser's
// own rendering.
import { Capacitor } from '@capacitor/core'

export const A4_PT = { w: 595.28, h: 841.89 }

async function settled() {
  try { await document.fonts?.ready } catch { /* older WebViews: no FontFaceSet */ }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

// A layout taller than its fixed page would be cut off in the image. Refuse it
// before anything is saved or counted, rather than hand over a clipped jadhagam.
export function assertFits(node) {
  if (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1) {
    throw new Error('This chart did not fit on the page. Please tell us so we can fix the layout.')
  }
}

async function capture(node, quality) {
  const { toJpeg } = await import('html-to-image')
  return toJpeg(node, { quality, pixelRatio: 1, backgroundColor: '#ffffff', cacheBust: false })
}

export async function renderJpg(node) {
  await settled()
  assertFits(node)
  return capture(node, 0.92)
}

export async function renderPdf(pageNodes) {
  await settled()
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true })
  pageNodes.forEach(assertFits)
  for (let i = 0; i < pageNodes.length; i++) {
    if (i > 0) pdf.addPage('a4', 'portrait')
    const img = await capture(pageNodes[i], 0.88)
    pdf.addImage(img, 'JPEG', 0, 0, A4_PT.w, A4_PT.h, undefined, 'FAST')
  }
  return pdf.output('datauristring')
}

// Safe file name from a person's name: "jadhagam-meera-k.pdf".
export function fileName(name, ext) {
  const slug = String(name || 'chart').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'chart'
  return `jadhagam-${slug}.${ext}`
}

// Native: write to the cache folder (the one Android shares by default) and open
// the share sheet, so the user picks Files, WhatsApp, Drive or print. Web: a
// normal browser download.
export async function deliver(dataUrl, filename) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Cache })
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
    await Share.share({ files: [uri], title: filename })
    return
  }
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
