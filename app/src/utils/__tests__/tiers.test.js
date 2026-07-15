import { describe, it, expect } from 'vitest'
import { tierFor, tierProgress, tierClass } from '../tiers'

describe('tierFor', () => {
  it('maps punya to tiers at exact boundaries (mirrors DB tier_for)', () => {
    expect(tierFor(0)).toBe('Shishya')
    expect(tierFor(99)).toBe('Shishya')
    expect(tierFor(100)).toBe('Sadhaka')
    expect(tierFor(399)).toBe('Sadhaka')
    expect(tierFor(400)).toBe('Yogi')
    expect(tierFor(999)).toBe('Yogi')
    expect(tierFor(1000)).toBe('Rishi')
    expect(tierFor(2499)).toBe('Rishi')
    expect(tierFor(2500)).toBe('Brahmarishi')
    expect(tierFor(99999)).toBe('Brahmarishi')
  })
})

describe('tierProgress', () => {
  it('reports progress toward the next tier', () => {
    const tp = tierProgress(640)
    expect(tp.current).toBe('Yogi')
    expect(tp.next).toBe('Rishi')
    expect(tp.toNext).toBe(360)
    expect(tp.nextAt).toBe(1000)
    expect(tp.pct).toBe(40)
  })
  it('caps at the top tier', () => {
    const tp = tierProgress(3000)
    expect(tp.current).toBe('Brahmarishi')
    expect(tp.next).toBeNull()
    expect(tp.pct).toBe(100)
  })
})

describe('tierClass', () => {
  it('builds the css class', () => {
    expect(tierClass('Brahmarishi')).toBe('tier-brahmarishi')
  })
})
