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
  loggingBehavior: 'none'
};

export default config;
