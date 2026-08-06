import { Capacitor } from '@capacitor/core'

export function shareCaption({ streak, referralCode }) {
  return `🔥 ${streak} day streak on Nithyakarma! Join me: ${shareUrl(referralCode)}`
}

export function shareUrl(referralCode) {
  const base = import.meta.env.VITE_APP_URL ?? window.location.origin
  return `${base}/r/${referralCode}`
}

// Renders the share card to a PNG at ~1080px wide (real phone screen
// resolution) - WhatsApp's status editor places small images oddly instead
// of centering them. `cardEl` must be the hidden, isolated export node
// (CelebrationModal's exportCardRef), not the visible on-screen preview -
// capturing the preview directly bakes in its ancestor modal's
// padding/margin as an offset (confirmed on-device: a 211px/81px content
// shift, clipped at the far edge).
//
// Every html-to-image scaling knob tried here broke content on real Android
// WebView, each a different way (confirmed on-device, not guessed):
//   - `pixelRatio` alone: canvas enlarges, content doesn't - matches the
//     long-standing upstream bug bubkoo/html-to-image#72.
//   - `pixelRatio` + explicit `width`/`height`: canvas sizes correctly, but
//     all text silently drops from the render (icon and background paint fine).
//   - CSS `zoom` pre-scaling the source node: drops BOTH text and icon,
//     canvas reverts to the unscaled natural size regardless.
// A bare capture at the node's natural (small) size with no scaling option
// at all renders every element correctly, every time. So: capture reliably
// small, then upscale the resulting PNG ourselves via a plain canvas -
// entirely past this library's own scaling code. Loaded on demand -
// CelebrationModal is in the eager initial bundle, and most opens never
// click share.
async function cardToDataUrl(cardEl) {
  const { toPng } = await import('html-to-image')
  // .share-card has its own margin-top (index.css:309, not auto - the
  // horizontal auto margins are already neutralized by the export wrapper
  // having no width to center within). Capturing an element doesn't normally
  // include its own external margin, but html-to-image's clone does bake it
  // in here as a leading gap. Zero it for the capture only.
  cardEl.style.margin = '0'
  try {
    const naturalDataUrl = await toPng(cardEl, { pixelRatio: 1 })
    return await upscaleDataUrl(naturalDataUrl, 1080)
  } finally {
    cardEl.style.margin = ''
  }
}

function upscaleDataUrl(dataUrl, targetWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const ratio = targetWidth / img.naturalWidth
      const canvas = document.createElement('canvas')
      canvas.width = targetWidth
      canvas.height = Math.round(img.naturalHeight * ratio)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load rendered share card for upscaling'))
    img.src = dataUrl
  })
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
