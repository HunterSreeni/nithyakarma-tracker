import { Capacitor } from '@capacitor/core'

export function shareCaption({ streak, referralCode }) {
  return `🔥 ${streak} day streak on Nithyakarma! Join me: ${shareUrl(referralCode)}`
}

export function shareUrl(referralCode) {
  const base = import.meta.env.VITE_APP_URL ?? window.location.origin
  return `${base}/r/${referralCode}`
}

// Renders the on-screen share card to a PNG. pixelRatio 2 for a crisp image
// on higher-density phone screens. Loaded on demand - CelebrationModal is in
// the eager initial bundle, and most opens never click share.
async function cardToDataUrl(cardEl) {
  const { toPng } = await import('html-to-image')
  return toPng(cardEl, { pixelRatio: 2 })
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

// Shares the rendered card image + a short caption to WhatsApp.
// - Native (Android): the image has to be a file:// URI - Capacitor's Share
//   plugin only accepts file paths, not data URLs or blobs directly. Written
//   to the cache directory, the one folder Android shares by default.
// - Web with file-share support (most modern mobile browsers): Web Share API
//   with files.
// - Web without file-share support (most desktop browsers): falls back to
//   today's text-only wa.me link - no image, but never silently does nothing.
export async function shareCardToWhatsApp(cardEl, payload) {
  const caption = shareCaption(payload)
  const dataUrl = await cardToDataUrl(cardEl)

  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const base64 = dataUrl.split(',')[1]
    const path = 'nithyakarma-streak.png'
    await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache })
    const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
    await Share.share({ files: [uri], text: caption })
    return
  }

  const blob = await dataUrlToBlob(dataUrl)
  const file = new File([blob], 'nithyakarma-streak.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: caption })
    return
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank', 'noopener')
}
