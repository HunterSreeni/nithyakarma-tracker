import { test, expect } from '@playwright/test'

// Negative / edge-case auth paths that need no authenticated session.
test.describe('Auth edge cases', () => {
  // Deliberately NOT called "rejects invalid credentials". It cannot verify
  // that, and claiming otherwise is what made this test misleading: with Auth's
  // captcha protection on project-wide, a headless run has no Turnstile token,
  // so Supabase rejects on "no captcha_token found" long before it ever looks
  // at the password. The test passed on that error while reading as if bad
  // credentials had been exercised. There is no way to reach a genuine
  // credentials rejection here without turning captcha off in production - so
  // this asserts only what it can actually observe, and the credentials-
  // specific error message is covered in
  // src/components/__tests__/AuthPage.test.jsx ("shows auth errors").
  test('a rejected sign-in surfaces a visible error and keeps the user out', async ({ page }) => {
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
