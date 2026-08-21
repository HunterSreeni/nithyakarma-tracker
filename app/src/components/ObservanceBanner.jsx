import { useState } from 'react'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { withDeadline, unwrap } from '../lib/queryClient'
import { localDateString } from '../utils/cadence'
import { addDays, matchingRules } from '../../supabase/functions/_shared/observanceMatch.ts'

const DISMISS_PREFIX = 'nk_dismissed_observance_'

function bannerMatches(rows, rules, date) {
  const rowByDate = new Map(rows.map((row) => [row.date, row]))
  const matches = matchingRules({
    [-1]: rowByDate.get(addDays(date, -1)),
    0: rowByDate.get(date),
    1: rowByDate.get(addDays(date, 1)),
  }, rules)

  // A named rule supersedes its generic monthly rule in the same category.
  // A genuinely separate occasion from the other category can be mentioned.
  const seenCategories = new Set()
  return matches.filter((match) => {
    if (seenCategories.has(match.category)) return false
    seenCategories.add(match.category)
    return true
  })
}

// Intent 2.8 (2026-08-20): a tharpanam occasion and an observance occasion on
// the same day are two separate, independently-dismissible banner cards -
// not one card with the 2nd occasion squeezed into the 1st's subtitle
// ("Also today: ..."). bannerMatches already caps at one match per category
// (tharpanam + observance), so this never renders more than 2 cards.
export default function ObservanceBanner() {
  const date = localDateString()
  const [dismissedKeys, setDismissedKeys] = useState(() => new Set())
  const { data: matches = [] } = useQuery({
    queryKey: ['observance-banner', date],
    queryFn: async () => {
      const dates = [addDays(date, -1), date, addDays(date, 1)]
      const [daysResult, rulesResult] = await withDeadline(Promise.all([
        supabase.from('panchangam_days')
          .select('date, thithi, tamil_month, tamil_day, malayalam_month, malayalam_day, nakshatra')
          .in('date', dates),
        supabase.from('panchangam_observances').select('*'),
      ]), 'Today observances')
      return bannerMatches(unwrap(daysResult) ?? [], unwrap(rulesResult) ?? [], date)
    },
  })

  const isDismissed = (key) => {
    if (dismissedKeys.has(key)) return true
    try { return localStorage.getItem(`${DISMISS_PREFIX}${date}_${key}`) === '1' } catch { return false } // private mode
  }

  const dismiss = (key) => {
    try { localStorage.setItem(`${DISMISS_PREFIX}${date}_${key}`, '1') } catch { /* private mode */ }
    setDismissedKeys(prev => new Set(prev).add(key))
  }

  const visible = matches.filter((match) => !isDismissed(match.key))
  if (visible.length === 0) return null

  return (
    <>
      {visible.map((match) => (
        <div key={match.key} className="monthly-special monthly-special-static" data-observance-key={match.key}>
          <div>
            <div className="ms-title">{match.title}</div>
            <div className="ms-subtitle">{match.message}</div>
          </div>
          <button type="button" className="ms-dismiss" aria-label="Dismiss" onClick={() => dismiss(match.key)}>
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </>
  )
}
