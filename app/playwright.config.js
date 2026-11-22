import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'

// Vite injects .env into the client build only - the Playwright node process
// never sees it, so helpers that read process.env (e2e/helpers/session.js)
// would find nothing on a local run even though .env has the values. Load it
// here. Anything already in the real environment wins, so the values CI passes
// to the step are never overridden.
for (const [key, value] of Object.entries(loadEnv('production', process.cwd(), ''))) {
  if (!process.env[key]) process.env[key] = value
}

export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  use: {
    // E2E_BASE_URL=https://... runs the suite against a deployed site
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  // AI-DEV NOTE: two projects. Every existing spec runs in desktop Chromium as
  // before. mobile-layout.spec.js runs at iPhone width in BOTH WebKit and
  // Chromium, after the iOS date field ran off its card (2026-11-22). Playwright
  // WebKit is not iOS Safari (no native iOS date control, no
  // -webkit-touch-callout), so this catches page-wide overflow, not every
  // iOS-only quirk; a real iOS Simulator check is the planned follow-up.
  projects: [
    {
      name: 'chromium',
      testIgnore: /mobile-layout\.spec\.js/,
      use: {
        // full chromium "new headless": the default headless shell has no
        // Notification API, which the notification-toggle test needs
        channel: 'chromium',
        permissions: ['notifications'],
      },
    },
    {
      name: 'iphone-webkit',
      testMatch: /mobile-layout\.spec\.js/,
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'iphone-chromium',
      testMatch: /mobile-layout\.spec\.js/,
      use: { ...devices['iPhone 13'], browserName: 'chromium', channel: 'chromium' },
    },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
