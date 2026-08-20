import { test, expect } from '@playwright/test'
import { SEEDING_CONFIGURED, seedSession } from './helpers/session.js'

// Family-member (child) coverage on the preserved, stable e2e account (see
// memory: e2e-account-keep - kept as-is until Play Store release). This spec
// creates ONE family-member fixture, exercises it (including the yesterday
// Sandhya catch-up, migration 20260810130000), then removes that family
// member in a `finally` so the account's own profile/streak/punya are
// untouched run over run. Non-destructive to the account itself - unlike
// journey.spec.js, this never deletes the account.
//
// The session is seeded through Supabase's admin API rather than typed into
// the sign-in form - see helpers/session.js for why a UI password sign-in
// cannot work against a captcha-protected project.
// ProfileSwitcher renders a chip as initials + `name.split(' ')[0]`, i.e. the
// FIRST WORD only (ProfileSwitcher.jsx:17). This spec used to look the chip up
// by the full name, which can never match - that is why it timed out at 45s
// the first time it was ever actually allowed to run. The first word also has
// to be unique: the pre-existing 'E2E Test Boy'/'E2E Test Girl' fixtures both
// render a chip reading just "E2E", so a fixture named 'E2E Test Child' would
// be ambiguous against them even with the right selector.
const CHILD_NAME = 'E2EFixture Child'
const CHILD_CHIP = CHILD_NAME.split(' ')[0]

test.describe('Family member (child) - Sandhyavandhanam + yesterday catch-up', () => {
  // This spec gated on E2E_UI_PASSWORD, which was never created as a repo
  // secret, so it silently never ran in CI while CI reported green. Skipping
  // is fine on a local run with no secrets; in CI they are expected, so a
  // missing one is a configuration failure and must be loud.
  test.skip(!SEEDING_CONFIGURED && !process.env.CI, 'session seeding env not set (local run)')

  test('a boy with upanayanam done gets Sandhyavandhanam, including the yesterday catch-up', async ({ page }) => {
    expect(
      SEEDING_CONFIGURED,
      'CI must provide SUPABASE_SERVICE_ROLE_KEY and E2E_UI_EMAIL for session seeding',
    ).toBe(true)

    await seedSession(page)
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15000 })

    // Idempotency: a previous run that failed before its own cleanup could
    // have left this fixture behind - remove it before creating a fresh one.
    await page.getByRole('link', { name: /Profile/ }).first().click()
    // Same count() race as the cleanup below: wait for the family section to
    // actually render first, otherwise this check runs against an empty list
    // and a real leftover slips through, accumulating a new child every run.
    await expect(page.getByRole('button', { name: '+ Add family member' })).toBeVisible({ timeout: 15000 })
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
      await page.locator('.ps-chip', { hasText: CHILD_CHIP }).click()
      await expect(page.locator('.practice-card', { hasText: 'Sandhyavandhanam' })).toBeVisible({ timeout: 15000 })

      // Fresh child: today's own card starts at 0 of 3, nothing marked yet.
      await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()

      // Yesterday catch-up opens to all 3 slots undone for a fresh child.
      //
      // These assertions used to encode the ORIGINAL rule - "Half punya, no
      // streak effect" - which was correct when this spec was written
      // (85f4b04, 2026-08-10). Two days later 0357463 ("fix: count Sandhya
      // backfills toward streaks") deliberately replaced it with full punya
      // that does count toward the streak. That commit updated 13 files
      // including the unit tests and integration assertions, but not this
      // spec - it had no reason to notice, because the spec was skipping
      // silently in CI. Realigned here to the shipped behaviour, which is
      // also what TodayPage.jsx's own AI-DEV NOTE describes
      // ("one-day-only/full-punya/streak/freeze").
      await page.getByRole('button', { name: 'Missed a sandhya yesterday?' }).click()
      await expect(page.getByText('Full punya. Your first marked sandhya also counts yesterday toward your streak.')).toBeVisible()
      const yesterdayPanel = page.locator('.yesterday-panel')
      await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeVisible()

      // Marking a slot is a TWO step flow: the slot button only opens the
      // Gayatri count prompt, and the mark is submitted on Save
      // (TodayPage.jsx wires markYesterday to GayatriCountModal.onConfirm).
      // The spec used to click the slot and assert straight away, which left
      // this modal open - it then blocked the cleanup clicks underneath it.
      await yesterdayPanel.getByRole('button', { name: 'Morning' }).click()
      const countModal = page.getByRole('dialog', { name: /Gayatri Count/ })
      await expect(countModal).toBeVisible()
      await countModal.getByRole('button', { name: 'Save' }).click()

      // Scoped to the panel on purpose. An unscoped /\+\d+ punya/ against the
      // whole page matches other punya text and passes even when nothing was
      // submitted at all - which is exactly how the missing Save step above
      // stayed hidden. The note reads "+N punya · streak is now N days".
      await expect(yesterdayPanel.locator('.yesterday-success')).toContainText(/\+\d+ punya/, { timeout: 15000 })
      await expect(yesterdayPanel.getByRole('button', { name: 'Morning' })).toBeDisabled()

      // Still scoped to yesterday: today's own card is untouched at 0 of 3.
      // (The streak may now advance off this backfill - that is the point of
      // 0357463 - but today's slot count must not move.)
      await expect(page.getByText('0 of 3 sandhyas done')).toBeVisible()
    } finally {
      // Cleanup: back to self, then remove the child (cascades their
      // user_practices and logs) so the account's baseline is unchanged.
      await page.getByRole('link', { name: /Today/ }).first().click()
      await page.locator('.ps-chip', { hasText: 'Me' }).click()
      await page.getByRole('link', { name: /Profile/ }).first().click()
      const fixture = page.locator('.fam-row', { hasText: CHILD_NAME })
      // Wait for the row instead of counting immediately. locator.count()
      // resolves at once and does NOT wait for the family list to render, so
      // on a slower CI load it returned 0, the guard skipped the whole
      // cleanup, and the test still reported PASS while leaving the fixture
      // behind on the live account (CI run 32375374261 leaked one this way).
      // The fixture is created before the try block, so it must exist here -
      // asserting that is what makes a failed cleanup loud instead of silent.
      await expect(fixture).toHaveCount(1, { timeout: 15000 })
      page.once('dialog', d => d.accept())
      await fixture.getByRole('button', { name: 'Remove' }).click()
      await expect(fixture).toHaveCount(0, { timeout: 15000 })
    }
  })
})
