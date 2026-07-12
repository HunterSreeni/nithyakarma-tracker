import { test, expect } from '@playwright/test'

// Full user journey against the production build + live Supabase backend.
// Runs against the dedicated DESTRUCTIVE account e2efull - the final step
// deletes it (cascade) and onboarding recreates it, so the suite is rerunnable
// WITHOUT touching the preserved e2e account. See memory: e2efull-account.
// CI injects these via the E2E_EMAIL / E2E_PASSWORD secrets; the committed
// defaults keep local runs working without any env setup.
const EMAIL = process.env.E2E_EMAIL ?? 'e2efull@nithyakarma.test'
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eFull#2026'

test.describe.serial('Nithyakarma full journey', () => {
  let page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })
  test.afterAll(async () => {
    await page.close()
  })

  test('login with email/password', async () => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', EMAIL)
    await page.fill('#auth-password', PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText('A few details to set up your anushtanams')).toBeVisible({ timeout: 15000 })
  })

  test('onboarding: male user gets Sandhyavandhanam, then the guided tour runs', async () => {
    await page.getByLabel('Your name').fill('E2E Sreeni')
    await page.getByRole('button', { name: 'Male', exact: true }).click()
    await expect(page.getByText(/Sandhyavandhanam .* will be added/)).toBeVisible()
    await page.getByRole('button', { name: /Begin/ }).click()
    await expect(page.getByText(/Namaskaram, E2E/)).toBeVisible({ timeout: 15000 })

    // driver.js first-run tour auto-runs: welcome -> sandhya slots -> add-practice.
    // Stepping through it both exercises the tour and dismisses it.
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 10000 })
    await page.locator('.driver-popover-next-btn').click()
    await expect(page.getByText('Sandhyavandhanam is three sandhyas')).toBeVisible()
    await page.locator('.driver-popover-next-btn').click()
    await expect(page.getByText("You're all set")).toBeVisible()
    await page.locator('.driver-popover-next-btn').click() // "Begin" done button
    await expect(page.locator('.driver-popover')).toBeHidden()

    await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Morning/ })).toBeVisible()
  })

  test('sandhya 3-slot: 1-2 slots progress, 3rd completes the day', async () => {
    // Slot 1 - verified save + share card, no ad on web
    await page.getByRole('button', { name: 'Morning' }).click()
    await expect(page.getByText('Punyam grows daily', { exact: false })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Join me on Nithyakarma')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('1 of 3 sandhyas done')).toBeVisible()

    // Slot 2 - still progressing
    await page.getByRole('button', { name: 'Noon' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('2 of 3 sandhyas done')).toBeVisible()

    // Slot 3 - day complete
    await page.getByRole('button', { name: 'Evening' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('All 3 sandhyas done 🎉')).toBeVisible()
  })

  test('add a practice from the dropdown', async () => {
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await page.getByPlaceholder('🔍 Search...').fill('hanuman')
    await page.getByRole('button', { name: /Hanuman Chalisa/ }).click()
    await expect(page.locator('.practice-card', { hasText: 'Hanuman Chalisa' })).toBeVisible()
  })

  test('complete a general practice: celebration from verified response', async () => {
    await page.locator('.practice-card', { hasText: 'Hanuman Chalisa' })
      .getByRole('button', { name: 'Mark Done' }).click()
    await expect(page.getByText(/Hanuman Chalisa completed/)).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.locator('.practice-card.done', { hasText: 'Hanuman Chalisa' })).toBeVisible()
  })

  test('Sabha leaderboard shows my row; Kids tab is separate', async () => {
    await page.getByRole('link', { name: /Sabha/ }).first().click()
    await expect(page.locator('.lb-row.me')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('.lb-row.me')).toContainText('(You)')
    await page.getByRole('button', { name: /Kids/ }).click()
    await expect(page.getByText('Bala Sabha', { exact: true })).toBeVisible()
  })

  test('add a family member (girl, Bala Sabha opt-in)', async () => {
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByRole('button', { name: '+ Add family member' }).click()
    await page.getByLabel("Child's name").fill('Devika')
    await page.getByRole('button', { name: 'Girl' }).click()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.fam-row', { hasText: 'Devika' })).toBeVisible({ timeout: 15000 })
    // switcher chip appears on Today
    await page.getByRole('link', { name: /Today/ }).first().click()
    await expect(page.locator('.ps-chip', { hasText: 'Devika' })).toBeVisible()
    // and she appears in Bala Sabha
    await page.getByRole('link', { name: /Sabha/ }).first().click()
    await page.getByRole('button', { name: /Kids/ }).click()
    await expect(page.locator('.lb-row', { hasText: 'Devika' })).toBeVisible({ timeout: 15000 })
  })

  test('edit profile name', async () => {
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByLabel('Display name').fill('E2E Sreeni Renamed')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('button', { name: 'Saved ✓' })).toBeVisible({ timeout: 15000 })
  })

  test('leaderboard privacy opt-out persists', async () => {
    const optOut = page.getByRole('checkbox', { name: /Hide me from community leaderboards/ })
    await expect(optOut).not.toBeChecked()
    const saved = page.waitForResponse(r =>
      r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH')
    await optOut.check()
    await saved
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Hide me from community leaderboards/ }))
      .toBeChecked({ timeout: 15000 })
    // own row must still be visible to the opted-out user
    await page.getByRole('link', { name: /Sabha/ }).first().click()
    await expect(page.locator('.lb-row.me')).toBeVisible({ timeout: 15000 })
    await page.getByRole('link', { name: /Profile/ }).first().click()
  })

  test('notification toggle enables and saves the preference', async () => {
    const toggle = page.getByRole('checkbox', { name: /Reminder notifications/ })
    await expect(toggle).toBeEnabled({ timeout: 15000 })
    await expect(toggle).not.toBeChecked()
    await toggle.click() // state flips after async permission+save
    await expect(toggle).toBeChecked({ timeout: 15000 })
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Reminder notifications/ }))
      .toBeChecked({ timeout: 15000 })
  })

  test('delete account cascades and returns to auth', async () => {
    await page.getByPlaceholder('Type DELETE').fill('DELETE')
    await page.getByRole('button', { name: /Delete my account/ }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
