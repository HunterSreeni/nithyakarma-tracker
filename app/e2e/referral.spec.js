import { test, expect } from '@playwright/test'

// Referral code applied at signup (onboarding), end to end. Uses a disposable
// throwaway account seeded via supabase/tests/seed-referral-throwaway.sql
// (Supabase MCP) before this spec runs - it's pre-confirmed so login works
// without an email round-trip. The referral code itself isn't a secret (it's
// meant to be shared via invite links), so it's fine to reference directly.
// This spec deletes its own throwaway account at the end.
const EMAIL = 'referral-throwaway@nithyakarma.test'
const PASSWORD = process.env.E2E_REFERRAL_THROWAWAY_PASSWORD
const REFERRAL_CODE = process.env.E2E_REFERRER_CODE

test.describe('Referral applied at signup', () => {
  test.skip(!PASSWORD || !REFERRAL_CODE,
    'E2E_REFERRAL_THROWAWAY_PASSWORD / E2E_REFERRER_CODE not set (see supabase/tests/seed-referral-throwaway.sql)')

  test('applying a valid referral code during onboarding completes onboarding, then the account is deleted', async ({ page }) => {
    await page.goto(`/?ref=${REFERRAL_CODE}`)
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', EMAIL)
    await page.fill('#auth-password', PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()

    await page.getByRole('button', { name: /Get started/ }).click()
    await page.getByLabel('Your name').fill('Referral Throwaway')
    await page.getByRole('button', { name: 'Female', exact: true }).click()
    await expect(page.getByPlaceholder("From a friend's invite link")).toHaveValue(REFERRAL_CODE)
    await page.getByRole('button', { name: /Begin/ }).click()
    await expect(page.getByText(/Namaskaram, Referral/)).toBeVisible({ timeout: 15000 })

    // Self-cleanup: this is a throwaway account, delete it now that the
    // referral apply has been exercised (DB state is verified separately).
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByPlaceholder('Type DELETE').fill('DELETE')
    await page.getByRole('button', { name: /Delete my account/ }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
