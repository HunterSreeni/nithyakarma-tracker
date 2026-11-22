import { test, expect } from '@playwright/test'
import { SEEDING_CONFIGURED, seedSession } from './helpers/session.js'

// Phone-width layout guard. Runs only in the iphone-webkit and iphone-chromium
// projects (see playwright.config.js). Born from the Jadhagam date of birth
// field running off its card on iPhone (2026-11-22).
//
// Two checks per page:
//  1. nothing is wider than the screen (no sideways page scroll, no element
//     poking past the right or left edge), ignoring content inside a box that
//     deliberately scrolls or clips sideways (chip rows, tables);
//  2. every form field sits inside its card.
// Non-destructive: it only opens pages. The session is seeded through the
// admin API - see helpers/session.js.

function findOverflow() {
  const vw = document.documentElement.clientWidth
  const problems = []
  const label = (el) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).join('.')}` : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`
  }
  const clipped = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX
      if (ox !== 'visible') return true
    }
    return false
  }
  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px content in a ${vw}px screen`)
  }
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const style = getComputedStyle(el)
    if (style.visibility === 'hidden') continue
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) {
      problems.push(`${label(el)} spans ${Math.round(r.left)}..${Math.round(r.right)}px, screen is ${vw}px`)
    }
  }
  for (const el of document.querySelectorAll('input, select, textarea')) {
    const card = el.closest('.card')
    if (!card) continue
    const r = el.getBoundingClientRect()
    const c = card.getBoundingClientRect()
    if (r.width === 0) continue
    if (r.right > c.right + 1 || r.left < c.left - 1) {
      problems.push(`${label(el)} (${Math.round(r.left)}..${Math.round(r.right)}px) is outside its card (${Math.round(c.left)}..${Math.round(c.right)}px)`)
    }
  }
  return problems
}

async function expectNoOverflow(page) {
  // Let late layout (fonts, data-driven rows) settle before measuring. Not
  // 'networkidle': the sign-in screen's captcha and analytics keep polling.
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(1000)
  const problems = await page.evaluate(findOverflow)
  expect(problems, problems.join('\n')).toEqual([])
}

test.describe('Phone layout: signed out', () => {
  test('sign-in screen fits the screen', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('input[type="email"]').first()).toBeVisible({ timeout: 15000 })
    await expectNoOverflow(page)
  })
})

test.describe('Phone layout: signed in', () => {
  test.skip(!SEEDING_CONFIGURED && !process.env.CI, 'session seeding env not set (local run)')

  test.beforeEach(async ({ page }) => {
    expect(
      SEEDING_CONFIGURED,
      'CI must provide SUPABASE_SERVICE_ROLE_KEY and E2E_UI_EMAIL for session seeding',
    ).toBe(true)
    await seedSession(page)
  })

  const pages = [
    ['Today', '/'],
    ['Profile and family', '/profile'],
    ['Jadhagam new chart form', '/birth-chart/new'],
    ['Calendar', '/calendar'],
    ['History', '/history'],
    ['Sabha', '/sabha'],
    ['Learning', '/learning'],
  ]
  for (const [name, path] of pages) {
    test(`${name} fits the screen`, async ({ page }) => {
      await page.goto(path)
      // The phone layout hides the top bar's Logout button; the bottom tab bar
      // only renders once signed in.
      await expect(page.getByRole('navigation', { name: 'Bottom' })).toBeVisible({ timeout: 15000 })
      if (path === '/birth-chart/new') await expect(page.locator('#bc-date')).toBeVisible()
      await expectNoOverflow(page)
    })
  }
})
