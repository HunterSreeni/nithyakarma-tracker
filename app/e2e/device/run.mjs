// Human-in-the-loop physical Android device test (Appium UiAutomator2).
// See README.md. Default run is READ-ONLY; --writes adds data-changing steps and
// refuses to run them unless the signed-in profile is the e2e test account.
//
// AI-DEV NOTE: rules this script must keep (Sreeni, standing):
// - Never type passwords and never tap "Continue with Google": sign-in is always
//   done by the human at a prompt (bad automated taps once reached a real Google
//   account, memory android-e2e-sandhya-gotchas).
// - Never tap an ad. If an interstitial shows, the human closes it.
// - Find elements by exact label and fail if a label matches more than one
//   element, instead of guessing or tapping coordinates.
// - Wi-Fi is restored to its starting state no matter how the run ends.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
process.env.APPIUM_HOME ??= HERE
process.env.ANDROID_HOME ??= 'D:\\AndroidSDK'
process.env.JAVA_HOME ??= 'C:\\Program Files\\Java\\jdk-21'
const ADB = join(process.env.ANDROID_HOME, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb')
const PKG = 'org.nithyakarma.app'
const WRITES = process.argv.includes('--writes')
const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e@nithyakarma.test'

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const OUT = join(HERE, 'reports', stamp)
mkdirSync(OUT, { recursive: true })

const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' }).replace(/\r/g, '')
const shell = (...args) => adb('shell', ...args)
// Human-in-the-loop waits poll the phone instead of reading the keyboard, so the
// run also works when started for the human from another terminal.
async function waitForHuman(msg, done, timeoutMs = 10 * 60 * 1000) {
  console.log(`\n>>> HUMAN: ${msg} (waiting up to ${Math.round(timeoutMs / 60000)} min)`)
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (await done()) return
    await driver.pause(2000)
  }
  throw new Error(`timed out waiting for: ${msg}`)
}

const results = []
let driver = null
let server = null
let wifiWasOn = null
let n = 0

// ---------- evidence ----------
function scanLogcat() {
  const log = adb('logcat', '-d', '-v', 'brief')
  adb('logcat', '-c')
  const hits = log.split('\n').filter(l =>
    /FATAL EXCEPTION|AndroidRuntime.*E\/|Uncaught (TypeError|SyntaxError|ReferenceError|Error)/.test(l))
  return hits.map(l => l.slice(0, 200))
}

function memoryMb() {
  const m = shell('dumpsys', 'meminfo', PKG).match(/TOTAL(?: PSS)?:?\s+(\d+)/)
  return m ? Math.round(Number(m[1]) / 1024) : null
}

async function step(name, fn, { write = false } = {}) {
  if (write && !WRITES) return
  n++
  const t0 = Date.now()
  let status = 'pass'
  let note = ''
  try {
    note = (await fn()) || ''
  } catch (e) {
    status = e.skip ? 'skip' : 'fail'
    note = e.message.split('\n')[0]
  }
  const ms = Date.now() - t0
  const shot = `${String(n).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
  try { if (driver) await driver.saveScreenshot(join(OUT, shot)) } catch { /* screenshot best-effort */ }
  const errors = scanLogcat()
  if (errors.length && status === 'pass') status = 'fail'
  const mem = memoryMb()
  results.push({ name, status, ms, note, errors, mem, shot })
  console.log(`${status === 'pass' ? 'PASS' : status === 'skip' ? 'SKIP' : 'FAIL'}  ${name} (${ms} ms${mem ? `, ${mem} MB` : ''})${note ? ` - ${note}` : ''}`)
  for (const e of errors) console.log(`      log: ${e}`)
}

const skip = (msg) => Object.assign(new Error(msg), { skip: true })

// ---------- element helpers ----------
// The WebView exposes CSS text-transformed labels as rendered (the bottom nav
// reads "TODAY"), and each control appears twice: a clickable container (label in
// content-desc) plus its inner text node. Match the label as written and in
// upper case, and prefer the clickable element.
const xpathFor = (label, { clickable = false } = {}) => {
  const quote = s => (s.includes('"') ? `'${s}'` : `"${s}"`)
  const forms = [...new Set([label, label.toUpperCase()])].map(quote)
  const match = forms.map(q => `@text=${q} or @content-desc=${q}`).join(' or ')
  return `//*[${clickable ? '@clickable="true" and ' : ''}(${match})]`
}

async function findOne(label, { timeout = 15000, allowMany = false } = {}) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    let els = await driver.$$(xpathFor(label, { clickable: true }))
    if (!els.length) els = await driver.$$(xpathFor(label))
    if (els.length === 1 || (allowMany && els.length > 1)) return els[0]
    if (els.length > 1) throw new Error(`"${label}" is ambiguous (${els.length} matches) - not tapping`)
    await driver.pause(500)
  }
  throw new Error(`"${label}" not found within ${timeout} ms`)
}

const isShown = async (label) => (await driver.$$(xpathFor(label))).length > 0

// Never tapped by automation, whatever a future step asks for.
const NEVER_TAP = [/delete/i, /sign out/i, /continue with google/i, /send test notification/i, /\bad\b|advert|install now/i]

// Bottom-nav tabs are fixed on screen, outside the scrollable content band.
const NAV = ['Today', 'Learning', 'History', 'Sabha', 'Calendar', 'Profile']

async function tap(label, opts = {}) {
  return scrollToAndTap(label, { fixed: NAV.includes(label), ...opts })
}

// Slow drag with a hold before release, so the WebView does not fling.
async function drag(fromY, toY) {
  const { width } = await driver.getWindowSize()
  const x = Math.round(width / 2)
  await driver.action('pointer', { parameters: { pointerType: 'touch' } })
    .move({ x, y: fromY }).down().move({ x, y: toY, duration: 700 }).pause(300).up().perform()
  await driver.pause(400)
}

// AI-DEV NOTE: this WebView exposes EVERY node, including ones scrolled off
// screen, so "found" does not mean "tappable". A tap on an off-screen element lands
// on whatever is under those coordinates. Always bring the element fully inside
// the visible band (below the header, above the bottom nav) before tapping.
async function scrollToAndTap(label, { timeout = 15000, maxDrags = 25, allowMany = false, fixed = false } = {}) {
  if (NEVER_TAP.some(re => re.test(label))) throw new Error(`refusing to tap "${label}" (on the never-tap list)`)
  // Never tap while an ad covers the screen: a tap could land on the ad.
  const adShowing = async () => /AdActivity/i.test(await driver.getCurrentActivity())
  if (await adShowing()) await waitForHuman('An ad is showing: close it yourself (do NOT tap the ad)', async () => !(await adShowing()), 3 * 60 * 1000)
  await findOne(label, { timeout, allowMany })
  const { height } = await driver.getWindowSize()
  // Fixed chrome (bottom nav) only has to be on screen; page content must sit in
  // the band between the app header and the bottom nav.
  const top = fixed ? 0 : Math.round(height * 0.14)
  const bottom = fixed ? height : Math.round(height * 0.88)
  for (let i = 0; i <= maxDrags; i++) {
    const el = await findOne(label, { timeout: 3000, allowMany })
    const { y } = await el.getLocation()
    const r = { y, height: (await el.getSize()).height }
    if (r.y >= top && r.y + r.height <= bottom) { await el.click(); return }
    if (fixed) throw new Error(`"${label}" is not on screen`)
    if (r.y < top) await drag(Math.round(height * 0.35), Math.round(height * 0.7))
    else await drag(Math.round(height * 0.7), Math.round(height * 0.35))
  }
  throw new Error(`"${label}" could not be scrolled fully into view`)
}

async function assertNoErrorBanner() {
  for (const bad of ['Something went wrong.', 'Could not load this page.', 'This reader needs a newer version of Android System WebView.']) {
    if (await isShown(bad)) throw new Error(`screen shows "${bad}"`)
  }
}

async function waitPdf(timeout = 45000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    await assertNoErrorBanner()
    if (!(await isShown('Loading...'))) return
    await driver.pause(1000)
  }
  throw new Error(`PDF still "Loading..." after ${timeout} ms`)
}

// ---------- Wi-Fi safety ----------
function restoreWifi() {
  if (wifiWasOn === null) return
  try { shell('svc', 'wifi', wifiWasOn ? 'enable' : 'disable') } catch { /* best-effort */ }
}

async function cleanup() {
  restoreWifi()
  try { if (driver) await driver.deleteSession() } catch { /* already gone */ }
  try { if (server) await server.close() } catch { /* already closed */ }
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, async () => { console.log(`\n${sig}: stopping - restoring Wi-Fi...`); await cleanup(); writeReport(); process.exit(130) })
}

// ---------- report ----------
function writeReport() {
  const lines = [
    `# Device run ${stamp}`, '',
    `Mode: ${WRITES ? 'full (--writes)' : 'read-only smoke'}`, '',
    '| # | Step | Result | Time | App memory | Note |', '|---|---|---|---|---|---|',
    ...results.map((r, i) => `| ${i + 1} | ${r.name} | ${r.status.toUpperCase()} | ${r.ms} ms | ${r.mem ?? '-'} MB | ${(r.note || '').replace(/\|/g, '/')} |`),
    '', '## Log errors', '',
    ...results.flatMap(r => r.errors.map(e => `- (${r.name}) \`${e.replace(/`/g, "'")}\``)),
    results.some(r => r.errors.length) ? '' : '(none)', '',
    'Screenshots are in this folder (git-ignored; they can show account details).',
  ]
  writeFileSync(join(OUT, 'REPORT.md'), lines.join('\n'))
  console.log(`\nReport: ${join(OUT, 'REPORT.md')}`)
}

// ---------- run ----------
async function main() {
  const devices = adb('devices').split('\n').filter(l => /\tdevice$/.test(l)).map(l => l.split('\t')[0])
  const udid = process.env.ANDROID_SERIAL || devices[0]
  if (!udid) throw new Error('No device connected (adb devices is empty). Plug the phone in and allow USB debugging.')
  console.log(`Device ${udid}. Mode: ${WRITES ? 'FULL (--writes)' : 'read-only smoke'}. Evidence -> ${OUT}`)
  try { writeFileSync(join(OUT, 'device-info.txt'), execFileSync('bash', [join(HERE, 'device-info.sh'), udid], { encoding: 'utf8' })) } catch { /* optional */ }
  const version = (shell('dumpsys', 'package', PKG).match(/versionName=(\S+)/) || [])[1]
  if (!version) throw new Error(`${PKG} is not installed on the phone`)
  console.log(`Nithyakarma ${version} installed`)
  wifiWasOn = shell('settings', 'get', 'global', 'wifi_on').trim() !== '0'
  adb('logcat', '-c')

  const { main: startAppium } = await import('appium')
  server = await startAppium({ port: 4723, address: '127.0.0.1', loglevel: 'error' })
  const { remote } = await import('webdriverio')
  driver = await remote({
    hostname: '127.0.0.1', port: 4723, logLevel: 'error',
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:udid': udid,
      'appium:appPackage': PKG,
      'appium:appActivity': '.MainActivity',
      'appium:noReset': true,
      'appium:autoLaunch': false,
      'appium:newCommandTimeout': 900,
    },
  })
  // Off-screen WebView nodes are hidden by default; we want to find them and then
  // scroll them into view before any tap (see scrollToAndTap).
  await driver.updateSettings({ allowInvisibleElements: true })

  await step('Cold start', async () => {
    shell('am', 'force-stop', PKG)
    const out = shell('am', 'start', '-W', '-n', `${PKG}/.MainActivity`)
    const total = (out.match(/TotalTime:\s+(\d+)/) || [])[1]
    const end = Date.now() + 30000
    while (Date.now() < end && !(await isShown('Today')) && !(await isShown('Welcome back'))) await driver.pause(500)
    if (!(await isShown('Today')) && !(await isShown('Welcome back'))) throw new Error('app UI did not appear within 30 s')
    return `activity ${total ?? '?'} ms (UI ready time is this step's total)`
  })

  await step('Signed in', async () => {
    if (await isShown('Welcome back')) {
      await waitForHuman(WRITES
        ? 'Sign in on the phone as the e2e TEST account (type the password yourself)'
        : 'Sign in on the phone yourself (any account; this run only reads)',
      async () => (await isShown('Today')) && !(await isShown('Welcome back')))
    }
    await findOne('Today', { timeout: 30000, allowMany: true })
    return `app ${version}`
  })

  await step('Today tab', async () => { await tap('Today', { allowMany: true }); await driver.pause(1500); await assertNoErrorBanner() })
  for (const tab of ['Learning', 'History', 'Calendar', 'Profile']) {
    await step(`${tab} tab`, async () => {
      if (!(await isShown(tab))) throw skip(`no "${tab}" tab on screen`)
      await tap(tab, { allowMany: true }); await driver.pause(2000); await assertNoErrorBanner()
    })
  }
  await step('Sabha tab', async () => {
    if (!(await isShown('Sabha'))) throw skip('Sabha is opt-in and hidden for this account')
    await tap('Sabha', { allowMany: true }); await driver.pause(2000); await assertNoErrorBanner()
  })

  await step('Devi Mahatmyam PDF', async () => {
    await tap('Learning', { allowMany: true }); await driver.pause(1500)
    await scrollToAndTap('Devi Mahatmyam')
    await waitPdf()
  })

  await step('Ramayanam PDF (Bala Kandam)', async () => {
    await tap('Learning', { allowMany: true }); await driver.pause(1500)
    await scrollToAndTap('Ramayanam')
    await scrollToAndTap('Bala Kandam', { allowMany: true })
    await waitPdf()
  })

  await step('Share sheet opens and cancels', async () => {
    await tap('Profile', { allowMany: true }); await driver.pause(1500)
    await scrollToAndTap('Share invite on WhatsApp')
    await driver.pause(2500)
    const pkg = await driver.getCurrentPackage()
    await driver.back()
    await driver.pause(1500)
    if (pkg === PKG && !(await isShown('Profile'))) throw new Error('share did not open and the app left Profile')
    return `foreground after tap: ${pkg}`
  })

  await step('Offline then back online', async () => {
    const mobileData = shell('settings', 'get', 'global', 'mobile_data').trim() === '1'
    if (mobileData) throw skip('mobile data is on, so turning Wi-Fi off would not make the phone offline; left untouched')
    if (!wifiWasOn) throw skip('Wi-Fi was already off at start')
    shell('svc', 'wifi', 'disable'); await driver.pause(4000)
    await tap('History', { allowMany: true }); await driver.pause(2500)
    const crashedOffline = await isShown('Something went wrong.')
    shell('svc', 'wifi', 'enable'); await driver.pause(8000)
    await tap('Today', { allowMany: true }); await driver.pause(2500)
    await assertNoErrorBanner()
    if (crashedOffline) throw new Error('History showed "Something went wrong." while offline')
  })

  // ---------- writes: e2e test account only ----------
  await step('Write guard: e2e account signed in', async () => {
    await tap('Profile', { allowMany: true }); await driver.pause(2000)
    await tap('Today'); await driver.pause(2000)
    // The Today greeting shows the signed-in account ("Namaskaram, <name or email>").
    const els = await driver.$$(`//*[contains(@text, "${E2E_EMAIL}") or contains(@content-desc, "${E2E_EMAIL}")]`)
    if (!els.length) throw new Error(`signed-in account is not ${E2E_EMAIL} - refusing to change data on this account`)
    return 'test account confirmed'
  }, { write: true })

  const guardOk = !WRITES || results.find(r => r.name === 'Write guard: e2e account signed in')?.status === 'pass'
  if (WRITES && guardOk) {
    await step('Mark one practice done', async () => {
      await tap('Today', { allowMany: true }); await driver.pause(2000)
      // Any practice is fine on the test account, so the first "Mark Done" is used on purpose.
      await tap('Mark Done', { allowMany: true })
      await driver.pause(4000)
      const adShowing = async () => /AdActivity/i.test(await driver.getCurrentActivity())
      if (await adShowing()) await waitForHuman('An ad is showing: close it yourself (do NOT tap the ad)', async () => !(await adShowing()), 3 * 60 * 1000)
      await assertNoErrorBanner()
    }, { write: true })
  }
}

main()
  .catch((e) => { console.error(`\nRun aborted: ${e.message}`); results.push({ name: 'run', status: 'fail', ms: 0, note: e.message, errors: [], mem: null, shot: '' }) })
  .finally(async () => {
    await cleanup()
    writeReport()
    const failed = results.filter(r => r.status === 'fail').length
    console.log(`${results.length} steps, ${failed} failed`)
    process.exit(failed ? 1 : 0)
  })
