// Capacitor "copy:after" hook - runs automatically after `cap copy`/`cap sync`.
// The Cloudflare Web Analytics beacon in index.html is meant for the real web
// app (app.nithyakarma.org); inside the bundled Android WebView it would still
// fire, but under a meaningless local hostname, polluting the web dashboard.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const path = 'android/app/src/main/assets/public/index.html'
if (existsSync(path)) {
  const html = readFileSync(path, 'utf8')
  const stripped = html.replace(
    /\s*<!-- Cloudflare Web Analytics -->[\s\S]*?<!-- End Cloudflare Web Analytics -->\n?/,
    '\n'
  )
  writeFileSync(path, stripped)
}
