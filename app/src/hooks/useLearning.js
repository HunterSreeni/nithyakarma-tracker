import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../utils/friendlyError'

const CONTENT_CACHE_PREFIX = 'nk_learning_content_'

// Loads a stotram's verse content from the public Storage bucket (cached in
// localStorage after the first fetch). Reading is decoupled from completion -
// the practice is marked done from the Today page like any other practice.
export function useLearning(slug) {
  const [verses, setVerses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Stale-while-revalidate. The cache used to be treated as permanent ("static
  // text, safe to cache forever"), which meant a corrected stotram never reached
  // anyone who had already loaded the old one - and the content has been corrected
  // twice. Paint from cache for speed, then always revalidate and swap if the file
  // actually changed. Compared as raw text so an unchanged file costs no re-render.
  const loadContent = useCallback(async (isCancelled = () => false) => {
    const cacheKey = CONTENT_CACHE_PREFIX + slug
    let cached = null
    try {
      cached = localStorage.getItem(cacheKey)
      if (cached) setVerses(JSON.parse(cached))
    } catch {
      cached = null // private mode, or a corrupt entry - treat as a cold load
    }

    const revalidate = async () => {
      const { data } = supabase.storage.from('learning-content').getPublicUrl(`${slug}.json`)
      // no-cache still uses the ETag, so an unchanged file is a cheap 304.
      const res = await fetch(data.publicUrl, { cache: 'no-cache' })
      if (!res.ok) throw new Error('Could not load content')
      const text = await res.text()
      if (text === cached) return
      const json = JSON.parse(text)
      if (!isCancelled()) setVerses(json)
      try { localStorage.setItem(cacheKey, text) } catch { /* private mode - skip cache */ }
    }

    // With something already on screen, a failed refresh must not blank the page
    // or raise an error banner. With nothing shown yet, the failure is the story.
    if (cached) { revalidate().catch(() => {}); return }
    await revalidate()
  }, [slug])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled
    setLoading(true); setError('')
    loadContent(isCancelled)
      .catch(err => { if (!cancelled) setError(friendlyError(err)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    // The revalidation fetch outlives this effect when it resolves after a
    // navigation or a slug switch; the flag stops it writing stale verses
    // into a hook instance that has already moved on.
    return () => { cancelled = true }
  }, [loadContent])

  return { verses, loading, error }
}
