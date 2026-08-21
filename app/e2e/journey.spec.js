import { test, expect, chromium } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

// Full user journey against the production build + live Supabase backend.
// Runs against the dedicated DESTRUCTIVE account e2efull - the final step
// deletes it (auth user cascade), so the account MUST be re-seeded before each
// run via supabase/tests/seed-e2efull.sql (through the Supabase MCP). Because it
// mutates/destroys a shared live account, it is tagged @destructive and EXCLUDED
// from CI (see .github/workflows/ci.yml). It is a manual pre-release gate; CI
// runs only the non-destructive specs. See memory: e2efull-account.
// CI injects these via the E2E_EMAIL / E2E_PASSWORD secrets; the committed
// defaults keep local runs working without any env setup.
const EMAIL = process.env.E2E_EMAIL ?? 'e2efull@nithyakarma.test'
const PASSWORD = process.env.E2E_PASSWORD ?? 'E2eFull#2026'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4173'

test.describe.serial('Nithyakarma full journey @destructive', () => {
  let page, context, userDataDir

  // A plain browser.newContext() is Chromium-incognito-like, and Chrome
  // deliberately does not support the Push API in incognito (undetectable by
  // design - https://crbug.com/41124656). The notification-toggle test below
  // needs a real subscribe() to succeed, so this journey needs a persistent
  // (non-incognito) profile, unlike the other non-destructive specs.
  test.beforeAll(async () => {
    userDataDir = mkdtempSync(path.join(tmpdir(), 'nk-journey-'))
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      baseURL: BASE_URL,
      permissions: ['notifications', 'clipboard-read', 'clipboard-write'],
    })
    page = await context.newPage()
  })
  test.afterAll(async () => {
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  })

  test('login with email/password', async () => {
    await page.goto('/')
    await expect(page.getByText('Continue with Google')).toBeVisible()
    await page.fill('#auth-email', EMAIL)
    await page.fill('#auth-password', PASSWORD)
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByRole('button', { name: /Get started/ })).toBeVisible({ timeout: 15000 })
  })

  test('onboarding: male user gets Sandhyavandhanam, then the guided tour runs', async () => {
    await page.getByRole('button', { name: /Get started/ }).click() // value-prop intro -> form
    await page.getByLabel('Your name').fill('E2E Sreeni')
    await page.getByRole('button', { name: 'Male', exact: true }).click()
    await expect(page.getByText(/Sandhyavandhanam .* will be added/)).toBeVisible()
    await page.getByRole('button', { name: /Begin/ }).click()

    // Notification prompt runs once, right after profile creation - exercise
    // the real enable + test-push path (permission is pre-granted, see
    // playwright.config.js) rather than skipping past it.
    await expect(page.getByText('Turn on reminders?')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Enable notifications' }).click()
    await expect(page.getByText('Notifications enabled!')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page.getByText(/Namaskaram, E2E/)).toBeVisible({ timeout: 15000 })

    // driver.js first-run tour auto-runs: welcome -> sandhya slots -> add-practice.
    // Stepping through it both exercises the tour and dismisses it.
    await expect(page.locator('.driver-popover')).toBeVisible({ timeout: 10000 })
    await page.locator('.driver-popover-next-btn').click()
    await expect(page.getByText('Sandhyavandhanam has three times')).toBeVisible()
    await page.locator('.driver-popover-next-btn').click()
    await expect(page.getByText("You're all set")).toBeVisible()
    await page.locator('.driver-popover-next-btn').click() // "Begin" done button
    await expect(page.locator('.driver-popover')).toBeHidden()

    await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Morning/ })).toBeVisible()
  })

  test('sandhya 3-slot: 1-2 slots progress, 3rd completes the day', async () => {
    // Slot 1 - Gayatri count popup (pre-filled 108) confirms before the mark
    // is submitted, then verified save + share card, no ad on web
    await page.getByRole('button', { name: 'Morning' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Punyam grows daily', { exact: false })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('1 of 3 sandhyas done')).toBeVisible()

    // Slot 2 - still progressing
    await page.getByRole('button', { name: 'Noon' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('2 of 3 sandhyas done')).toBeVisible()

    // Slot 3 - day complete
    await page.getByRole('button', { name: 'Evening' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('All 3 sandhyas done')).toBeVisible()
  })

  test('add a practice from the dropdown', async () => {
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await page.getByPlaceholder('Search...').fill('hanuman')
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

  // Intent 2.9 (2026-08-20): morning/evening either-or, same any-1-of-N
  // semantics as Sri Rudram's 3 slots, not a required pair. Self is an
  // unmarried male throughout this journey (the onboarding test above never
  // sets Married), so Samidhadhanam is eligible and offered.
  test('add and mark Samidhadhanam: either slot alone completes it, the other stays available', async () => {
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await page.getByPlaceholder('Search...').fill('samidhadhanam')
    await page.getByRole('button', { name: /Samidhadhanam/ }).click()
    const card = page.locator('.practice-card', { hasText: 'Samidhadhanam' })
    await expect(card).toBeVisible({ timeout: 15000 })
    await expect(card.getByRole('button', { name: 'Morning' })).toBeVisible()
    await expect(card.getByRole('button', { name: 'Evening' })).toBeVisible()
    // No "Mark Done" button - like Sandhya/Rudram, it only ever marks by slot.
    await expect(card.getByRole('button', { name: 'Mark Done' })).toHaveCount(0)

    await card.getByRole('button', { name: 'Evening' }).click()
    await expect(card.locator('.done-check')).toBeVisible({ timeout: 15000 })
    await expect(card.getByRole('button', { name: 'Evening' })).toBeDisabled()
    // Morning was never required - still open, not forced into a 2nd mark.
    await expect(card.getByRole('button', { name: 'Morning' })).toBeEnabled()
  })

  test('Sabha leaderboard shows my row; Kids tab is separate', async () => {
    // Community/Sabha is opt-in (hidden by default) - enable it from Profile
    // before it appears in the nav at all.
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByRole('checkbox', { name: /Show the Sabha tab/ }).check()
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

  // Sandhyavandhanam/Samidhadhanam are both gated on gender==='male' &&
  // upanayanam_done for family members - Arjun (boy, upanayanam done) should
  // get both offered, Karthik (boy, no upanayanam) and Devika (girl, above)
  // should get neither.
  test('add two boys (upanayanam true/false) - Sandhya/Samidhadhanam dropdown gating', async () => {
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByRole('button', { name: '+ Add family member' }).click()
    await page.getByLabel("Child's name").fill('Arjun')
    await page.getByRole('button', { name: 'Boy' }).click()
    await page.getByLabel(/Upanayanam done/).check()
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.fam-row', { hasText: 'Arjun' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: '+ Add family member' }).click()
    await page.getByLabel("Child's name").fill('Karthik')
    await page.getByRole('button', { name: 'Boy' }).click()
    // leave "Upanayanam done" unchecked
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.fam-row', { hasText: 'Karthik' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('link', { name: /Today/ }).first().click()

    // Arjun (upanayanam done): both practices offered
    await page.locator('.ps-chip', { hasText: 'Arjun' }).click()
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await expect(page.getByRole('button', { name: /Sandhyavandhanam/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Samidhadhanam/ })).toBeVisible()
    await page.keyboard.press('Escape')

    // Karthik (no upanayanam): neither offered
    await page.locator('.ps-chip', { hasText: 'Karthik' }).click()
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await expect(page.getByRole('button', { name: /Sandhyavandhanam/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Samidhadhanam/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Devika (girl): neither offered
    await page.locator('.ps-chip', { hasText: 'Devika' }).click()
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await expect(page.getByRole('button', { name: /Sandhyavandhanam/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Samidhadhanam/ })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // back to self for the remaining tests
    await page.locator('.ps-chip', { hasText: 'Me' }).click()
  })

  // Migration 20260810130000: a Sandhya slot can be backdated to yesterday,
  // awards full punya (the "punya-only" name from the original migration
  // predates AGENTS.md's current rule - see "Streak & freeze"), and must
  // never touch today's own card (today's streak/day-complete only ever
  // advance from today's own mark). Arjun (added above, upanayanam done) is
  // Sandhya-eligible but has no practices yet - add it here.
  //
  // AI-DEV NOTE: this test previously asserted copy ("Half punya, no streak
  // effect...") that no longer exists anywhere in the app - a stale
  // assertion from before AGENTS.md's current "full punya, counts toward the
  // streak" rule, never caught because this @destructive spec was silently
  // skipped in CI until PR #132 (2026-08-20). Fixed to match the real,
  // currently-shipping copy in TodayPage.jsx's YesterdaySandhya component.
  test('family member (Arjun): Sandhyavandhanam yesterday catch-up awards full punya and counts toward the streak', async () => {
    await page.locator('.ps-chip', { hasText: 'Arjun' }).click()
    await page.getByRole('button', { name: /Add an anushtanam/ }).click()
    await page.getByRole('button', { name: /Sandhyavandhanam/ }).click()
    await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()

    await page.getByRole('button', { name: 'Missed a sandhya yesterday?' }).click()
    await expect(page.getByText("Full punya. Your first marked sandhya also counts yesterday toward your streak.")).toBeVisible()
    const yesterdayPanel = page.locator('.yesterday-panel')
    await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeVisible()

    await yesterdayPanel.getByRole('button', { name: 'Morning' }).click()
    await expect(page.getByText(/\+\d+ punya/)).toBeVisible({ timeout: 15000 })
    await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeDisabled()

    // The backdated mark must not touch today's own card - still 0 of 3.
    await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()

    // back to self for the remaining tests
    await page.locator('.ps-chip', { hasText: 'Me' }).click()
  })

  test('edit profile name', async () => {
    await page.getByRole('link', { name: /Profile/ }).first().click()
    await page.getByLabel('Display name').fill('E2E Sreeni Renamed')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15000 })
  })

  // Intent 2.10 (2026-08-20): a 2nd way to get the same referral link out,
  // alongside the pre-existing WhatsApp share button.
  test('copy referral link (Profile): writes the real link to the clipboard, then reverts its own label', async () => {
    await page.getByRole('button', { name: 'Copy link' }).click()
    await expect(page.getByRole('button', { name: /Copied/ })).toBeVisible()
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
    expect(clipboardText).toMatch(/\/r\/\S+/)
    // Reverts to "Copy link" on its own after the 2s confirmation window,
    // rather than sticking on "Copied" forever.
    await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible({ timeout: 4000 })
  })

  test('leaderboard visibility opt-in persists', async () => {
    const showMe = page.getByRole('checkbox', { name: /Show me on community leaderboards/ })
    await expect(showMe).not.toBeChecked()
    const saved = page.waitForResponse(r =>
      r.url().includes('/rest/v1/profiles') && r.request().method() === 'PATCH')
    await showMe.check()
    await saved
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Show me on community leaderboards/ }))
      .toBeChecked({ timeout: 15000 })
    // own row must still be visible regardless of opt-in state
    await page.getByRole('link', { name: /Sabha/ }).first().click()
    await expect(page.locator('.lb-row.me')).toBeVisible({ timeout: 15000 })
    await page.getByRole('link', { name: /Profile/ }).first().click()
  })

  test('notification toggle disables and re-enables, saving the preference', async () => {
    const toggle = page.getByRole('checkbox', { name: /Reminder notifications/ })
    await expect(toggle).toBeEnabled({ timeout: 15000 })
    // Already on: the onboarding step above enabled notifications.
    await expect(toggle).toBeChecked()
    await toggle.click() // turn off
    await expect(toggle).not.toBeChecked({ timeout: 15000 })
    await toggle.click() // turn back on - state flips after async permission+save
    await expect(toggle).toBeChecked({ timeout: 15000 })
    await page.reload()
    await expect(page.getByRole('checkbox', { name: /Reminder notifications/ }))
      .toBeChecked({ timeout: 15000 })
  })

  test('delete account cascades and returns to auth', async () => {
    await page.getByPlaceholder(EMAIL).fill(EMAIL)
    await page.getByRole('button', { name: /Delete my account/ }).click()
    await expect(page.getByText('Continue with Google')).toBeVisible({ timeout: 15000 })
  })
})
