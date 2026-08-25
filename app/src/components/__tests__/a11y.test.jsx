import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
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

  it('About page', async () => {
    const { AboutPage } = await import('../InfoPages')
    const { container } = render(<MemoryRouter><AboutPage /></MemoryRouter>)
    expect(await seriousViolations(container, STANDALONE_CONFIG)).toEqual([])
  })

  it('Karma page', async () => {
    const { KarmaPage } = await import('../InfoPages')
    const { container } = render(<MemoryRouter><KarmaPage /></MemoryRouter>)
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
    vi.doMock('../MonthlySpecialBanner', () => ({ default: () => null }))
    vi.doMock('../ObservanceBanner', () => ({ default: () => null }))
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

  // Calendar page (Intent 2.11). Rendered inside Layout, the way it really is,
  // so the nav/main landmarks are real rather than mocked away - and once per
  // view, because the three views share almost no markup.
  const renderCalendar = async () => {
    vi.resetModules()
    vi.doMock('../../hooks/useAuth', () => ({
      useAuth: () => ({
        profile: { display_name: 'Test User', panchangam_tradition: 'tamil', current_streak: 0 },
        signOut: vi.fn(),
      }),
    }))
    const days = Array.from({ length: 31 }, (_, i) => ({
      date: i < 15
        ? `2026-08-${String(17 + i).padStart(2, '0')}`
        : `2026-09-${String(i - 14).padStart(2, '0')}`,
      thithi: 'Shukla Ekadashi', nakshatra: 'Mula',
      tamil_month: 'Aavani', tamil_day: i + 1,
      malayalam_month: 'Chingam', malayalam_day: i + 1,
      varsham_name: 'Parabhava', kollavarsham_year: 1202,
      rahu_kalam_start: '17:07', rahu_kalam_end: '18:40',
      yamagandam_start: '12:28', yamagandam_end: '14:01',
      gulika_kalam_start: '15:34', gulika_kalam_end: '17:07',
    }))
    vi.doMock('../../lib/supabase', () => ({
      supabase: {
        from: (table) => ({
          select: () => table === 'panchangam_days'
            ? { gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: days, error: null }) }) }) }
            : Promise.resolve({ data: [], error: null }),
        }),
      },
    }))
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    const { default: Layout } = await import('../Layout')
    const { default: CalendarPage } = await import('../CalendarPage')
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <Layout><CalendarPage /></Layout>
        </QueryClientProvider>
      </MemoryRouter>,
    )
  }

  it('CalendarPage day view inside Layout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-23T08:00:00+05:30'))
    const { container, findByText } = await renderCalendar()
    await findByText('ஆவணி 7')
    expect(await seriousViolations(container)).toEqual([])
    vi.useRealTimers()
  })

  it('CalendarPage week view inside Layout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-23T08:00:00+05:30'))
    const { container, findByText, getByRole } = await renderCalendar()
    await findByText('ஆவணி 7')
    fireEvent.click(getByRole('button', { name: 'Week' }))
    await findByText('ஞாயிறு')
    expect(await seriousViolations(container)).toEqual([])
    vi.useRealTimers()
  })

  // The grid is the risky one: 31 tappable cells whose visible text is just
  // two numbers, which without an aria-label read out as one run-on number.
  it('CalendarPage month view inside Layout', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-23T08:00:00+05:30'))
    const { container, findByText, getByRole, findByRole } = await renderCalendar()
    await findByText('ஆவணி 7')
    fireEvent.click(getByRole('button', { name: 'Month' }))
    expect(await findByRole('button', { name: 'Aavani 1, 17 Aug' })).toBeInTheDocument()
    expect(await seriousViolations(container)).toEqual([])
    vi.useRealTimers()
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
