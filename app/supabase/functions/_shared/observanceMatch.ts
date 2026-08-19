// AI-DEV NOTE: Protected observance-matching logic. See AGENTS.md "Panchangam
// / observance calendar" - do not change day_offset semantics, category
// separation, or advance_notify gating without Sreeni's explicit instruction.
//
// Pure matcher for panchangam_observances rules against panchangam_days rows.
// Isolated as a pure function (no Supabase client, no I/O) so it's unit
// testable independent of the Deno.serve handler - same reasoning as why
// is_scheduled/streak_after_completion are pure functions elsewhere.

export interface ObservanceRule {
  key: string
  category: "tharpanam" | "observance"
  title: string
  message: string
  match_thithi: string | null
  match_tamil_month: string | null
  match_tamil_day: number | null
  match_malayalam_month: string | null
  match_malayalam_day: number | null
  match_nakshatra: string | null
  day_offset: number
  priority: number
  advance_notify: boolean
}

export interface PanchangamRow {
  thithi: string
  tamil_month: string
  tamil_day: number
  malayalam_month: string
  malayalam_day: number
  nakshatra: string
}

export function ruleMatches(rule: ObservanceRule, row: PanchangamRow | undefined): boolean {
  if (!row) return false
  if (rule.match_thithi != null && rule.match_thithi !== row.thithi) return false
  if (rule.match_tamil_month != null && rule.match_tamil_month !== row.tamil_month) return false
  if (rule.match_tamil_day != null && rule.match_tamil_day !== row.tamil_day) return false
  if (rule.match_malayalam_month != null && rule.match_malayalam_month !== row.malayalam_month) return false
  if (rule.match_malayalam_day != null && rule.match_malayalam_day !== row.malayalam_day) return false
  if (rule.match_nakshatra != null && rule.match_nakshatra !== row.nakshatra) return false
  return true
}

function specificity(rule: ObservanceRule): number {
  return [
    rule.match_thithi, rule.match_tamil_month, rule.match_tamil_day,
    rule.match_malayalam_month, rule.match_malayalam_day, rule.match_nakshatra,
  ].filter((value) => value != null).length
}

// All rules matching a candidate date, ordered once for every consumer:
// priority first, then the most specific rule, then a stable key tiebreak.
// The sender filters this list by category; the app banner uses it across both
// categories so Amavasya/Tharpanam days are visible too.
export function matchingRules(
  rowsByOffset: Record<number, PanchangamRow | undefined>,
  rules: ObservanceRule[],
): ObservanceRule[] {
  return rules
    .filter((rule) => ruleMatches(rule, rowsByOffset[rule.day_offset]))
    .sort((a, b) =>
      b.priority - a.priority || specificity(b) - specificity(a) || a.key.localeCompare(b.key)
    )
}

// rowsByOffset maps a rule's day_offset to the panchangam_days row that many
// days ahead of the candidate date (0 = the candidate date itself). day_offset
// can be positive OR negative:
//   +1 - a night observance (e.g. Maha Sivarathri, Vijayadashami): the tithi
//        begins in the evening, so the printed-panchangam day is the day
//        BEFORE the noon-sampled thithi's own day - check tomorrow's row.
//   -1 - a pre-dawn observance (e.g. Naraka Chaturdashi): the tithi is still
//        active at dawn even though the noon-sample has already rolled past
//        it, so the printed-panchangam day is the day AFTER the noon-sampled
//        thithi's own day - check yesterday's row.
// See the migration comment on panchangam_observances for the specific
// verified cases.
//
// Returns the highest-priority matching rule for the given category, or null
// if none match. Never returns a rule from a different category.
export function bestMatch(
  rowsByOffset: Record<number, PanchangamRow | undefined>,
  rules: ObservanceRule[],
  category: "tharpanam" | "observance",
): ObservanceRule | null {
  return matchingRules(rowsByOffset, rules).find((rule) => rule.category === category) ?? null
}

// Same as bestMatch, restricted to rules worth an advance ("in N days") push -
// a routine monthly tithi like Amavasya (advance_notify = false) is too
// frequent to warrant one, unlike a named yearly occasion.
export function bestAdvanceMatch(
  rowsByOffset: Record<number, PanchangamRow | undefined>,
  rules: ObservanceRule[],
  category: "tharpanam" | "observance",
): ObservanceRule | null {
  return bestMatch(rowsByOffset, rules.filter((r) => r.advance_notify), category)
}

// date-only (YYYY-MM-DD) arithmetic, UTC-anchored to avoid DST shifting the
// day - the string is a calendar date, not an instant.
export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
