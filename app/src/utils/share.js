import { Capacitor } from '@capacitor/core'

export function shareText({ streak, practiceName, displayName, tier, referralCode }) {
  return [
    `🪔 ${streak} day streak on Nithyakarma!`,
    `${practiceName} - ${displayName} (${tier})`,
    `Join me: ${shareUrl(referralCode)}`,
  ].join('\n')
}

export function shareUrl(referralCode) {
  const base = import.meta.env.VITE_APP_URL ?? window.location.origin
  return `${base}/r/${referralCode}`
}

// WhatsApp share: native share sheet on Android, wa.me on web (iPhone Safari).
export async function shareToWhatsApp(payload) {
  const text = shareText(payload)
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({ text })
    return
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
