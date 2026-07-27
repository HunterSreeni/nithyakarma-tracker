import { lazy } from 'react'

// Vite's hashed chunk filenames go stale the moment a new deploy overwrites
// dist/assets - a tab left open across a release 404s fetching them. Retry
// once with a hard reload so the user picks up the new build instead of
// seeing a broken page.
export function lazyWithRetry(importFn) {
  return lazy(async () => {
    try {
      const mod = await importFn()
      sessionStorage.removeItem('lazy-retry-reloaded')
      return mod
    } catch (error) {
      if (!sessionStorage.getItem('lazy-retry-reloaded')) {
        sessionStorage.setItem('lazy-retry-reloaded', '1')
        window.location.reload()
        return new Promise(() => {})
      }
      throw error
    }
  })
}
