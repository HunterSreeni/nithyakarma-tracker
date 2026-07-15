import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { contrastRatio } from '../contrast'

// Reads the real CSS tokens so the gate fails if someone lightens them again.
// vitest runs from the app/ package root, so this path resolves from there.
const css = readFileSync('src/index.css', 'utf8')
const token = (name) => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`))
  if (!m) throw new Error(`CSS token ${name} not found`)
  return m[1]
}

describe('WCAG AA contrast of accessibility tokens', () => {
  const action = token('--action')
  const text2 = token('--text-2')
  const paper = token('--paper')
  const saffron950 = token('--saffron-950')
  const saffron900 = token('--saffron-900')
  const saffron700 = token('--saffron-700')

  it('computes known ratios correctly', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('white text on the primary action color passes AA (>=4.5:1)', () => {
    expect(contrastRatio(action, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it('secondary text passes AA on paper and on white cards (>=4.5:1)', () => {
    expect(contrastRatio(text2, paper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(text2, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  // .auth-hero, .share-card and .hall-banner all use a saffron-950/900->700
  // gradient background - text on them must clear AA against every stop, not
  // just the darkest one (the 700 stop is the failure point for tinted text).
  it('white text on the saffron-950->700 hero/share-card gradient passes AA at every stop', () => {
    expect(contrastRatio('#ffffff', saffron950)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', saffron900)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', saffron700)).toBeGreaterThanOrEqual(4.5)
  })

  it('danger-zone subtext passes AA on its light red card (>=4.5:1)', () => {
    expect(contrastRatio('#7a3f3f', '#fdf6f6')).toBeGreaterThanOrEqual(4.5)
  })
})
