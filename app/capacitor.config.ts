import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.nithyakarma.app',
  appName: 'Nithyakarma',
  webDir: 'dist',
  // Capacitor's default ('debug') echoes every plugin payload to logcat on a
  // debuggable build. That included the whole OAuth callback URL - access_token,
  // refresh_token and the Google provider_token in cleartext - so anyone with
  // adb on a test device could lift a live session. Release builds were never
  // affected, but there is no reason to leak it during development either.
  // AI-DEV NOTE: CAP_DEBUG_LOGS=1 (set ONLY when building a local debug APK for the
  // USB test phone, see app/e2e/device/README.md) turns full logging back on for
  // detailed on-device testing. It does log tokens, so it must never be set for a
  // Play/CI build; the default stays 'none'.
  loggingBehavior: process.env.CAP_DEBUG_LOGS === '1' ? 'debug' : 'none'
};

export default config;
