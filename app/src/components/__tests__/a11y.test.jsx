import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

// Color contrast is verified manually (jsdom can't compute it). Everything
// else must pass.
const CONFIG = { rules: { 'color-contrast': { enabled: false } } }
// AuthPage/Terms/Privacy are rendered standalone in the real app too (before
// session/pre-login), so they're genuinely never inside a landmark - region
// stays disabled only for those.
const STANDALONE_CONFIG = { rules: { ...CONFIG.rules, region: { enabled: false } } }

async function seriousViolations(container, config = CONFIG) {
  const { violations } = await axe.run(container, config)
  return violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.help}`)
}

describe('accessibility (axe-core, WCAG 2.1 AA subset)', () => {
  it('AuthPage', async () => {
    vi.resetModules()
    vi.doMock('../../hooks/useAuth', () => ({
      useAuth: () => ({ signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn() }),
    }))
    const { default: AuthPage } = await import('../AuthPage')
    const { container } = render(<MemoryRouter><AuthPage /></MemoryRouter>)
    expect(await seriousViolations(container, STANDALONE_CONFIG)).toEqual([])
  })

  it('Terms & Conditions page', async () => {
    const { TermsPage } = await import('../LegalPages')
    const { container } = render(<MemoryRouter><TermsPage /></MemoryRouter>)
    expect(await seriousViolations(container, STANDALONE_CONFIG)).toEqual([])
  })

  it('Privacy Policy page', async () => {
    const { PrivacyPage } = await import('../LegalPages')
    const { container } = render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
    expect(await seriousViolations(container, STANDALONE_CONFIG)).toEqual([])
  })

  it('TodayPage inside Layout (real nav/main landmarks, region enabled)', async () => {
    vi.resetModules()
    const profile = {
      display_name: 'Test User', gender: 'male', current_streak: 0,
      best_streak: 0, freeze_credits: 0,
    }
    vi.doMock('../../hooks/useAuth', () => ({
      useAuth: () => ({
        session: { user: { id: 'u1' } }, profile, selectedMember: null,
        familyMembers: [], setSelectedMember: vi.fn(),
        refresh: vi.fn(), signOut: vi.fn(),
      }),
    }))
    vi.doMock('../../hooks/useToday', () => ({
      useToday: () => ({ items: [], loading: false, submit: vi.fn(), addPractice: vi.fn(), reload: vi.fn() }),
    }))
    vi.doMock('../../utils/notifications', () => ({ scheduleAllReminders: vi.fn() }))
    vi.doMock('../GuidedTour', () => ({ default: () => null }))
    vi.doMock('../PanchangamBox', () => ({ default: () => null }))
    vi.doMock('../../lib/supabase', () => {
      const chain = () => {
        const c = { select: () => c, eq: () => c, in: () => c, order: () => Promise.resolve({ data: [] }) }
        return c
      }
      return { supabase: { from: () => chain() } }
    })
    const { default: Layout } = await import('../Layout')
    const { default: TodayPage } = await import('../TodayPage')
    const { container } = render(<MemoryRouter><Layout><TodayPage /></Layout></MemoryRouter>)
    expect(await seriousViolations(container)).toEqual([])
  })

  it('CelebrationModal', async () => {
    vi.resetModules()
    vi.doMock('../../hooks/useAuth', () => ({
      useAuth: () => ({ profile: { referral_code: 'ref123' } }),
    }))
    vi.doMock('../../utils/share', () => ({ shareToWhatsApp: vi.fn() }))
    vi.doMock('../../utils/analytics', () => ({ track: vi.fn() }))
    const { default: CelebrationModal } = await import('../CelebrationModal')
    const data = {
      practice_name: 'Hanuman Chalisa', practice_done_today: true,
      day_complete: true, overall_streak: 3, tier: 'Shishya', subjectName: 'Test',
    }
    const { container } = render(<CelebrationModal data={data} onClose={() => {}} />)
    expect(await seriousViolations(container, STANDALONE_CONFIG)).toEqual([])
  })
})
