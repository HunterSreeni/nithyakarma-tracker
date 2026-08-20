import { defineConfig } from '@playwright/test'
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
    // full chromium "new headless": the default headless shell has no
    // Notification API, which the notification-toggle test needs
    channel: 'chromium',
    screenshot: 'only-on-failure',
    permissions: ['notifications'],
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
