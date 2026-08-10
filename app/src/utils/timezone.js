// The device's IANA timezone, normalised.
//
// This reads the OS timezone SETTING via Intl. It is not geolocation: no
// permission, no prompt, no GPS and no IP lookup - which is why the app has
// always been able to read it (useNotifications has done so since push
// reminders shipped) without any location permission.
//
// It is also more accurate than anything IP-derived would be: VPNs, carrier
// routing and travel all break IP geolocation, while the OS setting follows
// the user.

// Some JS engines (older Android WebView ICU data) still resolve to the
// deprecated IANA alias instead of the canonical zone name - normalise the
// ones relevant to this app's audience before storing, so the same physical
// device cannot produce two different strings.
const TZ_ALIASES = { 'Asia/Calcutta': 'Asia/Kolkata' }

// Matches profiles.timezone's column default and local_today()'s fallback.
export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function deviceTimezone() {
  try {
    const raw = Intl.DateTimeFormat().resolvedOptions().timeZone
    return TZ_ALIASES[raw] ?? raw ?? DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE // ancient WebView with no Intl - fall back, never throw
  }
}
