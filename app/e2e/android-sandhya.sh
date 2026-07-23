#!/usr/bin/env bash
# Android sandhya 3-slot E2E: build -> install -> login -> mark all 3
# Sandhyavandhanam slots -> assert no crash via logcat + a final screenshot.
#
# The in-app WebView exposes no accessibility tree (NAF="true"), so there is no
# programmatic text-assertion available here (unlike the Playwright web spec).
# The pass signal is: (1) no FATAL crash in logcat across the whole flow, (2)
# the process is still alive at the end, (3) a screenshot is saved for manual
# visual confirmation of "1 Day Streak!". Full state (streak/punya/slot count)
# is cross-checked separately via Supabase MCP against the same account.
#
# The seed script pre-onboards the account and marks it ad-free, so this
# script logs in and goes straight to marking slots - no onboarding UI, no
# AdMob interstitial in the way. (An earlier version drove onboarding live and
# hit a real AdMob test interstitial after each mark; blind taps timed against
# that live ad occasionally mis-tapped its click-through into Chrome instead of
# the app's own Continue button - ad-free removes that class of flake.)
#
# Tap coordinates are calibrated for a 1080x2400 emulator (the shorts_test AVD
# used on this dev machine) and WILL need recalibrating (screenshot, measure,
# adjust) on a different resolution/device - see TEST-PLAN.md's Android
# tooling notes on the screenshot-then-tap technique.
#
# Requires: a running emulator/device (adb), JDK for Gradle, app/.env present,
# and the throwaway account seeded first via Supabase MCP:
#   supabase/tests/seed-android-sandhya-throwaway.sql
#
# Usage: JAVA_HOME=/path/to/jdk21 ./e2e/android-sandhya.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PKG="org.nithyakarma.app"
APK="$APP_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
SCRATCH="$(mktemp -d)"
EMAIL="android-sandhya-throwaway@nithyakarma.test"
PASSWORD="AndroidSandhya2026xyz"
cd "$APP_DIR"

tap() { adb shell input tap "$1" "$2"; }
key() { adb shell input keyevent "$1"; }
shot() { adb exec-out screencap -p > "$SCRATCH/$1"; }

echo "==> 0. Preconditions"
[ -f .env ] || { echo "FAIL: app/.env missing - build would white-screen"; exit 1; }
adb get-state >/dev/null 2>&1 || { echo "FAIL: no adb device/emulator"; exit 1; }

echo "==> 1. Build web + sync + assemble debug APK"
npm run build >/dev/null
npx cap sync android >/dev/null
( cd android && ./gradlew --console=plain assembleDebug >/dev/null )

echo "==> 2. Install + launch"
adb install -r "$APK" >/dev/null
# adb install -r does NOT wipe app data - a leftover session from prior manual
# testing on the same emulator would silently skip login entirely and resume
# whatever account was last signed in. pm clear guarantees a fresh, logged-out
# start every run.
adb shell pm clear "$PKG" >/dev/null
sleep 2
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 8

echo "==> 3. Log in"
# NOTE (found + fixed 2026-07-23, re-verified same day): tapping the email
# field brings up the on-screen keyboard, which scrolls the page to keep the
# focused field visible - and that scroll amount is NOT reliably reproducible
# run to run (sometimes the keyboard stays up after typing, sometimes it
# closes on its own), so ANY hardcoded coordinate for the password field or
# the Sign In button is inherently flaky. Two miscalibrated attempts landed
# on a real personal Google account cached on this emulator instead of the
# throwaway account - confirmed via Supabase MCP both times that no data was
# written to it, but this is exactly the kind of mistake that could reach
# real data. Fixed properly: after the one coordinate-based tap to focus the
# email field, use KEYCODE_TAB to move focus to the password field and
# KEYCODE_ENTER to submit - both are DOM focus-order operations, not
# screen-position taps, so they're immune to the keyboard-reflow problem
# entirely.
tap 557 1562            # email field (the only coordinate-based tap left)
sleep 1
adb shell input text "$EMAIL"
sleep 1
key KEYCODE_TAB          # move focus to the password field - no coordinate needed
sleep 1
adb shell input text "$PASSWORD"
sleep 1
key KEYCODE_ENTER         # submit - no coordinate needed, works regardless of keyboard state
sleep 5

echo "==> 4. Dismiss the OS notification prompt (if it appears) and the guided tour"
# The OS "Allow notifications?" permission dialog did not appear in either
# 2026-07-23 test run (permission grant state appears to survive `pm clear`,
# unlike app data) - this tap is a no-op-safe fallback in case it does.
tap 540 1470              # "Don't allow" on the OS notification dialog, harmless no-op otherwise
sleep 1
# This throwaway account is freshly seeded every run, so the driver.js
# first-run tour DOES run (3 steps: welcome -> sandhya-slots -> add-practice),
# not a single dismiss - verified 2026-07-23. "Next" and "Begin" are in the
# same screen position across all 3 steps.
tap 842 1348               # tour step 1/3: Next
sleep 1
tap 917 1873               # tour step 2/3: Next
sleep 1
tap 836 1287               # tour step 3/3: Begin
sleep 1
shot "01-today.png"

echo "==> 5. Mark all 3 sandhya slots"
# Coordinates re-measured and verified 2026-07-23: the Morning/Noon/Evening
# pill row sits INSIDE the Sandhyavandhanam card (y~2058), well below the
# "Me / + Add child" profile-switcher row (y~1288) that an earlier version of
# this script mistook it for - that mistake tapped "+ Add child" and
# navigated to /profile instead of marking anything, twice, in two different
# sessions, before being caught.
for slot_x in 312 495 680; do
  tap "$slot_x" 2058
  sleep 3
  tap 540 1643            # dismiss celebration via Continue (no-op if absent)
  sleep 1
done
shot "02-after-3-slots.png"

echo "==> 6. Assertions"
fail=0
LOG="$(adb logcat -d 2>&1)"
if echo "$LOG" | grep -qiE "AndroidRuntime: FATAL"; then
  echo "  FAIL: fatal crash during sandhya flow"; fail=1
else
  echo "  ok: no fatal crash"
fi
adb shell pidof "$PKG" >/dev/null && echo "  ok: process alive" || { echo "  FAIL: process not running"; fail=1; }
echo "  screenshots saved to $SCRATCH (02-after-3-slots.png should show 'ALL 3 SANDHYAS DONE')"
echo "  cross-check server state (streak/punya/slot count) via Supabase MCP against $EMAIL, then delete the throwaway user"

[ "$fail" = 0 ] && echo "ANDROID SANDHYA E2E: PASS" || { echo "ANDROID SANDHYA E2E: FAIL"; exit 1; }
