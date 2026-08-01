import { test, expect } from '@playwright/test'

// Negative / edge-case auth paths that need no authenticated session.
test.describe('Auth edge cases', () => {
  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', 'nobody@nithyakarma.test')
    await page.fill('#auth-password', 'wrongpassword')
    // Submit is gated on the Turnstile widget resolving (button reads
    // "Verifying..." and stays disabled until then) - wait for it rather
    // than racing the click against the async captcha token.
    const signIn = page.getByRole('button', { name: 'Sign In' })
    await expect(signIn).toBeEnabled({ timeout: 20000 })
    await signIn.click()
    // Whatever Supabase's exact rejection reason - bad credentials, or (when
    // Auth's captcha protection is on and this run has no Turnstile token to
    // offer, as in CI) "no captcha_token found" - a bad submit must surface
    // a visible error and never let the user through.
    await expect(page.locator('.auth-error')).toBeVisible({ timeout: 15000 })
    // stays on the auth screen
    await expect(page.getByText('Continue with Google')).toBeVisible()
  })

  test('toggles between sign-in and create-account modes', async ({ page }) => {
    await page.goto('/')
    // Submit button text stays "Verifying..." until Turnstile resolves.
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled({ timeout: 20000 })
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible()
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  })

  test('requires a password of at least 8 chars (native form validation)', async ({ page }) => {
    await page.goto('/')
    await page.fill('#auth-email', 'someone@nithyakarma.test')
    await page.fill('#auth-password', '123')
    await page.getByRole('button', { name: 'Sign In' }).click()
    // HTML5 minLength blocks submit; no auth request fires, error area stays empty
    await expect(page.locator('.auth-error')).toHaveCount(0)
    await expect(page.getByText('Continue with Google')).toBeVisible()
  })
})
