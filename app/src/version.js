import pkg from '../package.json'

// Single source of truth for the app version, driven by release-please via
// package.json. Surfaced on the Profile screen so users/support see the build.
export const APP_VERSION = pkg.version
