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
  const success = token('--success')
  const gold = token('--gold')
  const silver = token('--silver')
  const bronze = token('--bronze')


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

  // Darkened 20 Aug 2026 (docs/DESIGN-GUIDE-V1.md) - the previous values
  // failed 4.5:1 on their real backgrounds: --success as low as 2.78:1 on
  // .slot-btn.done's light-green chip, --gold/--silver/--bronze as low as
  // 2.09:1 as leaderboard rank text on a white .lb-row.
  it('--success passes AA on paper and on the light-green done-chip background', () => {
    expect(contrastRatio(success, paper)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(success, '#d9f2e1')).toBeGreaterThanOrEqual(4.5)
  })

  // Calendar page (Intent 2.11). Every text on it is --saffron-900 on one of
  // four grounds, and the page was designed to a 5:1 bar rather than the
  // 4.5:1 minimum, so these lock in the stricter number.
  describe('calendar page single text color', () => {
    const saffron50 = token('--saffron-50')
    const saffron100 = token('--saffron-100')
    const cream = '#ede8dc' // --cream resolves to --neutral-100
    const CAL_GROUNDS = {
      'white cards': '#ffffff',
      'the paper page ground': paper,
      'the saffron-50 chips and today cell': saffron50,
      'the saffron-100 observance badge': saffron100,
      'the cream view switcher': cream,
    }

    for (const [where, ground] of Object.entries(CAL_GROUNDS)) {
      it(`--saffron-900 clears 5:1 on ${where}`, () => {
        expect(contrastRatio(saffron900, ground)).toBeGreaterThanOrEqual(5)
      })
    }

    // The gradient hero is the one place the calendar does not use
    // --saffron-900, because nothing dark works across those stops.
    it('white hero text clears AA at every stop of the calendar gradient', () => {
      expect(contrastRatio('#ffffff', saffron950)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio('#ffffff', saffron900)).toBeGreaterThanOrEqual(4.5)
      expect(contrastRatio('#ffffff', saffron700)).toBeGreaterThanOrEqual(4.5)
    })

    // --action reaches 5:1 on pure white only (4.56:1 on paper, 4.88:1 on
    // saffron-50), so it fills and rings on this page but never sets text.
    // This is the regression gate for someone reaching for it as a text color.
    it('never uses --action as a text color in the calendar block', () => {
      const block = css.slice(css.indexOf('/* Calendar page (Intent 2.11)'))
      // Lookbehind keeps border-color/background-color out of it - the ring
      // on today's cell is a legitimate --action use.
      const textRules = block.match(/^\.cal-[^{]*\{[^}]*(?<!-)color:\s*var\(--action\)/gm) ?? []
      expect(textRules).toEqual([])
    })
  })

  it('--gold/--silver/--bronze pass AA as leaderboard rank text on white', () => {
    expect(contrastRatio(gold, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(silver, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(bronze, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})
