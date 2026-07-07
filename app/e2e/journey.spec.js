import { test, expect } from '@playwright/test'

// Full user journey against the production build + live Supabase backend.
// The final step deletes the account (cascade), so the suite is rerunnable.
const EMAIL = 'e2e@nithyakarma.test'
const PASSWORD = 'E2eTest#2026'

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

  test('onboarding: male user gets Sandhyavandhanam automatically', async () => {
    await page.getByLabel('Your name').fill('E2E Sreeni')
    await page.getByRole('button', { name: 'Male', exact: true }).click()
    await expect(page.getByText(/Sandhyavandhanam .* will be added/)).toBeVisible()
    await page.getByRole('button', { name: /Begin/ }).click()
    await expect(page.getByText(/Namaskaram, E2E/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Sandhyavandhanam', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Morning/ })).toBeVisible()
  })

  test('mark a sandhya slot: save verified, celebration shows, no ad on web', async () => {
    await page.getByRole('button', { name: 'Morning' }).click()
    await expect(page.getByText('Punyam grows daily', { exact: false })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Join me on Nithyakarma')).toBeVisible()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('button', { name: /✓ Morning/ })).toBeVisible()
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

  test('delete account cascades and returns to auth', async () => {
    await page.getByPlaceholder('Type DELETE').fill('DELETE')
    await page.getByRole('button', { name: /Delete my account/ }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
