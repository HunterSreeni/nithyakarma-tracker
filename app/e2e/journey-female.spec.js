import { test, expect } from '@playwright/test'

// Female-signup activation path (Intent 1.5 Testing Gate): profiles without
// Sandhyavandhanam land on the "Suggested to start" nudge instead of an empty
// Today, and can reach an actionable practice from it. Runs against the
// dedicated DESTRUCTIVE account e2efemale - the final step deletes it (auth
// user cascade), so the account MUST be re-seeded before each run via
// supabase/tests/seed-e2efemale.sql (through the Supabase MCP). @destructive,
// excluded from CI (see .github/workflows/ci.yml) - a manual pre-release gate.
const EMAIL = process.env.E2E_FEMALE_EMAIL ?? 'e2efemale@nithyakarma.test'
const PASSWORD = process.env.E2E_FEMALE_PASSWORD ?? 'E2eFemale#2026'

test('female onboarding reaches an actionable Today via the suggested-practices nudge @destructive', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Continue with Google')).toBeVisible()
  await page.fill('#auth-email', EMAIL)
  await page.fill('#auth-password', PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('button', { name: /Get started/ })).toBeVisible({ timeout: 15000 })

  await page.getByRole('button', { name: /Get started/ }).click() // value-prop intro -> form
  await page.getByLabel('Your name').fill('E2E Female')
  await page.getByRole('button', { name: 'Female', exact: true }).click()
  // the auto-add-Sandhyavandhanam line is male-only copy
  await expect(page.getByText(/Sandhyavandhanam .* will be added/)).toHaveCount(0)
  await page.getByRole('button', { name: /Begin/ }).click()

  // Notification prompt runs once, right after profile creation - exercise
  // the skip path here (journey.spec.js's male path exercises Enable).
  await expect(page.getByText('Turn on reminders?')).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Maybe later' }).click()

  await expect(page.getByText(/Namaskaram, E2E/)).toBeVisible({ timeout: 15000 })

  // Empty-day activation (Intent 1.5): no Sandhyavandhanam card, "Suggested to
  // start" nudge instead - the narrow-scope gate this spec exists to close.
  await expect(page.getByText('Suggested to start')).toBeVisible()
  await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toHaveCount(0)

  // First-run tour still runs, minus the sandhya-slots step (nothing to anchor on).
  await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 10000 })
  await page.locator('.driver-popover-next-btn').click()
  await expect(page.getByText("You're all set")).toBeVisible()
  await page.locator('.driver-popover-next-btn').click() // "Begin" done button
  await expect(page.locator('.driver-popover')).toBeHidden()

  // Add a suggested practice - the actionable moment the empty state exists for.
  await page.locator('.practice-card', { hasText: 'Lalitha Sahasranamam' })
    .getByRole('button', { name: '+ Add' }).click()
  await expect(page.locator('.practice-list .practice-card', { hasText: 'Lalitha Sahasranamam' }))
    .toBeVisible({ timeout: 15000 })

  await page.locator('.practice-card', { hasText: 'Lalitha Sahasranamam' })
    .getByRole('button', { name: 'Mark Done' }).click()
  await expect(page.getByText(/Lalitha Sahasranamam completed/)).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.locator('.practice-card.done', { hasText: 'Lalitha Sahasranamam' })).toBeVisible()

  await page.getByRole('link', { name: /Profile/ }).first().click()
  await page.getByPlaceholder(EMAIL).fill(EMAIL)
  await page.getByRole('button', { name: /Delete my account/ }).click()
  await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
})
