import { useEffect, useRef } from 'react'
import { identifyUser, resetAnalytics, registerOnce } from '../lib/posthog'
import { getInstallAttribution } from '../utils/installReferrer'

// Links PostHog's anonymous visitor to the signed-in account and resets it on
// sign-out, so a shared device never mixes two accounts' events. Install
// attribution (Android) is attached once as $set_once person properties.
export function useAnalyticsIdentity(session) {
  const userId = session?.user?.id ?? null
  const email = session?.user?.email ?? null
  const wasSignedIn = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (userId) {
      wasSignedIn.current = true
      getInstallAttribution().then(attr => {
        if (cancelled) return
        if (Object.keys(attr).length) registerOnce(attr)
        identifyUser({ id: userId, email }, attr)
      })
    } else if (wasSignedIn.current) {
      wasSignedIn.current = false
      resetAnalytics()
    }
    return () => { cancelled = true }
  }, [userId, email])
}
