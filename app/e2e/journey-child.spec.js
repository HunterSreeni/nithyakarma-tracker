import { test, expect } from '@playwright/test'

// Family-member (child) coverage on the preserved, stable e2e account (see
// memory: e2e-account-keep - kept as-is until Play Store release). This spec
// creates ONE family-member fixture, exercises it (including the yesterday
// Sandhya catch-up, migration 20260810130000), then removes that family
// member in a `finally` so the account's own profile/streak/punya are
// untouched run over run. Non-destructive to the account itself - unlike
// journey.spec.js, this never deletes the account. Credentials are never
// committed; set E2E_UI_EMAIL / E2E_UI_PASSWORD locally or as a CI secret.
const EMAIL = process.env.E2E_UI_EMAIL
const PASSWORD = process.env.E2E_UI_PASSWORD
const CHILD_NAME = 'E2E Test Child'

test.describe('Family member (child) - Sandhyavandhanam + yesterday catch-up', () => {
  test.skip(!EMAIL || !PASSWORD, 'E2E_UI_EMAIL / E2E_UI_PASSWORD not set')

  test('a boy with upanayanam done gets Sandhyavandhanam, including the yesterday catch-up', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', EMAIL)
    await page.fill('#auth-password', PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15000 })

    // Idempotency: a previous run that failed before its own cleanup could
    // have left this fixture behind - remove it before creating a fresh one.
    await page.getByRole('link', { name: /Profile/ }).first().click()
    const leftover = page.locator('.fam-row', { hasText: CHILD_NAME })
    if (await leftover.count()) {
      page.once('dialog', d => d.accept())
      await leftover.getByRole('button', { name: 'Remove' }).click()
      await expect(leftover).toHaveCount(0, { timeout: 15000 })
    }

    await page.getByRole('button', { name: '+ Add family member' }).click()
    await page.getByLabel("Child's name").fill(CHILD_NAME)
    await page.getByRole('button', { name: 'Boy' }).click()
    await page.getByLabel(/Upanayanam done/).check()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.fam-row', { hasText: CHILD_NAME })).toBeVisible({ timeout: 15000 })

    try {
      await page.getByRole('link', { name: /Today/ }).first().click()
      await page.locator('.ps-chip', { hasText: CHILD_NAME }).click()
      await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toBeVisible({ timeout: 15000 })

      // Fresh child: today's own card starts at 0 of 3, nothing marked yet.
      await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()

      // Yesterday catch-up opens to all 3 slots undone for a fresh child.
      await page.getByRole('button', { name: 'Missed a sandhya yesterday?' }).click()
      await expect(page.getByText('Half punya, no streak effect - just credit for doing it.')).toBeVisible()
      const yesterdayPanel = page.locator('.yesterday-panel')
      await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeVisible()

      // Mark one slot for yesterday: punya-only, no celebration/ad modal.
      await yesterdayPanel.getByRole('button', { name: 'Morning' }).click()
      await expect(page.getByText(/\+\d+ punya for yesterday's Morning/)).toBeVisible({ timeout: 15000 })
      await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeDisabled()

      // The backdated mark must not touch today's own card - still 0 of 3,
      // proving streak/day-complete are untouched (business rule confirmed
      // 2026-08-10: streak only ever advances from today's own mark).
      await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()
    } finally {
      // Cleanup: back to self, then remove the child (cascades their
      // user_practices and logs) so the account's baseline is unchanged.
      await page.getByRole('link', { name: /Today/ }).first().click()
      await page.locator('.ps-chip', { hasText: 'Me' }).click()
      await page.getByRole('link', { name: /Profile/ }).first().click()
      const fixture = page.locator('.fam-row', { hasText: CHILD_NAME })
      if (await fixture.count()) {
        page.once('dialog', d => d.accept())
        await fixture.getByRole('button', { name: 'Remove' }).click()
        await expect(fixture).toHaveCount(0, { timeout: 15000 })
      }
    }
  })
})
