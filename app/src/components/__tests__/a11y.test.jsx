import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import axe from 'axe-core'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signInGoogle: vi.fn(), signInEmail: vi.fn(), signUpEmail: vi.fn() }),
}))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

import AuthPage from '../AuthPage'
import { TermsPage, PrivacyPage } from '../LegalPages'

// Color contrast is verified manually (jsdom can't compute it); region/landmark
// rules don't apply to these standalone fragments. Everything else must pass.
const CONFIG = { rules: { 'color-contrast': { enabled: false }, region: { enabled: false } } }

async function seriousViolations(container) {
  const { violations } = await axe.run(container, CONFIG)
  return violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => `${v.id} (${v.nodes.length}): ${v.help}`)
}

describe('accessibility (axe-core, WCAG 2.1 AA subset)', () => {
  it('AuthPage', async () => {
    const { container } = render(<MemoryRouter><AuthPage /></MemoryRouter>)
    expect(await seriousViolations(container)).toEqual([])
  })

  it('Terms & Conditions page', async () => {
    const { container } = render(<MemoryRouter><TermsPage /></MemoryRouter>)
    expect(await seriousViolations(container)).toEqual([])
  })

  it('Privacy Policy page', async () => {
    const { container } = render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
    expect(await seriousViolations(container)).toEqual([])
  })
})
