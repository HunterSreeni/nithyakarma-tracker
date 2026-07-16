import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../utils/friendlyError'

const CONTENT_CACHE_PREFIX = 'nk_learning_content_'

// Loads a stotram's verse content from the public Storage bucket (cached in
// localStorage after the first fetch - static text, safe to cache forever)
// and the selected subject's per-verse learned progress.
export function useLearning(ownerId, familyMemberId, slug) {
  const [verses, setVerses] = useState([])
  const [learned, setLearned] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadContent = useCallback(async () => {
    const cacheKey = CONTENT_CACHE_PREFIX + slug
    try {
      const cached = localStorage.getItem(cacheKey)
      if (cached) { setVerses(JSON.parse(cached)); return }
    } catch { /* private mode / corrupt cache - fall through to fetch */ }
    const { data } = supabase.storage.from('learning-content').getPublicUrl(`${slug}.json`)
    const res = await fetch(data.publicUrl)
    if (!res.ok) throw new Error('Could not load content')
    const json = await res.json()
    setVerses(json)
    try { localStorage.setItem(cacheKey, JSON.stringify(json)) } catch { /* private mode - skip cache */ }
  }, [slug])

  const loadProgress = useCallback(async () => {
    if (!ownerId) return
    let q = supabase.from('learning_progress').select('verse_id')
      .eq('owner_id', ownerId).eq('content_slug', slug)
    q = familyMemberId ? q.eq('family_member_id', familyMemberId) : q.is('family_member_id', null)
    const { data } = await q
    setLearned(new Set((data ?? []).map(r => r.verse_id)))
  }, [ownerId, familyMemberId, slug])

  useEffect(() => {
    setLoading(true); setError('')
    Promise.all([loadContent(), loadProgress()])
      .catch(err => setError(friendlyError(err)))
      .finally(() => setLoading(false))
  }, [loadContent, loadProgress])

  // Returns true if this verse was newly recorded, false if it was already
  // learned (so the caller knows whether to run the dashboard-mark side effect).
  const markLearned = async (verseId) => {
    if (learned.has(verseId)) return false
    const { error } = await supabase.from('learning_progress').insert({
      owner_id: ownerId, family_member_id: familyMemberId, content_slug: slug, verse_id: verseId,
    })
    if (error) throw error
    setLearned(prev => new Set(prev).add(verseId))
    return true
  }

  return { verses, learned, loading, error, markLearned }
}
