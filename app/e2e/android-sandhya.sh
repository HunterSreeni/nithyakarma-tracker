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
# NOTE (found + fixed 2026-07-23): tapping the email field brings up the
# on-screen keyboard, which makes the page scroll up to keep the focused
# field visible above it - so the password-field and Sign In coordinates
# are NOT the same as their no-keyboard positions used for the first tap.
# Using the no-keyboard coordinates here previously missed both, landing on
# empty space/the keyboard itself, garbling the email field and eventually
# mis-tapping into a signed-in Google account already cached on this
# emulator instead of the throwaway account - verified via Supabase MCP that
# no real data was affected, but this needs the keyboard-shown coordinates.
tap 557 1562           # email field (no keyboard shown yet)
sleep 1
adb shell input text "$EMAIL"
sleep 1
tap 540 954             # password field (keyboard now shown, page scrolled up)
sleep 1
adb shell input text "$PASSWORD"
sleep 1
tap 540 1214             # Sign In (keyboard-shown position - KEYCODE_BACK does not
                          # reliably dismiss the keyboard here, so tap through it)
sleep 5
# The following coordinates (OS notification prompt, tour dismiss, sandhya
# slots) were NOT re-verified against a real run in this session - the login
# fix above was confirmed by hand up through a clean Today page, but the
# post-login sequence should be re-checked interactively (with eyes on the
# emulator, not blind screenshot round-trips) before trusting this script's
# PASS again.
tap 557 1474             # dismiss the OS "Allow notifications?" prompt (Don't allow) -
                          # no-op tap on the Today card if the prompt didn't appear
sleep 1
tap 917 1085             # dismiss the driver.js first-run guided tour (its "x" close
                          # button) - no-op tap on the Today card if the tour didn't run
sleep 1
shot "01-today.png"

echo "==> 4. Mark all 3 sandhya slots"
for slot_x in 312 467 619; do
  tap "$slot_x" 1276
  sleep 3
  tap 540 1727            # dismiss celebration via Continue (no-op if absent)
  sleep 1
done
shot "02-after-3-slots.png"

echo "==> 5. Assertions"
fail=0
LOG="$(adb logcat -d 2>&1)"
if echo "$LOG" | grep -qiE "AndroidRuntime: FATAL"; then
  echo "  FAIL: fatal crash during sandhya flow"; fail=1
else
  echo "  ok: no fatal crash"
fi
adb shell pidof "$PKG" >/dev/null && echo "  ok: process alive" || { echo "  FAIL: process not running"; fail=1; }
echo "  screenshots saved to $SCRATCH (02-after-3-slots.png should show '1 Day Streak!')"
echo "  cross-check server state (streak/punya/slot count) via Supabase MCP against $EMAIL, then delete the throwaway user"

[ "$fail" = 0 ] && echo "ANDROID SANDHYA E2E: PASS" || { echo "ANDROID SANDHYA E2E: FAIL"; exit 1; }
