import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Fail the production build if Supabase env is missing, instead of silently
  // shipping an APK/bundle that white-screens on launch.
  if (command === 'build') {
    const env = loadEnv(mode, process.cwd(), 'VITE_')
    const missing = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_KEY'].filter((k) => !env[k])
    if (missing.length) {
      throw new Error(`Build aborted: missing env ${missing.join(', ')}. Create app/.env before building.`)
    }
  }
  return {
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    // supabase/functions/** runs on Deno, not Vite/Node - its *.test.ts files
    // use Deno.test and jsr: imports that vitest/esbuild can't transform.
    // Run those with `deno test` instead (see the file header comment).
    exclude: ['e2e/**', 'node_modules/**', 'supabase/functions/**', '.stryker-tmp/**'],
    // Coverage gate for the native-bridge wrappers and the R8 checker (the files
    // Stryker mutates). `npm run test:coverage`; plain `npm test` is unaffected.
    coverage: {
      provider: 'v8',
      include: [
        'src/utils/ads.js', 'src/utils/pushAndroid.js', 'src/utils/notifications.js',
        'src/utils/webPush.js', 'src/utils/haptics.js', 'src/utils/share.js', 'scripts/r8-check.mjs',
      ],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
  }
})
