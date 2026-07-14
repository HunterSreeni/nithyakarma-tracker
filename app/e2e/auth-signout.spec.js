import { test, expect } from '@playwright/test'

// Sign-out flow against the preserved, stable e2e account (has a profile
// already, kept as-is until Play Store release - see memory). Non-destructive:
// only signs in and out, no state is mutated. Credentials are never committed -
// set E2E_UI_EMAIL / E2E_UI_PASSWORD locally or as a CI secret to run this spec.
const EMAIL = process.env.E2E_UI_EMAIL
const PASSWORD = process.env.E2E_UI_PASSWORD

test.describe('Sign out', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_UI_EMAIL / E2E_UI_PASSWORD not set')

  test('logging out from the topbar returns to the auth screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', EMAIL)
    await page.fill('#auth-password', PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Logout' }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
