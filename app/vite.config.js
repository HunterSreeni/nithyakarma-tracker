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
    exclude: ['e2e/**', 'node_modules/**'],
  },
  }
})
