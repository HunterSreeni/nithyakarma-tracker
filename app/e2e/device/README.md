# Physical device tests (human in the loop)

Appium 3.9.0 + UiAutomator2 driver 8.7.3 (the 9.x line needs Appium 4 beta and
Node 24.15+) + WebdriverIO 10.2.0, driving the **real Play build** on a phone over
USB. Own `package.json`, so the app's lockfile is untouched.

## Setup (once)

```
cd app/e2e/device
npm install
```

Needs `D:\AndroidSDK` (platform-tools, build-tools) and JDK 21 at
`C:\Program Files\Java\jdk-21`; override with `ANDROID_HOME` / `JAVA_HOME`.
Check with `APPIUM_HOME=. npx appium driver doctor uiautomator2` (0 required fixes).

On the phone: Developer options -> USB debugging on, connect with a data cable,
allow the computer.

## Run

| Command | What it does |
|---|---|
| `npm run info` | Read-only device profile: Android, Android Go, WebView provider + version, Play services, installed app version |
| `npm run smoke` | **Read-only**: cold start, every tab, a Devi Mahatmyam and a Bala Kandam PDF, share sheet open+cancel, offline/online (only when mobile data is off) |
| `npm run full` | Smoke + data-changing steps (mark one practice). Refuses unless the signed-in account is exactly `E2E_EMAIL` (default `e2e@nithyakarma.test`) |

When the app is signed out the run waits (up to 10 min) for the human to sign in
on the phone. It never types passwords, never taps "Continue with Google", never
taps ads (the human closes an interstitial), and has a never-tap list (delete,
sign out, test notification, ads). Wi-Fi is restored to its starting state on any
exit, including Ctrl+C.

Evidence goes to `reports/<timestamp>/` (git-ignored, it can show account
details): `REPORT.md`, a screenshot per step, `device-info.txt`, crash/JS-error
lines from logcat, app memory (PSS) and timings.

## Gotchas found on the Redmi Go (Android 8.1 Go, WebView = Chrome 138)

- WebView content is visible to UiAutomator as accessibility nodes, but CSS
  `text-transform` is applied: the nav reads `TODAY`, card titles `DEVI MAHATMYAM`.
  Labels are matched as written and upper-cased.
- Each control appears twice (clickable container + inner text); the clickable one
  is preferred.
- The WebView exposes off-screen nodes too (the script sets
  `allowInvisibleElements`). A tap on an off-screen element lands on whatever is
  under those coordinates, so every tap first drags the element fully into the
  visible band; the fixed bottom nav only has to be on screen.
- Scroll with slow drags that pause before release; flings skip past content.
- In Git Bash, prefix adb commands that use device paths with `MSYS_NO_PATHCONV=1`.
