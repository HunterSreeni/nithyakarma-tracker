// Tier ladder mirrors public.tier_for() in the database.
export const TIERS = [
  { name: 'Shishya', min: 0 },
  { name: 'Sadhaka', min: 100 },
  { name: 'Yogi', min: 400 },
  { name: 'Rishi', min: 1000 },
  { name: 'Brahmarishi', min: 2500 },
]

export function tierFor(punya) {
  let tier = TIERS[0]
  for (const t of TIERS) if (punya >= t.min) tier = t
  return tier.name
}

export function tierProgress(punya) {
  const idx = TIERS.findIndex(t => t.name === tierFor(punya))
  const current = TIERS[idx]
  const next = TIERS[idx + 1] ?? null
  if (!next) return { current: current.name, next: null, pct: 100, toNext: 0, nextAt: null }
  const pct = Math.round(((punya - current.min) / (next.min - current.min)) * 100)
  return { current: current.name, next: next.name, pct, toNext: next.min - punya, nextAt: next.min }
}

export function tierClass(tier) {
  return `tier-${tier.toLowerCase()}`
}
