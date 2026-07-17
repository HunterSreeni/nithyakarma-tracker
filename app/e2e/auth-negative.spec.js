import { test, expect } from '@playwright/test'

// Negative / edge-case auth paths that need no authenticated session.
test.describe('Auth edge cases', () => {
  test('rejects invalid credentials with a visible error', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', 'nobody@nithyakarma.test')
    await page.fill('#auth-password', 'wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible({ timeout: 15000 })
    // stays on the auth screen
    await expect(page.getByText('Continue with Google')).toBeVisible()
  })

  test('toggles between sign-in and create-account modes', async ({ page }) => {
    await page.goto('/')
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
