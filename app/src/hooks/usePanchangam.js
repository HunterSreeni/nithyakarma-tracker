import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { localDateString } from '../utils/cadence'

// Looks up today's precomputed panchangam row (Intent 2.7). No row for a
// given date (e.g. next year's data not loaded yet) is a normal, silent case
// - the box just doesn't render, not an error.
export function usePanchangam() {
  const [day, setDay] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.from('panchangam_days').select('*').eq('date', localDateString()).maybeSingle()
      .then(({ data }) => { if (!cancelled) setDay(data ?? null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return { day, loading }
}
