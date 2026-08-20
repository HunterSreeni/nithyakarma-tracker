import { test, expect } from '@playwright/test'
import { SEEDING_CONFIGURED, seedSession } from './helpers/session.js'

// Sign-out flow against the preserved, stable e2e account (has a profile
// already, kept as-is until Play Store release - see memory). Non-destructive:
// it seeds a session and signs out, no state is mutated.
//
// The session arrives via Supabase's admin API rather than the sign-in form -
// see helpers/session.js for why a UI password sign-in cannot work here.
test.describe('Sign out', () => {
  // A silently skipped test reads as coverage it does not provide. This spec
  // skipped itself for its whole life because E2E_UI_EMAIL / E2E_UI_PASSWORD
  // were never created as repo secrets, and CI stayed green throughout.
  // Skipping is fine on a local run with no secrets; in CI the secrets are
  // expected, so a missing one is a configuration failure and must be loud.
  test.skip(!SEEDING_CONFIGURED && !process.env.CI, 'session seeding env not set (local run)')

  test('logging out from the topbar returns to the auth screen', async ({ page }) => {
    expect(
      SEEDING_CONFIGURED,
      'CI must provide SUPABASE_SERVICE_ROLE_KEY and E2E_UI_EMAIL for session seeding',
    ).toBe(true)

    await seedSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
