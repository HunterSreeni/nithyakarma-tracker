import { Capacitor } from '@capacitor/core'

// AI-DEV NOTE: the Jadhagam (birth charts) is left out of the iPhone app for its
// first App Store submission (Sreeni, 2026-11-26). Apple guideline 4.3(b) refuses
// new "fortune telling" apps and Vedic chart apps were being rejected for it in
// 2025-2026. This is a fixed platform check shipped in the binary, never a remote
// switch: turning it back on must be a new submitted build with the feature in its
// review notes (guideline 2.3.1, no hidden features). Android and web keep it.
export const JADHAGAM_ENABLED = Capacitor.getPlatform() !== 'ios'
