import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { shareUrl } from '../utils/share'

// Sits next to the WhatsApp share button on ReferralsPage and ProfilePage -
// same link, just a second way to get it out (paste into SMS, email, etc.
// instead of only WhatsApp). `variant` picks the button styling to match
// whichever background it's placed on ('outline' for the dark .referral-card
// gradient, 'secondary' for a plain light background).
export default function CopyLinkButton({ referralCode, variant = 'secondary' }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(referralCode))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable or permission denied - no-op. WhatsApp
      // share is still available as the primary path.
    }
  }

  return (
    <button type="button" className={variant === 'outline' ? 'btn-ref-outline' : 'btn-secondary'} onClick={copy}>
      {copied
        ? <>Copied <Check size={12} strokeWidth={3} /></>
        : <>Copy link <Copy size={12} strokeWidth={2.5} /></>}
    </button>
  )
}
