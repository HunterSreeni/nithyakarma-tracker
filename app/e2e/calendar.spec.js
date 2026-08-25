import { test, expect } from '@playwright/test'
import { SEEDING_CONFIGURED, seedSession } from './helpers/session.js'

// Calendar page (Intent 2.11) in a real browser. Everything else about this
// page is covered in jsdom (CalendarPage.test.jsx, nativeCalendar.test.js,
// a11y.test.jsx), which is where the panchangam arithmetic is pinned against
// fixed fixtures. This spec deliberately does NOT re-assert any of that: it
// runs against whatever real panchangam rows the project happens to hold, so
// every assertion here is relational (the label changed, the label changed
// back) rather than a hardcoded date. A spec that asserted "Aavani 9" would
// start failing the day the calendar left Aavani.
//
// Non-destructive: this page only reads. The session is seeded through the
// admin API rather than typed - see helpers/session.js for why a UI password
// sign-in cannot work against a captcha-protected project.
const STEP_LIMIT = 20

test.describe('Calendar page', () => {
  test.skip(!SEEDING_CONFIGURED && !process.env.CI, 'session seeding env not set (local run)')

  test.beforeEach(async ({ page }) => {
    expect(
      SEEDING_CONFIGURED,
      'CI must provide SUPABASE_SERVICE_ROLE_KEY and E2E_UI_EMAIL for session seeding',
    ).toBe(true)
    await seedSession(page)
  })

  const gotoCalendar = async (page) => {
    await page.goto('/calendar')
    await expect(page.getByRole('heading', { level: 1, name: 'Panchangam' })).toBeVisible({ timeout: 15000 })
    // The steppers only settle once the window query resolves; waiting on the
    // header label keeps every later step off the loading state.
    await expect(page.locator('.cal-roman')).not.toBeEmpty()
  }

  test('the Calendar tab replaces Referrals in the nav and opens the calendar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible({ timeout: 15000 })

    await expect(page.getByRole('link', { name: /Referrals/ })).toHaveCount(0)
    await page.getByRole('link', { name: /Calendar/ }).first().click()

    await expect(page).toHaveURL(/\/calendar$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Panchangam' })).toBeVisible()
  })

  // The ReferralsPage component and referralsCache are still on disk (dead, no
  // route, no importers). This proves the redirect is what actually serves
  // /referrals, so old share links and push payloads keep working whether or
  // not those orphan files ever get deleted.
  test('/referrals redirects to the Profile invite card', async ({ page }) => {
    await page.goto('/referrals')
    await expect(page).toHaveURL(/\/profile$/, { timeout: 15000 })
    await expect(page.getByText('Invite & earn rewards')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Panchangam' })).toHaveCount(0)
  })

  test('the Day/Week/Month segment switches views and reports pressed state', async ({ page }) => {
    await gotoCalendar(page)
    const seg = page.getByRole('group', { name: 'Calendar view' })

    for (const label of ['Week', 'Month', 'Day']) {
      await seg.getByRole('button', { name: label }).click()
      await expect(seg.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'true')
      // Exactly one segment is ever pressed.
      await expect(seg.locator('button[aria-pressed="true"]')).toHaveCount(1)
    }

    // Day is the view the page opens on, and the one it just returned to.
    await expect(page.getByText('Times shown in IST')).toBeVisible()
  })

  // The three views share one CalHeader, so this covers both stepper buttons
  // in each of them. Stepping forward then back must land on the original
  // label - that is what caught the month view holding its own stale index.
  for (const view of ['Day', 'Week', 'Month']) {
    test(`the ${view.toLowerCase()} view steppers move forward and back symmetrically`, async ({ page }) => {
      await gotoCalendar(page)
      await page.getByRole('group', { name: 'Calendar view' })
        .getByRole('button', { name: view }).click()

      const label = page.locator('.cal-roman')
      const start = await label.textContent()

      const next = page.getByRole('button', { name: 'Next' })
      const prev = page.getByRole('button', { name: 'Previous' })
      test.skip(await next.isDisabled(), `${view} view already at the end of the loaded panchangam`)

      await next.click()
      await expect(label).not.toHaveText(start)

      await prev.click()
      await expect(label).toHaveText(start)
    })
  }

  test('a month grid cell opens that day in the day view', async ({ page }) => {
    await gotoCalendar(page)
    await page.getByRole('group', { name: 'Calendar view' })
      .getByRole('button', { name: 'Month' }).click()

    const cells = page.locator('.cal-grid button.cal-cell')
    await expect(cells.first()).toBeVisible()

    // Every loaded cell is a button carrying its own accessible name; empty
    // cells are non-interactive divs on purpose, so this locator skips them.
    const target = cells.nth(await cells.count() > 3 ? 3 : 0)
    const name = await target.getAttribute('aria-label')
    await target.click()

    // The label reads "<Month> <nativeDay>, <d Mon>" - the day view's own
    // roman header is "<Month> <nativeDay>", i.e. the part before the comma.
    await expect(page.locator('.cal-roman')).toHaveText(name.split(',')[0])
    await expect(page.getByText('Times shown in IST')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Calendar view' })
      .getByRole('button', { name: 'Day' })).toHaveAttribute('aria-pressed', 'true')
  })

  // Both ends of the loaded span refuse to step off, and say why rather than
  // going blank. This is the pair of behaviours Sreeni asked for explicitly:
  // a visibly dead arrow AND a "not loaded yet" explanation.
  test('the month stepper stops at both ends of the loaded panchangam and explains why', async ({ page }) => {
    await gotoCalendar(page)
    await page.getByRole('group', { name: 'Calendar view' })
      .getByRole('button', { name: 'Month' }).click()

    const next = page.getByRole('button', { name: 'Next' })
    const prev = page.getByRole('button', { name: 'Previous' })

    for (let i = 0; i < STEP_LIMIT && !(await next.isDisabled()); i++) await next.click()
    await expect(next).toBeDisabled()
    await expect(page.locator('.cal-notloaded')).toBeVisible()

    for (let i = 0; i < STEP_LIMIT && !(await prev.isDisabled()); i++) await prev.click()
    await expect(prev).toBeDisabled()
  })

  // A disabled arrow must not merely look dead - clicking it must not move.
  test('a disabled stepper does not move the calendar', async ({ page }) => {
    await gotoCalendar(page)
    await page.getByRole('group', { name: 'Calendar view' })
      .getByRole('button', { name: 'Month' }).click()

    const prev = page.getByRole('button', { name: 'Previous' })
    for (let i = 0; i < STEP_LIMIT && !(await prev.isDisabled()); i++) await prev.click()

    const label = page.locator('.cal-roman')
    const stuck = await label.textContent()
    await prev.click({ force: true })
    await expect(label).toHaveText(stuck)
  })

  // Sweep rather than enumerate: whatever buttons each view renders, every one
  // of them must be reachable by an accessible name. This is what stops a new
  // control shipping as an unlabelled icon the way the grid cells first did.
  test('every button in every view has an accessible name', async ({ page }) => {
    await gotoCalendar(page)

    for (const view of ['Day', 'Week', 'Month']) {
      await page.getByRole('group', { name: 'Calendar view' })
        .getByRole('button', { name: view }).click()
      await expect(page.locator('.cal-viewseg button[aria-pressed="true"]')).toHaveCount(1)

      const { unnamed, total } = await page.evaluate(() => {
        const named = (el) => (
          el.getAttribute('aria-label') || el.textContent || ''
        ).trim().length > 0
        const buttons = [...document.querySelectorAll('main button, .cal-grid button')]
        return { unnamed: buttons.filter(el => !named(el)).map(el => el.className), total: buttons.length }
      })
      expect(unnamed, `${view} view has unlabelled buttons`).toEqual([])
      // Guards the sweep itself: if the selector ever stops matching, an empty
      // `unnamed` would pass while checking nothing. Every view renders at
      // least the 2 steppers + 3 segment buttons.
      expect(total, `${view} view matched no buttons - selector is stale`)
        .toBeGreaterThanOrEqual(5)
    }
  })

  // Cloudflare Web Analytics' RUM beacon is CORS-rejected when the built site
  // is served from localhost:4173 instead of its real origin, so it logs
  // console errors on every page load. That is preview-harness noise, not the
  // app - ignoring it keeps this guard meaningful instead of permanently red.
  const THIRD_PARTY_NOISE = /cloudflareinsights\.com|net::ERR_FAILED/

  test('switching views and stepping raises no page errors', async ({ page }) => {
    const errors = []
    // Uncaught exceptions are never excused, whatever their text.
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => {
      if (m.type() === 'error' && !THIRD_PARTY_NOISE.test(m.text())) errors.push(m.text())
    })

    await gotoCalendar(page)
    for (const view of ['Week', 'Month', 'Day']) {
      await page.getByRole('group', { name: 'Calendar view' })
        .getByRole('button', { name: view }).click()
      const next = page.getByRole('button', { name: 'Next' })
      if (!(await next.isDisabled())) await next.click()
    }

    expect(errors).toEqual([])
  })
})
